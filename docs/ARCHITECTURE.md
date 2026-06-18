# Clinical OMR Suite - Arquitectura del Sistema

## Visión General

**Clinical OMR Suite** es un sistema determinista de compilación y lectura de formularios clínicos imprimibles y escaneables, desarrollado exclusivamente con tecnologías web nativas (Vanilla JavaScript ES Modules).

## Principios de Diseño

- **Determinismo**: Mismos inputs siempre producen los mismos outputs.
- **Sin frameworks**: 100% Vanilla JavaScript.
- **Escalabilidad**: Arquitectura modular por features.
- **Robustez clínica**: Validaciones estrictas basadas en el archivo `.clinical`.
- **Compatibilidad OMR**: Preparado para lectura de formularios escaneados.

## Estructura de Capas

```
index.html
├── css/                  → Estilos globales y variables de diseño
├── js/
│   ├── main.js           → Punto de entrada y orquestación del wizard
│   ├── core/
│   │   ├── store.js      → Estado global + persistencia (LocalStorage)
│   │   └── dom.js        → Utilidades puras de manipulación DOM
│   └── features/         → Módulos funcionales independientes
│       ├── importer/     → Importación y validación de .clinical
│       ├── preview/      → Vista previa lineal de variables
│       ├── form-compiler/→ Motor de compilación + paginación A4
│       ├── printer/      → Exportación a HTML imprimible A4
│       ├── omr-exporter/ → Generación de plantilla .omr
│       └── omr-reader/   → Lector OMR MVP (Canvas + detección)
```

## Patrón de Cada Feature

Cada feature sigue el mismo patrón:

```
feature-name/
├── service.js      → Lógica de negocio y datos
├── view.js         → Renderizado de interfaz
├── controller.js   → Manejo de eventos y flujo
└── (opcional)      → Archivos adicionales (detection.js, etc.)
```

## Flujo Principal de Datos

```
.clinical (VarOps)
    ↓
importer → Validación + Normalización
    ↓
store (variables + project)
    ↓
form-compiler → Validación + Compilación + Paginación
    ↓
compiledForm (blocks + omrRegions + metadatos)
    ↓
printer          → Impresión A4
omr-exporter     → Plantilla .omr
omr-reader       → Lectura de escaneos
```

## Estado Global (Store)

El Store centraliza:

- `project`
- `variables` (del archivo .clinical)
- `compiledForm` (resultado del compilador)
- `currentStep`

## Reglas de Extensibilidad

1. **Nunca modificar** `core/store.js` sin documentar el cambio.
2. Todo nuevo feature debe seguir el patrón `service/view/controller`.
3. Las coordenadas OMR siempre se calculan en **milímetros**.
4. Cualquier mejora en detección OMR debe ir en `omr-reader/detection.js`.
5. La validación del `.clinical` debe estar centralizada en `form-compiler/service.js`.

## Consideraciones de Mantenibilidad

- El sistema está diseñado para ser continuado por otro agente/modelo.
- Toda la lógica crítica está comentada.
- Se prioriza claridad sobre optimización prematura.
- El archivo `.clinical` es la **única fuente de verdad** de los metadatos.