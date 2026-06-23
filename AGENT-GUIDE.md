# AGENT-GUIDE.md
## Guía para Agentes que Trabajan en Clinical OMR Suite

Este documento está diseñado para que **cualquier agente o modelo** pueda tomar el proyecto desde cero de forma ordenada y profesional.

---

## 1. Principios del Proyecto

- **Determinismo**: Mismo input = mismo output.
- **Sin frameworks**: Solo Vanilla JavaScript (ES Modules).
- **Modularidad**: Cada feature sigue el patrón `service.js` + `view.js` + `controller.js`.
- **Escalabilidad**: El sistema debe poder crecer sin romper lo existente.
- **Robustez clínica**: Toda la lógica depende del archivo `.clinical`.
- **Una sola fuente de geometría** (añadido 2026-06-19): la posición de CADA burbuja se calcula una única vez, en `js/core/layout-engine.js`. Ningún otro archivo recalcula coordenadas — todos consumen las mismas. Ver "Lección aprendida" en la sección 8.

---

## 2. Estructura del Proyecto

```
clinical-omr-suite/
├── index.html
├── css/
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── store.js
│   │   ├── dom.js
│   │   ├── sanitize.js        → escapeHTML() — usar SIEMPRE al insertar datos del .clinical en el DOM
│   │   ├── notifications.js   → notify.success/error/warning — único mecanismo de aviso, nunca alert()
│   │   ├── filename.js        → safeFileName() para cualquier descarga
│   │   ├── layout-engine.js   → ÚNICA fuente de geometría (mm). No duplicar este cálculo en ningún feature.
│   │   └── render-page.js     → renderizador único de página, usado por form-compiler Y printer
│   └── features/
│       ├── importer/
│       ├── preview/
│       ├── form-compiler/
│       ├── printer/
│       ├── omr-exporter/      → solo `service.js` (sin UI propia; se usa desde printer)
│       └── omr-reader/
│           └── calibration.js → calibración de escala/desplazamiento por marcas de registro
├── docs/
│   ├── ARCHITECTURE.md
│   ├── OMR-ROADMAP.md
│   ├── CURRENT-STATUS.md
│   └── CLINICAL-FORMAT.md
├── CHANGELOG.md                 → detalle de la revisión del 2026-06-19 y 2026-06-20, problema por problema
├── smoke-test.mjs               → script de humo: flujo de un solo paciente (jsdom)
├── smoke-test-batch-ui.mjs      → script de humo: flujo de lote + edición manual (jsdom)
├── AGENT-GUIDE.md
└── README.md
```

---

## 3. Reglas Obligatorias para Agentes

### 3.1 Patrón de Desarrollo

Cada nueva funcionalidad **debe** seguir este patrón:

```
feature-name/
├── service.js      → Lógica y datos
├── view.js         → Renderizado
└── controller.js   → Eventos y flujo
```

### 3.2 Reglas de Código

- **Nunca** modificar `core/store.js` sin documentarlo.
- Las coordenadas OMR siempre se manejan en **milímetros**.
- **Nunca recalcular la posición de una burbuja fuera de `core/layout-engine.js`.** Antes de la revisión del 2026-06-19, el Form Compiler, el Printer y el OMR Exporter tenían CADA UNO su propia fórmula de posicionamiento, con constantes distintas — eso es lo que causaba que el archivo `.omr` no coincidiera con lo impreso, y que variables con muchas categorías generaran burbujas fuera de la página. Si necesitas la posición de algo, importa `absoluteOptionBox`/`absoluteBlockBox`/`absoluteLabelBox` desde `layout-engine.js`; no escribas una nueva fórmula.
- **El texto legible de una categoría NUNCA va dentro de su burbuja.** El 2026-06-20 se encontró que precisamente eso (texto de categoría impreso dentro de un círculo de 5mm) hacía que el Lector OMR detectara la categoría equivocada — el texto se desbordaba sobre la burbuja vecina y contaminaba su densidad. El texto de una categoría siempre va en su propio `labelBox`, separado y sin superposición con ninguna burbuja (eso lo garantiza `layoutCategorical()` en `layout-engine.js`). Los dígitos (0-9) de variables cuantitativas SÍ pueden ir dentro de su burbuja porque un solo carácter no genera este problema.
- Si necesitas dibujar una página (en pantalla o para imprimir), usa `renderPageHTML` de `core/render-page.js`. No crear un cuarto renderizador.
- **Siempre** pasar cualquier texto proveniente del `.clinical` (nombre, pregunta, categoría, unidad, nombre de proyecto) por `escapeHTML()` de `core/sanitize.js` antes de insertarlo en `innerHTML`/`document.write`. Antes de la revisión, ese módulo existía pero no se usaba en ninguna vista.
- Usar `this.thresholdStrategy` en el OMR Reader (Strategy Pattern).
- **Nunca usar `alert()` ni `confirm()`.** Usar `notify.success/error/warning` de `core/notifications.js`.
- Mantener la navegación con botones "Volver" y "Siguiente".
- Cualquier nombre de archivo para descarga debe pasar por `safeFileName()` de `core/filename.js`.

