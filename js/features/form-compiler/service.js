// js/features/form-compiler/service.js
// Motor principal del Form Compiler - Determinista y lineal

const BLOCK_HEIGHTS = {
  'Nominal Dicotómica': 40,
  'Nominal Politómica': 95,
  'Ordinal': 85,
  'Cuantitativa Discreta': 42,
  'Cuantitativa Continua': 42
};

// Configuración de representación OMR para variables cuantitativas
const QUANTITATIVE_OMR_CONFIG = {
  maxBubblesDirect: 30,        // Máximo para mostrar burbujas individuales
  digitBubbles: 10,            // 0-9 para formato de dígitos
  maxRecommendedPages: 3,      // Límite recomendado de páginas
  maxDigits: 3                 // Soporte hasta 3 dígitos (0-999)
};

// Constantes de conversión (deben declararse primero)
const PX_TO_MM = 3.78;
const SAFETY_MARGIN_MM = 18; // Margen de seguridad en mm

const A4_CONTENT_HEIGHT_PX = 257 * PX_TO_MM;
const SAFETY_MARGIN_PX = SAFETY_MARGIN_MM * PX_TO_MM;

// Validación de completitud de variable (usando metadatos del .clinical)
export function isVariableComplete(variable) {
  const { type, name, metadata } = variable;
  if (!metadata) return false;

  // Validaciones básicas
  if (!name || name.trim() === '') return false;
  if (!metadata.question || metadata.question.trim() === '') return false;

  const isQuantitative = type.includes('Cuantitativa');

  if (isQuantitative) {
    return (
      metadata.range &&
      metadata.range.min !== '' &&
      metadata.range.max !== '' &&
      parseFloat(metadata.range.min) <= parseFloat(metadata.range.max)
    );
  } else {
    // Validación de categorías
    if (!Array.isArray(metadata.categories) || metadata.categories.length === 0) {
      return false;
    }
    
    // Validar que todas las categorías tengan label válido
    const hasValidLabels = metadata.categories.every(cat => 
      cat.label && cat.label.trim() !== ''
    );
    
    // Validar que no haya labels duplicados
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

export function compileForm(variables) {
  // Validación previa obligatoria
  const validation = validateBeforeCompile(variables);
  if (!validation.isValid) {
    throw new Error(
      `No se puede compilar el formulario. Variables incompletas: ${validation.incompleteVariables.join(', ')}`
    );
  }

  let currentPage = 1;
  let currentHeight = 0;
  const blocks = [];

  variables.forEach((variable, index) => {
    const type = variable.type;
    let height = BLOCK_HEIGHTS[type] || 50;

    // Ajuste por politómica (más opciones = más altura)
    if (type === 'Nominal Politómica') {
      const catCount = variable.metadata?.categories?.length || 3;
      height = Math.min(70 + (catCount * 18), 130);
    }

    // Ajuste de altura para variables cuantitativas (más conservador)
    if (type.includes('Cuantitativa')) {
      const range = variable.metadata?.range;
      if (range && range.min !== '' && range.max !== '') {
        const max = parseInt(range.max);
        if (max <= QUANTITATIVE_OMR_CONFIG.maxBubblesDirect) {
          height = 75; // Burbujas individuales
        } else if (max <= 99) {
          height = 95; // 2 dígitos (más espacio)
        } else {
          height = 115; // 3 dígitos (más espacio)
        }
      }
    }

    // Verificar si necesita nueva página (con margen de seguridad)
    if (currentHeight + height > (A4_CONTENT_HEIGHT_PX - SAFETY_MARGIN_PX) && currentHeight > 0) {
      currentPage++;
      currentHeight = 0;
    }

    const block = {
      id: `block-${index}`,
      variableIndex: index,
      name: variable.name,
      type: type,
      question: variable.metadata?.question || variable.description || variable.name,
      height: height,
      page: currentPage,
      metadata: variable.metadata
    };

    blocks.push(block);
    currentHeight += height;
  });

  const totalPages = Math.max(1, currentPage);

  // Advertencia de paginación excesiva (control de composición)
  if (totalPages > QUANTITATIVE_OMR_CONFIG.maxRecommendedPages) {
    console.warn(
      `[Form Compiler] ADVERTENCIA: El formulario tiene ${totalPages} páginas. ` +
      `Se recomienda máximo ${QUANTITATIVE_OMR_CONFIG.maxRecommendedPages} páginas para mejor escaneo OMR.`
    );
  }

  // Generar ID único con fallback
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback para navegadores antiguos
    return 'form-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  };

  return {
    id: generateId(),
    version: 1,
    compiledAt: new Date().toISOString(),
    blocks,
    pages: totalPages,
    totalHeight: currentHeight,
    variablesCount: variables.length,
    omrRegions: []
  };
}

export function getBlocksByPage(blocks, page) {
  return blocks.filter(b => b.page === page);
}