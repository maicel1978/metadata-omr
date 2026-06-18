# Clinical OMR Suite - Roadmap del Lector OMR

## Objetivo

Este documento describe las áreas de mejora del módulo **OMR Reader** para que cualquier agente o desarrollador pueda continuar el proyecto de forma precisa.

---

## Estado Actual (MVP)

- Detección basada en **densidad de píxeles oscuros**.
- Umbral fijo (`0.12`).
- Soporte para **burbujas** (radio buttons).
- Soporte para **variables cuantitativas** con hasta 3 dígitos.
- Vista de debug con bounding boxes (verde = detectado, rojo = no detectado).
- Exportación a JSON y CSV.

---

## Áreas de Mejora Recomendadas

### 1. **Resistencia al Ruido (Anti-Noise)**

**Problema actual**: Manchas, polvo, marcas de lápiz o impresora afectan la densidad.

**Posibles soluciones**:
- Aplicar un filtro de mediana o gaussiano antes del análisis.
- Usar percentiles en lugar de promedio simple.
- Ignorar píxeles aislados (ruido).
- Umbral adaptativo por imagen.

**Archivo recomendado**: `js/features/omr-reader/detection.js`

---

### 2. **Corrección de Inclinación (Deskew)**

**Problema actual**: El formulario puede estar ligeramente girado al escanear.

**Posibles soluciones**:
- Detectar las **registration marks** (las 4 esquinas negras).
- Calcular el ángulo de rotación usando las marcas.
- Rotar la imagen antes del análisis usando Canvas.
- Usar Hough Transform simple (líneas).

**Archivo recomendado**: `js/features/omr-reader/detection.js` o nuevo archivo `deskew.js`.

---

### 3. **Calibración Automática del Umbral**

**Problema actual**: El umbral es fijo (`0.12`).

**Posibles soluciones**:
- Analizar la distribución de densidades de todas las burbujas.
- Usar clustering (k-means simple) o método de Otsu.
- Calibrar por página (no por formulario completo).

---

### 4. **Manejo de Escaneos de Baja Calidad**

**Problema actual**: Imágenes con baja resolución, contraste pobre o sombras.

**Posibles soluciones**:
- Normalizar histograma de la imagen.
- Convertir a escala de grises con pesos específicos.
- Aplicar sharpening suave.
- Detectar si la imagen tiene baja calidad y avisar al usuario.

---

### 5. **Soporte para Múltiples Páginas**

**Estado actual**: Funciona, pero la interfaz es básica.

**Mejoras recomendadas**:
- Mostrar miniaturas de cada página.
- Permitir procesar página por página.
- Mostrar resultados por página.
- Validar que el número de páginas coincida con la plantilla `.omr`.

---

### 6. **Validación de Coherencia de Resultados**

**Idea**: Después de la detección, aplicar reglas lógicas:

- Si una variable dicotómica tiene dos opciones marcadas → marcar como error.
- Si una variable cuantitativa de 3 dígitos tiene inconsistencias → alertar.
- Detectar posibles marcas dobles.

---

### 7. **Exportación Mejorada**

- Exportar también las **imágenes recortadas** de cada burbuja (útil para auditoría).
- Generar un reporte visual con las detecciones.
- Exportar en formato compatible con sistemas de investigación (ej: REDCap, SPSS).

---

## Recomendaciones de Implementación

1. **Mantener** la separación entre:
   - `detection.js` (motor puro)
   - `service.js` (orquestación)
   - `view.js` (interfaz)

2. **Nunca** modificar el archivo `.omr` desde el lector (es solo de lectura).

3. **Siempre** documentar cambios en este archivo (`OMR-ROADMAP.md`).

4. Priorizar **robustez** sobre velocidad.

---

## Próximas Mejoras Sugeridas (Orden Recomendado)

| Prioridad | Mejora | Dificultad | Impacto |
|-----------|--------|------------|--------|
| Alta | Umbral adaptativo | Media | Alto |
| Alta | Corrección de inclinación | Alta | Muy Alto |
| Media | Filtro anti-ruido | Media | Alto |
| Media | Soporte multi-página mejorado | Baja | Medio |
| Baja | Validación de coherencia | Media | Medio |

---

**Este documento debe mantenerse actualizado por cualquier agente que trabaje en el módulo OMR Reader.**