### 3.3 Documentación

- Actualizar `docs/CURRENT-STATUS.md` al finalizar cambios importantes.
- Si se trabaja en el OMR Reader, actualizar `docs/OMR-ROADMAP.md`.
- Si se añade una nueva estrategia de umbral, crearla en `omr-reader/strategies/`.

---

## 4. Flujo Recomendado al Tomar el Proyecto

1. Leer `AGENT-GUIDE.md`
2. Leer `docs/ARCHITECTURE.md`
3. Leer `docs/CURRENT-STATUS.md`
4. Revisar `docs/OMR-ROADMAP.md` si se va a trabajar en detección OMR
5. Ejecutar el proyecto con **Live Server**
6. Realizar cambios siguiendo el patrón modular

---

## 5. Estado Actual del Proyecto (Resumen)

- El proyecto tiene **OMR Reader MVP** funcional, con calibración geométrica por marcas de registro (corrige escala/DPI; rotación/inclinación sigue pendiente).
- Soporta variables cuantitativas hasta `MAX_INT_DIGITS` dígitos enteros y `MAX_DEC_DIGITS` decimales (ver `core/layout-engine.js`), con rechazo explícito si un rango lo excede.
- Tiene navegación entre pasos.
- Cuenta con exportación de plantilla `.omr`, generada directamente desde la misma geometría que se usa para imprimir.
- Está documentado para ser continuado por otros agentes.
- Ver `CURRENT-STATUS.md` para el detalle módulo por módulo y `CHANGELOG.md` para el historial de la revisión más reciente.

---

## 6. Cómo Añadir Nuevas Funcionalidades

### Ejemplo: Añadir nueva estrategia de umbral

1. Crear nuevo archivo en `js/features/omr-reader/strategies/`
2. Extender `BaseThresholdStrategy`
3. Actualizar `detection.js` para soportar la nueva estrategia
4. Documentar en `docs/OMR-ROADMAP.md`

### Ejemplo: Mejorar el OMR Reader

- Trabajar principalmente en:
  - `detection.js`
  - `strategies/`
  - `service.js`
- Actualizar `OMR-ROADMAP.md`

---

## 7. Notas Finales

- El archivo `.clinical` es la **única fuente de verdad** para el contenido.
- `js/core/layout-engine.js` es la **única fuente de verdad** para la geometría.
- El sistema está diseñado para ser **producido y escalado**.
- Cualquier agente puede continuar el proyecto sin necesidad de preguntar al autor original, siempre que siga esta guía.

---

## 8. Lección Aprendida (revisión 2026-06-19)

Una auditoría externa encontró que, aunque cada módulo individualmente parecía razonable, **tres archivos distintos calculaban la posición de las burbujas de forma independiente** (Form Compiler, Printer, OMR Exporter), cada uno con sus propias constantes. Ninguno de los tests existentes lo detectó porque eran *smoke tests* ("¿existe la función?") en vez de pruebas que verificaran coordenadas reales.

**Regla derivada para cualquier agente futuro**: si una funcionalidad nueva necesita saber "dónde está algo en la página", la respuesta correcta casi siempre es "pregúntale a `layout-engine.js`", nunca "vuelve a calcularlo aquí". Y cualquier test nuevo sobre geometría debe afirmar coordenadas concretas (p. ej. "ninguna burbuja excede el ancho de la página"), no solo que una función no lance una excepción. Ver `CHANGELOG.md` para el listado completo de hallazgos de esa auditoría y cómo se corrigieron.

El 2026-06-20 se encontró además que pruebas geométricas "sin overlap" no bastan por sí solas para garantizar que el Lector OMR lee bien: el bug real (texto de categoría dentro de la burbuja) violaba esa garantía. Por eso, además de `npm test`, este proyecto incluye dos scripts de humo que ejercitan flujos completos sobre un DOM real con jsdom:

```bash
npm install            # instala vitest + jsdom (devDependencies)
npm test                # 61 pruebas unitarias/geométricas
node smoke-test.mjs               # flujo de un solo paciente: importar -> compilar -> imprimir -> exportar .omr
node smoke-test-batch-ui.mjs      # flujo de lote: procesar, editar una celda con clics/teclado reales, deshacer, agregar más pacientes, reiniciar
```

Cualquier cambio en `layout-engine.js`, `render-page.js`, `omr-exporter/service.js` o el módulo `omr-reader` completo debería volver a correr los tres (vitest + ambos scripts) antes de darse por terminado.

---

**Este archivo debe mantenerse actualizado.**