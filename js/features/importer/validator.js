// js/features/importer/validator.js
// Validador estricto del formato .clinical (VarOps)
// Este archivo es CRÍTICO para mantener compatibilidad

import { MAX_INT_DIGITS } from '../../core/layout-engine.js';

export const CLINICAL_FORMAT_VERSION = "1.0";

const EXPECTED_TYPES = [
  "Nominal Dicotómica",
  "Nominal Politómica",
  "Ordinal",
  "Cuantitativa Discreta",
  "Cuantitativa Continua"
];

const SIMPLE_NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

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
  if (!data.project || typeof data.project !== 'object') {
    errors.push("project es obligatorio y debe ser un objeto.");
  } else if (!data.project.name || typeof data.project.name !== 'string') {
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
        const min = meta.range.min;
        const max = meta.range.max;

        if (min === '' || max === '') {
          errors.push(`${prefix}.metadata.range.min y .max son obligatorios.`);
        } else if (!SIMPLE_NUMBER_PATTERN.test(String(min).trim()) || !SIMPLE_NUMBER_PATTERN.test(String(max).trim())) {
          // Antes de esta corrección, valores como "1e10" o texto suelto
          // pasaban la validación y generaban un formulario imposible de
          // imprimir (miles de columnas de dígitos). Se exige notación
          // decimal simple.
          errors.push(`${prefix}.metadata.range.min y .max deben ser números simples (sin notación científica ni texto).`);
        } else {
          const minNum = parseFloat(min);
          const maxNum = parseFloat(max);

          if (isNaN(minNum) || isNaN(maxNum)) {
            errors.push(`${prefix}.metadata.range.min y .max deben ser valores numéricos.`);
          } else if (minNum > maxNum) {
            errors.push(`${prefix}.metadata.range.min no puede ser mayor que max.`);
          } else {
            const requiredIntDigits = Math.max(String(Math.trunc(Math.abs(maxNum))).length, 1);
            if (requiredIntDigits > MAX_INT_DIGITS) {
              errors.push(
                `${prefix}.metadata.range.max (${max}) requiere ${requiredIntDigits} dígitos enteros, ` +
                `más de los ${MAX_INT_DIGITS} que el formulario impreso puede representar. Reduce el rango.`
              );
            }
          }
        }
      }
    } else {
      if (!Array.isArray(meta.categories) || meta.categories.length === 0) {
        errors.push(`${prefix}.metadata.categories debe tener al menos una categoría.`);
      } else {
        const labels = meta.categories.map(c => (c.label || '').trim().toLowerCase());
        const uniqueLabels = new Set(labels);

        if (labels.length !== uniqueLabels.size) {
          errors.push(`${prefix}.metadata.categories tiene etiquetas duplicadas.`);
        }

        meta.categories.forEach((cat, cIndex) => {
          if (!cat.label || typeof cat.label !== 'string' || cat.label.trim() === '') {
            errors.push(`${prefix}.metadata.categories[${cIndex}].label es obligatorio.`);
          }
        });
      }
    }
  });

  // 4. Nombres de variable únicos en todo el archivo.
  // Antes de esta corrección, dos variables podían llamarse igual (o
  // quedar iguales después de normalizar tildes/mayúsculas) y la segunda
  // pisaba silenciosamente los datos de la primera en cualquier estructura
  // indexada por nombre (incluido el propio Lector OMR).
  const namesSeen = new Map();
  const duplicatedNames = new Set();
  data.variables.forEach(v => {
    if (!v.name || typeof v.name !== 'string') return;
    const key = v.name.trim().toLowerCase();
    if (!key) return;
    if (namesSeen.has(key)) duplicatedNames.add(v.name.trim());
    namesSeen.set(key, true);
  });
  if (duplicatedNames.size > 0) {
    errors.push(`Nombres de variable duplicados: ${Array.from(duplicatedNames).join(', ')}. Cada variable debe tener un nombre único.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}