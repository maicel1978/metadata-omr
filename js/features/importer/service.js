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

/**
 * Parsea y valida un archivo .clinical.
 *
 * Antes de esta corrección, esta función devolvía simplemente `null` ante
 * cualquier fallo (JSON corrupto, estructura inválida, etc.), descartando
 * por completo los errores detallados que el validador ya había calculado.
 * El usuario solo veía "archivo inválido" sin ninguna pista de qué corregir.
 *
 * Ahora devuelve siempre `{ data, errors }`: si `errors` está vacío, `data`
 * contiene el archivo ya normalizado y listo para usar.
 */
export function parseClinicalFile(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return { data: null, errors: ['El archivo no contiene JSON válido.'] };
  }

  const structural = validateClinicalStructure(data);
  if (!structural.isValid) {
    return { data: null, errors: structural.errors };
  }

  const normalizedVariables = data.variables.map(v => ({
    ...v,
    name: normalizeVariableName(v.name)
  }));

  const duplicates = findDuplicateNormalizedNames(normalizedVariables);
  if (duplicates.length > 0) {
    return {
      data: null,
      errors: duplicates.map(name =>
        `El nombre de variable "${name}" queda duplicado después de normalizar (revisa tildes, mayúsculas o espacios en el archivo original).`
      )
    };
  }

  return { data: { ...data, variables: normalizedVariables }, errors: [] };
}

function findDuplicateNormalizedNames(variables) {
  const seen = new Map();
  const dups = new Set();
  variables.forEach(v => {
    if (seen.has(v.name)) dups.add(v.name);
    seen.set(v.name, true);
  });
  return Array.from(dups);
}

// Normaliza el nombre de una variable a snake_case ASCII.
//
// Antes: `.replace(/[^a-z0-9_]/g, '')` ELIMINABA cualquier tilde o "ñ" en
// vez de transliterarla, así que "tensión" se convertía en "tensin" y
// "niño" en "nio". Ahora se descompone Unicode (NFD) y se quitan solo las
// marcas diacríticas, conservando la letra base: "tensión" -> "tension".
function normalizeVariableName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
