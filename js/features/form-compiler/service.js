// js/features/form-compiler/service.js
// Motor principal del Form Compiler - Determinista y lineal
//
// La geometría (alturas, paginación, posición de cada burbuja) ya NO se
// calcula aquí: se delega por completo a core/layout-engine.js, que es la
// única fuente de verdad compartida también por printer/service.js y
// omr-exporter/service.js. Antes, este archivo tenía su propia tabla de
// alturas estimadas en píxeles, desconectada de lo que realmente se
// imprimía — ver CHANGELOG.md para el detalle del problema que esto
// resuelve.

import { computeLayout, PAGE_WIDTH_MM, PAGE_HEIGHT_MM } from '../../core/layout-engine.js';

// Validación de completitud de variable (usando metadatos del .clinical).
// Esta lógica no cambia: sigue decidiendo si una variable tiene todo lo
// necesario para ser compilada, independientemente de la geometría.
export function isVariableComplete(variable) {
  const { type, name, metadata } = variable;
  if (!metadata) return false;

  if (!name || name.trim() === '') return false;
  if (!metadata.question || metadata.question.trim() === '') return false;

  const isQuantitative = type.includes('Cuantitativa');

  if (isQuantitative) {
    if (!metadata.range) return false;

    const min = metadata.range.min;
    const max = metadata.range.max;

    if (min === '' || max === '') return false;

    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);

    if (isNaN(minNum) || isNaN(maxNum)) return false;
    if (minNum > maxNum) return false;

    return true;
  } else {
    if (!Array.isArray(metadata.categories) || metadata.categories.length === 0) {
      return false;
    }

    const hasValidLabels = metadata.categories.every(cat =>
      cat.label && cat.label.trim() !== ''
    );

    const labels = metadata.categories.map(c => c.label.trim().toLowerCase());
    const hasDuplicates = labels.length !== new Set(labels).size;

    return hasValidLabels && !hasDuplicates;
  }
}

export function validateBeforeCompile(variables) {
  const incomplete = variables.filter(v => !isVariableComplete(v));
  return {
    isValid: incomplete.length === 0,
    incompleteCount: incomplete.length,
    incompleteVariables: incomplete.map(v => v.name)
  };
}

const MAX_RECOMMENDED_PAGES = 3;

export function compileForm(variables) {
  const validation = validateBeforeCompile(variables);
  if (!validation.isValid) {
    throw new Error(
      `No se puede compilar el formulario. Variables incompletas: ${validation.incompleteVariables.join(', ')}`
    );
  }

  const layout = computeLayout(variables);

  // Antes, una variable que excedía el ancho de la página (muchas
  // categorías) o el número de dígitos representables (rango muy grande)
  // generaba coordenadas inválidas EN SILENCIO. Ahora el motor de layout
  // detecta esos casos y se rechaza la compilación con un mensaje claro.
  if (layout.errors.length > 0) {
    throw new Error(layout.errors.join(' '));
  }

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'form-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
  };

  if (layout.pages > MAX_RECOMMENDED_PAGES) {
    console.warn(
      `[Form Compiler] ADVERTENCIA: El formulario tiene ${layout.pages} páginas. ` +
      `Se recomienda máximo ${MAX_RECOMMENDED_PAGES} páginas para mejor escaneo OMR.`
    );
  }

  // omrRegions ya no se calcula por separado (antes era un stub que
  // siempre devolvía []) — es simplemente la lista plana de las burbujas
  // que el layout-engine ya calculó para cada bloque.
  const omrRegions = layout.blocks.flatMap(block =>
    block.options.map(opt => ({ blockId: block.id, variable: block.name, ...opt }))
  );

  return {
    id: generateId(),
    version: 1,
    compiledAt: new Date().toISOString(),
    blocks: layout.blocks,
    pages: layout.pages,
    variablesCount: variables.length,
    omrRegions,
    pageWidthMM: PAGE_WIDTH_MM,
    pageHeightMM: PAGE_HEIGHT_MM
  };
}

export function getBlocksByPage(blocks, page) {
  return blocks.filter(b => b.page === page);
}
