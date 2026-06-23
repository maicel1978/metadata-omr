// js/features/omr-reader/validation.js
// Validación de coherencia de resultados (no técnica, orientada al usuario)

/**
 * Valida los resultados de detección y devuelve mensajes amigables.
 * @param {Array} results - Resultados crudos del OMRDetector
 * @returns {Array} - Resultados con posibles advertencias
 */
export function validateResults(results) {
  return results.map(result => {
    const warnings = [];

    // 1. Variables cualitativas: solo debe haber una opción seleccionada
    if (result.details && result.details.length > 0) {
      const selected = result.details.filter(d => d.isSelected);

      if (selected.length > 1) {
        warnings.push("Se detectaron múltiples marcas. Revisar manualmente.");
      }

      if (selected.length === 0 && result.confidence < 0.05) {
        warnings.push("No se detectó ninguna marca clara.");
      }
    }

    // 2. Variables cuantitativas: advertir si hay baja confianza
    if (result.variable && result.confidence < 0.12) {
      warnings.push("Baja confianza en la detección. Verificar valor.");
    }

    // 3. Si no se detectaron las marcas de registro de esta página con
    // claridad, la posición usada para leer las burbujas es una
    // estimación (ver calibration.js) — se avisa para que se revise
    // manualmente en vez de confiar ciegamente en el valor leído.
    if (result.calibrationConfidence === 'fallback-no-marks') {
      warnings.push("No se detectaron con claridad las marcas de registro de esta página; la posición usada es una estimación.");
    }

    return {
      ...result,
      warnings: warnings.length > 0 ? warnings : null,
      needsReview: warnings.length > 0
    };
  });
}

/**
 * Resumen agregado a través de TODOS los registros/pacientes procesados
 * en la sesión (lote). Útil cuando se procesan múltiples pacientes y se
 * quiere saber de un vistazo cuántas celdas necesitan revisión manual en
 * total, sin tener que abrir cada paciente uno por uno.
 *
 * `resolvedFn(record, variableName)` es opcional: si se pasa, permite
 * indicar que una variable marcada como "necesita revisión" ya fue
 * corregida manualmente (override) y por lo tanto no debe contarse como
 * pendiente.
 */
export function summarizeBatch(records, isOverriddenFn = () => false) {
  let totalFields = 0;
  let pendingReview = 0;

  records.forEach(record => {
    record.results.forEach(result => {
      totalFields++;
      if (result.needsReview && !isOverriddenFn(record, result.variable)) {
        pendingReview++;
      }
    });
  });

  return {
    totalPatients: records.length,
    totalFields,
    pendingReview,
    status: pendingReview === 0 ? 'success' : 'warning'
  };
}