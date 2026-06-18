// js/features/importer/validator.js
// Validador estricto del formato .clinical (VarOps)
// Este archivo es CRÍTICO para mantener compatibilidad

export const CLINICAL_FORMAT_VERSION = "1.0";

const EXPECTED_TYPES = [
  "Nominal Dicotómica",
  "Nominal Politómica",
  "Ordinal",
  "Cuantitativa Discreta",
  "Cuantitativa Continua"
];

export function validateClinicalStructure(data) {
  const errors = [];

  // 1. Estructura básica
  if (!data || typeof data !== 'object') {
    errors.push("El archivo no es un objeto JSON válido.");
    return { isValid: false, errors };
  }

  if (!data.project || typeof data.project !== 'object') {
    errors.push("Falta el campo 'project'.");
  }

  if (!data.variables || !Array.isArray(data.variables)) {
    errors.push("Falta el campo 'variables' o no es un array.");
    return { isValid: false, errors };
  }

  // 2. Validar project
  if (!data.project.name || typeof data.project.name !== 'string') {
    errors.push("project.name es obligatorio y debe ser string.");
  }

  // 3. Validar cada variable
  data.variables.forEach((variable, index) => {
    const prefix = `variables[${index}]`;

    if (!variable.name || typeof variable.name !== 'string') {
      errors.push(`${prefix}.name es obligatorio.`);
    }

    if (!variable.type || !EXPECTED_TYPES.includes(variable.type)) {
      errors.push(`${prefix}.type debe ser uno de: ${EXPECTED_TYPES.join(", ")}`);
    }

    if (!variable.metadata || typeof variable.metadata !== 'object') {
      errors.push(`${prefix}.metadata es obligatorio.`);
      return;
    }

    const meta = variable.metadata;

    if (!meta.question || typeof meta.question !== 'string' || meta.question.trim() === '') {
      errors.push(`${prefix}.metadata.question es obligatorio.`);
    }

    const isQuantitative = variable.type.includes('Cuantitativa');

    if (isQuantitative) {
      if (!meta.range || typeof meta.range !== 'object') {
        errors.push(`${prefix}.metadata.range es obligatorio para variables cuantitativas.`);
      } else {
        if (meta.range.min === '' || meta.range.max === '') {
          errors.push(`${prefix}.metadata.range.min y .max son obligatorios.`);
        }
      }
    } else {
      if (!Array.isArray(meta.categories) || meta.categories.length === 0) {
        errors.push(`${prefix}.metadata.categories debe tener al menos una categoría.`);
      } else {
        meta.categories.forEach((cat, cIndex) => {
          if (!cat.label || typeof cat.label !== 'string' || cat.label.trim() === '') {
            errors.push(`${prefix}.metadata.categories[${cIndex}].label es obligatorio.`);
          }
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}