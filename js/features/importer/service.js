// js/features/importer/service.js
// Lógica de lectura y validación de archivos .clinical

import { validateClinicalStructure } from './validator.js';

export function validateClinicalFile(data) {
  const result = validateClinicalStructure(data);
  
  if (!result.isValid) {
    console.error("[Clinical Validator] Errores de compatibilidad:", result.errors);
  }
  
  return result.isValid;
}

export function parseClinicalFile(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (validateClinicalFile(data)) {
      // Normalizar nombres de variables al importar
      data.variables = data.variables.map(v => ({
        ...v,
        name: normalizeVariableName(v.name)
      }));
      return data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Normalizar nombre de variable
function normalizeVariableName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}