# Clinical OMR Suite - Arquitectura del Sistema

## Visión General

**Clinical OMR Suite** es un sistema determinista de compilación y lectura de formularios clínicos imprimibles y escaneables, desarrollado exclusivamente con tecnologías web nativas (Vanilla JavaScript ES Modules).

## Principios de Diseño

- **Determinismo**: Mismos inputs siempre producen los mismos outputs.
- **Sin frameworks**: 100% Vanilla JavaScript.
- **Escalabilidad**: Arquitectura modular por features.
- **Robustez clínica**: Validaciones estrictas basadas en el archivo `.clinical`.
- **Compatibilidad OMR**: Preparado para lectura de formularios escaneados.
- **Una sola fuente de geometría** (revisión 2026-06-19): la posición de cada burbuja se calcula una única vez. Ver "Flujo Principal de Datos" abajo — antes de esta revisión, esa regla no se cumplía y fue la causa raíz de varios bugs (ver `CHANGELOG.md`).

## Estructura de Capas

```
index.html
├── css/                  → Estilos globales y variables de diseño
├── js/
│   ├── main.js           → Punto de entrada y orquestación del wizard
│   ├── core/
│   │   ├── store.js          → Estado global + persistencia (LocalStorage)
│   │   ├── dom.js            → Utilidades puras de manipulación DOM
│   │   ├── sanitize.js       → escapeHTML() — obligatorio para cualquier dato del .clinical insertado en el DOM
│   │   ├── notifications.js  → notify.success/error/warning (único mecanismo de aviso; nunca alert())
│   │   ├── filename.js       → safeFileName() para descargas
│   │   ├── layout-engine.js  → ÚNICA fuente de verdad de la geometría (mm): alturas, paginación, bounding boxes
│   │   └── render-page.js    → renderizador único de página (HTML+CSS), consumido por pantalla e impresión
│   └── features/         → Módulos funcionales independientes
│       ├── importer/     → Importación, validación y normalización de .clinical
│       ├── preview/      → Vista previa lineal de variables
│       ├── form-compiler/→ Validación de completitud + invocación del layout-engine + paginación
│       ├── printer/      → Exportación a HTML imprimible A4 (usa render-page.js)
│       ├── omr-exporter/ → Serializa compiledForm a .omr (sin recalcular nada; solo service.js, sin UI propia)
│       └── omr-reader/   → Lector OMR (Canvas + calibración por marcas + detección + Strategy Pattern)
```

## Patrón de Cada Feature

Cada feature sigue el mismo patrón:

```
feature-name/
├── service.js      → Lógica de negocio y datos
├── view.js         → Renderizado de interfaz
├── controller.js   → Manejo de eventos y flujo
└── (opcional)      → Archivos adicionales (detection.js, calibration.js, etc.)
```

**Excepción documentada**: `omr-exporter/` solo tiene `service.js`. No tiene una UI propia porque no existe ningún paso del wizard dedicado a ella — se invoca como una utilidad desde el botón "Exportar Plantilla .omr" del paso de impresión. (Antes existían `controller.js`/`view.js` para un paso que nunca se montaba en la navegación; se eliminaron en la revisión de 2026-06-19 porque eran código muerto, y además su `initOMRExporter()` sobrescribía por error el mismo contenedor DOM que usa `omr-reader`.)

## Flujo Principal de Datos

```
.clinical (VarOps)
    ↓
importer → Validación de esquema + normalización de nombres (transliteración, no eliminación de tildes)
    ↓
store (variables + project)
    ↓
form-compiler → Validación de completitud
    ↓
core/layout-engine.computeLayout(variables)   ←── ÚNICA fuente de geometría (mm)
    ↓
compiledForm (blocks con bounding boxes ya calculados, página por página)
    ↓                         ↓                          ↓
core/render-page.js    core/render-page.js      omr-exporter (solo serializa,
(vista en pantalla,    (HTML para imprimir,      usa los mismos bounding
form-compiler/view.js) printer/service.js)       boxes del compiledForm)
    ↓                         ↓                          ↓
   pantalla              papel impreso            archivo .omr (mm)
                                                          ↓
                                                   omr-reader (calibra
                                                   escala/offset por imagen
                                                   y lee esas MISMAS
                                                   coordenadas en el
                                                   escaneo subido)
```

La idea central de este diagrama (y la garantía que reemplaza al diseño anterior, donde printer/service.js y omr-exporter/service.js recalculaban cada uno su propia geometría) es que **todo lo que está por debajo de `compiledForm` lee las mismas coordenadas** — nunca las vuelve a calcular.

## Estado Global (Store)

El Store centraliza:

- `project`
- `variables` (del archivo .clinical)
- `compiledForm` (resultado del compilador, incluye `blocks` con su geometría ya calculada)
- `currentStep`

## Reglas de Extensibilidad

1. **Nunca modificar** `core/store.js` sin documentar el cambio.
2. Todo nuevo feature debe seguir el patrón `service/view/controller`.
3. Las coordenadas OMR siempre se calculan en **milímetros**, y siempre en `core/layout-engine.js` — ningún otro archivo debe calcular una posición desde cero.
4. Cualquier mejora en detección OMR debe ir en `omr-reader/detection.js`; cualquier mejora en calibración geométrica (escala, futura corrección de rotación) va en `omr-reader/calibration.js`.
5. La validación **estructural** del `.clinical` (¿tiene los campos correctos? ¿son del tipo correcto?) vive en `importer/validator.js`. La validación de **completitud** (¿esta variable tiene todo lo necesario para compilarse?) vive en `form-compiler/service.js` (`isVariableComplete`). Son responsabilidades distintas — no fusionarlas.
6. Cualquier texto proveniente del `.clinical` debe pasar por `core/sanitize.js` antes de insertarse en el DOM.

## Consideraciones de Mantenibilidad

- El sistema está diseñado para ser continuado por otro agente/modelo.
- Toda la lógica crítica está comentada, incluyendo el motivo histórico de varias decisiones (ver comentarios con fecha 2026-06-19 en el código, que documentan qué problema concreto corrigieron).
- Se prioriza claridad sobre optimización prematura.
- El archivo `.clinical` es la **única fuente de verdad** de los metadatos; `core/layout-engine.js` es la única fuente de verdad de la geometría derivada de esos metadatos.
