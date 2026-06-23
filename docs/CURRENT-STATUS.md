# Clinical OMR Suite - Estado Actual del Proyecto

**Fecha de última actualización**: 2026-06-20 (continuación) — corrección de la contaminación por el borde de la burbuja + diagnóstico visible de densidades

---

## Resumen Ejecutivo

El 2026-06-19 se hizo una auditoría crítica que encontró una desconexión arquitectónica de fondo: la posición de cada burbuja se calculaba tres veces, en tres archivos distintos. Se unificó en `js/core/layout-engine.js`.

El 2026-06-20, el usuario reportó (probando la app real) que el Lector OMR parecía detectar la categoría "complementaria" a la que realmente estaba marcada en el papel. Se corrigió un primer bug (el texto de cada categoría se imprimía dentro de su propia burbuja y se desbordaba sobre la burbuja vecina). El usuario reportó que el problema seguía ocurriendo, y aportó una explicación muy precisa del comportamiento esperado de un sistema OMR (qué significa "marcado" vs "sin marcar" en cada tipo de variable biomédica) que ayudó a encontrar una segunda causa raíz real: el borde impreso de cualquier burbuja aporta, por sí solo, una densidad de tinta considerable (~25-30%) — igual en una burbuja marcada que en una sin marcar — lo que podía hacer que una marca a mano no perfectamente sólida no superara con margen esa "densidad base" del borde. Se corrigió analizando solo el interior de cada burbuja. Además, ahora la tabla de resultados muestra siempre (no solo al pasar el mouse) la densidad medida en cada opción, para poder diagnosticar con números cualquier lectura inesperada en el futuro.

---

## Estado por Módulo (revisado)

| Módulo            | Estado                | Notas |
|--------------------|------------------------|-------|
| **Importer**       | ✅ Estable             | Normalización de nombres corregida (tildes/ñ se transliteran, no se eliminan); rechaza nombres duplicados y rangos irrepresentables; errores detallados visibles al usuario (antes se descartaban). |
| **Layout Engine**   | ✅ Nuevo               | Fuente única de verdad para toda la geometría (mm). Sustituye los tres cálculos independientes que existían antes. |
| **Preview**         | ✅ Estable             | Contenido del `.clinical` ahora escapado antes de insertarse en el DOM. |
| **Form Compiler**   | ✅ Estable             | Delega la geometría al Layout Engine; ya no tiene su propia tabla de alturas estimadas desconectada de la impresión real. |
| **Printer**         | ✅ Estable             | Usa el mismo renderizador (`core/render-page.js`) que la vista en pantalla — garantiza que lo impreso coincide con lo exportado. Ventanas de impresión/vista previa ya no exponen `window.opener`. |
| **OMR Exporter**    | ✅ Simplificado        | Ya no recalcula coordenadas: serializa directamente las del Layout Engine. Se eliminó la UI no conectada (`controller.js`/`view.js`) que nunca se montaba en la navegación. |
| **OMR Reader**      | ✅ Mejorado            | **Corregido un bug crítico de detección** (texto de categoría contaminaba la burbuja vecina — ver CHANGELOG 2026-06-20). Soporta procesar **múltiples pacientes en lote** (una fila por paciente al exportar), carga por carpeta, y **corrección manual editable** desde la propia tabla de resultados. Corregida también una fuga de event listeners. Conversión mm→px calibrada por imagen (detección de marcas de registro) en vez de asumir siempre 96dpi. Piso absoluto de densidad para evitar falsos positivos en preguntas en blanco. |
| **Notificaciones**  | ✅ Conectado           | El sistema centralizado (`core/notifications.js`) estaba escrito pero nunca se usaba; ahora es el único mecanismo de aviso en toda la app (se eliminaron los 6 usos de `alert()`). |
| **Tests**           | ✅ Ampliados           | 61 tests automatizados (antes 19) + 2 scripts de humo manuales sobre DOM real (`smoke-test.mjs`, `smoke-test-batch-ui.mjs`). Incluyen una prueba de integración que reproduce el bug del 2026-06-20 con el pipeline completo y confirma que ya no ocurre. |

---

## Lo que esta revisión corrigió (resumen — ver CHANGELOG.md para el detalle)

