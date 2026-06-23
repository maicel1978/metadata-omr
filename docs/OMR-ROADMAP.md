# Clinical OMR Suite - Roadmap del Lector OMR

## Objetivo

Este documento describe las áreas de mejora del módulo **OMR Reader** para que cualquier agente o desarrollador pueda continuar el proyecto de forma precisa.

**Nota de esta revisión**: varios puntos de este roadmap ya estaban implementados en el código (umbral adaptativo) sin que este documento se hubiera actualizado, y uno de los puntos más importantes — la calibración geométrica — tenía un problema más profundo de lo que "corrección de inclinación" sugiere: ni siquiera la escala/DPI se ajustaba a la imagen real. Eso se corrigió parcialmente en esta revisión (ver abajo). Mantener este documento sincronizado con el código es responsabilidad de quien lo modifique.

**Actualización 2026-06-20**: se corrigió un bug crítico de detección (el texto de cada categoría se imprimía dentro de su propia burbuja y contaminaba la lectura de la burbuja vecina — ver `CHANGELOG.md`). En la misma revisión se agregó procesamiento por lotes (múltiples pacientes) y corrección manual editable desde la interfaz — ver las secciones 4 y 5 actualizadas más abajo.

---

## Estado Actual

- Detección basada en **densidad de píxeles oscuros**, sobre burbujas que ahora están SIEMPRE limpias (sin texto propio dentro) para las opciones cualitativas — el texto vive en su propio recuadro, separado, calculado por `core/layout-engine.js`.
- Umbral **adaptativo** (Otsu simplificado sobre las densidades de cada variable) + piso absoluto de tinta para evitar falsos positivos en preguntas en blanco. Estrategia `fixed` disponible como alternativa (`Strategy Pattern`).
- Soporte para **burbujas** (radio buttons) y variables cuantitativas con hasta `MAX_INT_DIGITS` dígitos enteros y `MAX_DEC_DIGITS` decimales (ver `js/core/layout-engine.js`).
- **Calibración de escala/desplazamiento por marcas de registro** (`js/features/omr-reader/calibration.js`): antes la conversión mm→px usaba una constante fija que solo era correcta a 96dpi exactos; ahora se detecta el centroide de las 4 marcas de registro y se deriva la escala real de cada imagen. Si no se detectan con confianza, se cae a una escala de respaldo y el resultado se marca para revisión manual.
- Vista de debug con bounding boxes (verde = detectado, rojo = no detectado) — **ahora sí dibuja algo**: antes, los resultados de detección no incluían su propio bounding box, así que esta vista nunca tenía nada que mostrar pese a estar documentada como funcional.
- **Procesamiento por lotes**: si se sube un múltiplo exacto de las páginas esperadas por paciente, se procesan varios pacientes de una vez, cada uno como un registro/fila independiente. Se puede seguir agregando más pacientes en llamadas posteriores sin perder lo ya procesado. Carga por carpeta disponible (`webkitdirectory`).
- **Corrección manual**: cualquier celda de la tabla de resultados se puede editar directamente (✎), con prioridad sobre el valor automático al exportar, y se puede deshacer (↩).
- Exportación a JSON y CSV (con escape correcto de comas/comillas), una fila por paciente.

---

## Áreas de Mejora Pendientes

### 1. Corrección de Inclinación/Rotación (Deskew) — **sigue pendiente**

**Problema actual**: la calibración nueva corrige diferencias de escala (DPI) y desplazamiento (recorte), comparando la posición esperada de cada marca de registro contra su posición real — pero asume que las 4 marcas forman un rectángulo no rotado. Si la hoja se escaneó/fotografió torcida, la lectura puede ser imprecisa.

**Posibles soluciones**:
- Con las 4 esquinas ya detectadas (`calibration.js` ya las encuentra), calcular el ángulo de rotación a partir de la diferencia de altura entre las marcas izquierda/derecha.
- Rotar la imagen en el canvas antes del análisis (`ctx.rotate`) o usar una transformación de perspectiva completa (homografía) con las 4 esquinas en vez de solo escala+desplazamiento.

**Archivo recomendado**: `js/features/omr-reader/calibration.js` (ya tiene las 4 esquinas detectadas; falta usarlas para algo más que escala/offset).

---

### 2. Resistencia al Ruido (Anti-Noise)

**Problema actual**: Manchas, polvo, sombras o dobleces del papel afectan la densidad medida. El piso absoluto de tinta (`MIN_INK_DENSITY` en `detection.js`) mitiga falsos positivos en preguntas en blanco, pero no filtra ruido localizado dentro de una burbuja.

**Posibles soluciones**:
- Aplicar un filtro de mediana antes del análisis.
- Ignorar píxeles aislados (ruido) vs. manchas conectadas grandes.
- Normalizar histograma/contraste de la imagen completa antes de medir densidades.

