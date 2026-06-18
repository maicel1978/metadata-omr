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
│   │   └── dom.js
│   └── features/
│       ├── importer/
│       ├── preview/
│       ├── form-compiler/
│       ├── printer/
│       ├── omr-exporter/
│       └── omr-reader/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── OMR-ROADMAP.md
│   └── CURRENT-STATUS.md
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
- Usar `this.thresholdStrategy` en el OMR Reader (Strategy Pattern).
- Evitar `alert()`. Usar mensajes visuales en el DOM.
- Mantener la navegación con botones "Volver" y "Siguiente".

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

- El proyecto tiene **OMR Reader MVP** funcional.
- Soporta variables cuantitativas hasta 3 dígitos.
- Tiene navegación entre pasos.
- Cuenta con exportación de plantilla `.omr`.
- Está documentado para ser continuado por otros agentes.

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

- El archivo `.clinical` es la **única fuente de verdad**.
- El sistema está diseñado para ser **producido y escalado**.
- Cualquier agente puede continuar el proyecto sin necesidad de preguntar al autor original, siempre que siga esta guía.

---

**Este archivo debe mantenerse actualizado.**