**2026-06-20:**
- 🔴 El texto de cada categoría se imprimía dentro de su propia burbuja y se desbordaba sobre la burbuja vecina, contaminando su lectura de densidad — causa raíz de que el Lector OMR pudiera detectar la categoría "complementaria" a la marcada. Corregido separando texto y burbuja por completo.
- Desalineación de densidades si una opción del `.omr` no tenía coordenadas (bug latente encontrado en auditoría, no reportado por el usuario pero corregido igual).
- Una sola variable categórica con una cantidad extrema de categorías podía desbordar el borde inferior de cualquier página sin que nada lo detectara.
- Nuevo: procesamiento por lotes (múltiples pacientes, una fila por paciente al exportar), carga por carpeta, y corrección manual editable desde la tabla de resultados.

**2026-06-19:**

- Tres reimplementaciones independientes de la matriz de burbujas → unificadas en una sola.
- Burbujas fuera del borde físico de la página con variables de 7+ categorías → ahora envuelven en varias filas, validado con tests.
- Límite de dígitos (antes silencioso, truncaba en 3 dígitos sin avisar) → ahora explícito (`MAX_INT_DIGITS`), rechazado con error claro si se excede.
- Variables Cuantitativa Continua perdían su decimal (`parseInt` truncaba) → ahora soportan hasta 2 decimales.
- `sanitize.js` escrito pero nunca usado en ninguna vista → conectado en las 4 vistas que interpolan datos del `.clinical`.
- Fuga de event listeners en el Lector OMR → exportaciones duplicadas al revisitar el paso → corregida.
- Botón "Volver a Impresión" del Lector OMR, que nunca funcionaba por un problema de orden de inicialización → corregido.
- `pxPerMm` fijo en 3.78 (solo válido a 96dpi exacto) → ahora se calibra dinámicamente por imagen usando las marcas de registro.
- Normalización de nombres de variable eliminaba tildes/ñ en vez de transliterarlas → corregido.
- Nombres de variable duplicados (incluso los creados por la propia normalización) → ahora se rechazan explícitamente.
- CSV exportado sin escapar comas/comillas → corregido.
- 6 usos de `alert()` (contradiciendo la regla explícita de `AGENT-GUIDE.md`) → reemplazados por el sistema de notificaciones.
- UI muerta del OMR Exporter (nunca montada en la navegación, y que además sobrescribía el contenedor del OMR Reader si alguna vez se hubiera llamado) → eliminada.

---

## Limitaciones Actuales (alcance honesto)

- **No hay corrección de inclinación/rotación** del escaneo. La calibración nueva corrige diferencias de DPI y pequeños desplazamientos de recorte usando las marcas de registro, pero si la hoja se escanea/fotografía torcida, la lectura puede ser imprecisa. Esto sigue siendo trabajo futuro (ver `docs/OMR-ROADMAP.md`).
- El Lector OMR sigue siendo un MVP: no hay corrección de ruido avanzada (manchas, sombras, dobleces del papel).
- **El procesamiento por lotes agrupa páginas por orden de nombre de archivo, no por contenido.** No hay ningún mecanismo (OCR, código de barras, número de paciente impreso) que confirme automáticamente que una imagen corresponde al paciente que se cree — depende de que el usuario nombre/ordene bien los archivos.
- Sin backend: los datos viven en memoria (los registros de pacientes procesados se pierden al recargar la página) y `localStorage` para el estado del Compilador/Importador, sin cifrado.
- Sin auditoría ni trazabilidad clínica (quién leyó/corrigió qué registro) más allá de la etiqueta `"source": "manual"` vs `"auto"` en el JSON exportado.
- Sin tests de integración E2E dentro de la suite de Vitest (se usan dos scripts de humo aparte con jsdom, `smoke-test.mjs` y `smoke-test-batch-ui.mjs`, que no forman parte de `npm test`).

---

## Documentación Disponible

- `AGENT-GUIDE.md` → Guía para agentes que continúan el proyecto
- `docs/ARCHITECTURE.md` → Arquitectura general
- `docs/OMR-ROADMAP.md` → Mejoras futuras del Lector OMR
- `docs/CLINICAL-FORMAT.md` → Contrato de compatibilidad con `.clinical`
- `CHANGELOG.md` → Detalle completo de esta revisión, problema por problema

---

## Recomendaciones

El proyecto está en buen estado para:

- Demostraciones y presentaciones
- Prototipado de flujos OMR
- Proyectos académicos o investigación pequeña

**No recomendado** para uso clínico real sin backend, cifrado de datos y auditoría — y, específicamente para el Lector OMR, sin antes validar su precisión contra escaneos reales (este entorno de desarrollo no permitió probarlo contra papel físico escaneado).