**Archivo recomendado**: `js/features/omr-reader/detection.js`

---

### 3. Manejo de Escaneos de Baja Calidad

**Posibles soluciones**:
- Detectar si la imagen tiene baja resolución relativa a `PAGE_WIDTH_MM`/`PAGE_HEIGHT_MM` y avisar antes de procesar.
- Aplicar sharpening suave.

---

### 4. Soporte para Múltiples Páginas y Múltiples Pacientes

**Estado actual**: hay dos conceptos distintos, ambos implementados:
- **Páginas de un mismo paciente** (cuando el formulario no entra en una sola hoja): se emparejan por orden dentro de su grupo.
- **Pacientes distintos en un mismo lote** (nuevo, 2026-06-20): si se sube un múltiplo de la cantidad de páginas por paciente, se agrupan automáticamente en pacientes consecutivos, ordenados por nombre de archivo (orden natural).

En ambos casos, el agrupamiento depende del **nombre/orden de subida del archivo**, no de su contenido — sigue siendo la limitación principal.

**Mejoras recomendadas**:
- Mostrar miniaturas de cada imagen antes de procesar, agrupadas visualmente por paciente, para que el usuario confirme el agrupamiento antes de pulsar "Procesar".
- Leer el "ID/versión" impreso en cada página (`omr-page-meta` en el HTML impreso) y hacer OCR simple o detección de patrón para confirmar automáticamente qué página es cuál — esto eliminaría la dependencia del nombre de archivo.
- Si se implementa el punto anterior, también permitiría detectar páginas faltantes o duplicadas dentro de un mismo paciente, no solo la cantidad total.

---

### 5. Validación de Coherencia de Resultados — parcialmente implementado

**Ya implementado** (`validation.js`): marcas múltiples, baja confianza, calibración no detectada — y, desde 2026-06-20, una forma real de **corregir** lo marcado para revisión directamente en la tabla de resultados (✎ por celda, con prioridad sobre el valor automático al exportar), no solo un aviso de texto.

**Pendiente**:
- Si una variable cuantitativa de varios dígitos tiene columnas con cero o más de una marca, hoy cada dígito se evalúa de forma independiente — podría detectarse como inconsistencia de número completo (p. ej. unidades marcada pero decenas vacía).
- La edición manual actual es un campo de texto libre; para variables cualitativas podría ser más seguro usar un `<select>` con las categorías válidas de esa variable (evita errores de tipeo al corregir a mano), y para cuantitativas podría validarse contra el rango de la variable antes de guardar el override.

---

### 6. Exportación Mejorada

- Exportar también las **imágenes recortadas** de cada burbuja (útil para auditoría).
- Generar un reporte visual con las detecciones.
- Exportar en formato compatible con sistemas de investigación (ej: REDCap, SPSS).

---

## Recomendaciones de Implementación

1. **Mantener** la separación entre:
   - `detection.js` (motor puro de densidad/umbral)
   - `calibration.js` (geometría: escala/desplazamiento, y en el futuro, rotación)
   - `service.js` (orquestación)
   - `view.js` (interfaz)

2. **Nunca** modificar el archivo `.omr` desde el lector (es solo de lectura). Las coordenadas del `.omr` deben seguir viniendo siempre de `js/core/layout-engine.js` — no recalcularlas en ningún otro lugar (ese fue precisamente el bug central corregido en la revisión de 2026-06-19, ver `CHANGELOG.md`).

3. **Siempre** documentar cambios en este archivo (`OMR-ROADMAP.md`) Y en `CURRENT-STATUS.md` — la falta de sincronización entre documentación y código fue, en sí misma, uno de los hallazgos de la auditoría.

4. Priorizar **robustez** sobre velocidad.

---

## Próximas Mejoras Sugeridas (Orden Recomendado)

| Prioridad | Mejora | Dificultad | Impacto |
|-----------|--------|------------|--------|
| Alta | Corrección de inclinación/rotación (deskew real, con homografía) | Alta | Muy Alto |
| Media | Filtro anti-ruido localizado | Media | Alto |
| Media | OCR/patrón para confirmar automáticamente qué página/paciente es cada imagen (en vez de depender del nombre de archivo) | Alta | Alto |
| Media | Miniaturas + confirmación visual de agrupamiento de pacientes antes de procesar | Baja | Medio |
| Baja | Validación de coherencia entre dígitos de una misma variable | Media | Medio |
| Baja | Corrección manual con `<select>` validado contra categorías válidas, en vez de texto libre | Baja | Medio |
| Baja | Exportación con imágenes recortadas para auditoría | Media | Bajo |

---

**Este documento debe mantenerse actualizado por cualquier agente que trabaje en el módulo OMR Reader.**
