// js/core/layout-engine.js
//
// FUENTE ÚNICA DE VERDAD para toda la geometría del formulario.
//
// Antes de esta reescritura, la posición de cada burbuja se calculaba TRES
// veces, en TRES archivos distintos (form-compiler/view.js, printer/service.js
// y omr-exporter/service.js), cada uno con sus propias constantes. Eso es lo
// que hacía que las coordenadas exportadas en el .omr no coincidieran con lo
// que realmente se imprimía, y que variables con muchas categorías generaran
// burbujas fuera del borde físico de la página (ver auditoría).
//
// Ahora SOLO este archivo decide dónde va cada burbuja, en milímetros,
// midiendo desde la esquina superior izquierda de la página. Tanto la vista
// en pantalla (form-compiler), la impresión (printer) como la exportación
// (.omr) consumen exactamente estos mismos números.
//
// Lo que este motor NO hace (alcance honesto):
// - No mide el DOM real renderizado por el navegador. Calcula el ancho de
//   cada etiqueta con una estimación conservadora de mm/carácter y reserva
//   espacio de más a propósito, para minimizar el riesgo de desborde real.
// - No corrige inclinación/rotación de escaneos (ver omr-reader/calibration.js
//   y docs/OMR-ROADMAP.md para el estado de esa parte).

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const MARGIN_MM = 20;
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2; // 170mm
export const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_MM * 2; // 257mm

export const HEADER_FIRST_PAGE_MM = 32;
export const HEADER_OTHER_PAGES_MM = 14;
export const FOOTER_MM = 10;

export const REGISTRATION_MARK_SIZE_MM = 6;
export const REGISTRATION_MARK_OFFSET_MM = 6;

// Techo de representación física. Una variable cuantitativa que necesite más
// dígitos enteros que esto NO se puede dibujar de forma fiable en la hoja —
// en vez de truncarla en silencio (como hacía el código anterior), se
// rechaza explícitamente en el compilador con un mensaje claro.
export const MAX_INT_DIGITS = 4;
export const MAX_DEC_DIGITS = 2;

const BUBBLE_DIAM_MM = 5;
const DIGIT_BUBBLE_GAP_MM = 1.6;
const DIGIT_COLUMN_WIDTH_MM = 9;
const DECIMAL_SEPARATOR_WIDTH_MM = 5;

const OPTION_MIN_WIDTH_MM = 24;
const OPTION_LABEL_CHAR_MM = 2.0; // sobreestimado a propósito (ver nota arriba)
const OPTION_ROW_GAP_MM = 4;
const OPTION_ROW_HEIGHT_MM = 9;
const BUBBLE_LABEL_GAP_MM = 2; // espacio entre la burbuja y el texto de su categoría

const QUESTION_HEIGHT_MM = 7;
const BLOCK_GAP_MM = 6;

/**
 * Calcula cuántos dígitos enteros/decimales necesita una variable
 * cuantitativa, y si excede lo que la hoja puede representar.
 */
export function getDigitConfig(variable) {
  const isContinuous = variable.type === 'Cuantitativa Continua';
  const maxRaw = variable?.metadata?.range?.max;
  const maxNum = parseFloat(maxRaw);

  const requiredIntDigits = Number.isFinite(maxNum)
    ? Math.max(String(Math.trunc(Math.abs(maxNum))).length, 1)
    : 3;

  const intDigits = Math.min(requiredIntDigits, MAX_INT_DIGITS);
  const overflow = requiredIntDigits > MAX_INT_DIGITS;

  let decDigits = 0;
  if (isContinuous) {
    const requested = variable?.metadata?.decimals;
    const requestedNum = Number.isInteger(requested) ? requested : 1; // 1 decimal por defecto
    decDigits = Math.min(Math.max(requestedNum, 0), MAX_DEC_DIGITS);
  }

  return { intDigits, decDigits, requiredIntDigits, overflow };
}

function layoutQuantitative(variable) {
  const { intDigits, decDigits, overflow, requiredIntDigits } = getDigitConfig(variable);

  const columns = [];
  let x = 0;
  for (let i = 0; i < intDigits; i++) {
    columns.push({ kind: 'int', position: i, x_mm: x });
    x += DIGIT_COLUMN_WIDTH_MM;
  }
  let decimalMarkerX_mm = null;
  if (decDigits > 0) {
    decimalMarkerX_mm = x;
    x += DECIMAL_SEPARATOR_WIDTH_MM;
  }
  for (let i = 0; i < decDigits; i++) {
    columns.push({ kind: 'dec', position: i, x_mm: x });
    x += DIGIT_COLUMN_WIDTH_MM;
  }

  const gridWidth_mm = x;
  const gridHeight_mm = 10 * (BUBBLE_DIAM_MM + DIGIT_BUBBLE_GAP_MM);

  const options = [];
  columns.forEach(col => {
    for (let d = 0; d <= 9; d++) {
      options.push({
        label: String(d),
        value: d,
        digitKind: col.kind,
        digitPosition: col.position,
        boundingBox: {
          x_mm: col.x_mm,
          y_mm: QUESTION_HEIGHT_MM + d * (BUBBLE_DIAM_MM + DIGIT_BUBBLE_GAP_MM),
          width_mm: BUBBLE_DIAM_MM,
          height_mm: BUBBLE_DIAM_MM
        }
      });
    }
  });

  return {
    options,
    width_mm: Math.min(gridWidth_mm, CONTENT_WIDTH_MM),
    height_mm: QUESTION_HEIGHT_MM + gridHeight_mm + 6,
    decimalMarkerX_mm,
    intDigits,
    decDigits,
    overflow,
    requiredIntDigits
  };
}

function layoutCategorical(categories) {
  const rows = [];
  let currentRow = [];
  let currentRowWidth = 0;

  categories.forEach(cat => {
    const label = String(cat.label ?? '');
    const itemWidth = Math.max(
      OPTION_MIN_WIDTH_MM,
      BUBBLE_DIAM_MM + BUBBLE_LABEL_GAP_MM + label.length * OPTION_LABEL_CHAR_MM
    );

    if (currentRow.length > 0 && currentRowWidth + itemWidth > CONTENT_WIDTH_MM) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }

    currentRow.push({ cat, width_mm: itemWidth });
    currentRowWidth += itemWidth + OPTION_ROW_GAP_MM;
  });
  if (currentRow.length > 0) rows.push(currentRow);

  const options = [];
  rows.forEach((row, rowIndex) => {
    let x = 0;
    const rowY = QUESTION_HEIGHT_MM + rowIndex * (OPTION_ROW_HEIGHT_MM + OPTION_ROW_GAP_MM);

    row.forEach(item => {
      const labelWidth = Math.max(item.width_mm - BUBBLE_DIAM_MM - BUBBLE_LABEL_GAP_MM, 4);

      options.push({
        label: item.cat.label,
        value: item.cat.label,
        // La burbuja en sí: SOLO el círculo, sin texto dentro. Antes
        // (bug encontrado el 2026-06-20) el nombre completo de la
        // categoría se imprimía dentro de este mismo círculo de 5mm —
        // como el texto es mucho más ancho que la burbuja, se
        // desbordaba visualmente sobre la burbuja vecina y contaminaba
        // su densidad de tinta. Por eso el Lector OMR podía terminar
        // marcando la categoría "complementaria" a la que realmente se
        // había rellenado a mano.
        boundingBox: {
          x_mm: x,
          y_mm: rowY,
          width_mm: BUBBLE_DIAM_MM,
          height_mm: BUBBLE_DIAM_MM
        },
        // Caja de texto, completamente separada de la burbuja y fuera
        // de cualquier región que el Lector OMR analice.
        labelBox: {
          x_mm: x + BUBBLE_DIAM_MM + BUBBLE_LABEL_GAP_MM,
          y_mm: rowY - 2,
          width_mm: labelWidth,
          height_mm: OPTION_ROW_HEIGHT_MM
        }
      });
      x += item.width_mm + OPTION_ROW_GAP_MM;
    });
  });

  return {
    options,
    height_mm: QUESTION_HEIGHT_MM + rows.length * (OPTION_ROW_HEIGHT_MM + OPTION_ROW_GAP_MM) + 4,
    rows: rows.length
  };
}

export function getHeaderHeightForPage(pageNumber) {
  return pageNumber === 1 ? HEADER_FIRST_PAGE_MM : HEADER_OTHER_PAGES_MM;
}

function toAbsoluteBox(block, relativeBox) {
  const headerHeight = getHeaderHeightForPage(block.page);
  return {
    x_mm: round2(MARGIN_MM + block.x_mm + relativeBox.x_mm),
    y_mm: round2(MARGIN_MM + headerHeight + block.y_mm + relativeBox.y_mm),
    width_mm: relativeBox.width_mm,
    height_mm: relativeBox.height_mm
  };
}

/**
 * Coordenadas absolutas (desde la esquina superior izquierda de la PÁGINA)
 * de la burbuja de una opción. Esta es la ÚNICA caja que el Lector OMR
 * debe analizar — nunca `labelBox`.
 */
export function absoluteOptionBox(block, option) {
  return toAbsoluteBox(block, option.boundingBox);
}

/**
 * Coordenadas absolutas del texto legible de una categoría (si existe).
 * Solo aplica a opciones cualitativas; las opciones de dígitos no tienen
 * `labelBox` porque su etiqueta (un solo carácter) se imprime dentro de
 * la propia burbuja sin riesgo de desborde.
 */
export function absoluteLabelBox(block, option) {
  if (!option.labelBox) return null;
  return toAbsoluteBox(block, option.labelBox);
}

export function absoluteBlockBox(block) {
  return toAbsoluteBox(block, { x_mm: 0, y_mm: 0, width_mm: block.width_mm, height_mm: block.height_mm });
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula la posición de cada variable (bloque) y cada una de sus burbujas,
 * paginando de forma determinista. Es la única función que decide cuándo
 * una variable salta a la página siguiente.
 */
export function computeLayout(variables) {
  const errors = [];
  const blocks = [];

  let page = 1;
  let cursorY_mm = 0;
  let available_mm = CONTENT_HEIGHT_MM - getHeaderHeightForPage(1) - FOOTER_MM;

  // El espacio disponible más grande que cualquier página puede ofrecer
  // (las páginas siguientes a la primera tienen un encabezado más bajo).
  // Si un solo bloque necesita más que esto, ninguna página lo puede
  // contener completo, sin importar dónde empiece — antes esto no se
  // comprobaba, y una variable categórica con muchas categorías (40-50+)
  // podía generar un bloque que se desbordaba por el borde inferior de la
  // página sin que nada lo detectara.
  const maxPossibleAvailable_mm = CONTENT_HEIGHT_MM - HEADER_OTHER_PAGES_MM - FOOTER_MM;

  variables.forEach((variable, index) => {
    const isQuantitative = variable.type.includes('Cuantitativa');
    let geometry;

    if (isQuantitative) {
      geometry = layoutQuantitative(variable);
      if (geometry.overflow) {
        errors.push(
          `La variable "${variable.name}" necesita ${geometry.requiredIntDigits} dígitos enteros para representar su rango (máx. ${variable?.metadata?.range?.max}), ` +
          `pero el formulario impreso solo admite hasta ${MAX_INT_DIGITS}. Reduce el rango o divide la variable en dos.`
        );
      }
    } else {
      const categories = variable?.metadata?.categories || [];
      geometry = layoutCategorical(categories);

      if (geometry.height_mm > maxPossibleAvailable_mm) {
        errors.push(
          `La variable "${variable.name}" tiene ${categories.length} categorías y necesita ${Math.ceil(geometry.height_mm)}mm de alto, ` +
          `más de lo que cabe en una sola página impresa (máx. ${Math.floor(maxPossibleAvailable_mm)}mm). ` +
          `Reduce la cantidad de categorías o divide la variable.`
        );
      }
    }

    const totalBlockHeight_mm = geometry.height_mm + BLOCK_GAP_MM;

    if (cursorY_mm > 0 && cursorY_mm + totalBlockHeight_mm > available_mm) {
      page += 1;
      cursorY_mm = 0;
      available_mm = CONTENT_HEIGHT_MM - getHeaderHeightForPage(page) - FOOTER_MM;
    }

    blocks.push({
      id: `block-${index}`,
      variableIndex: index,
      name: variable.name,
      type: variable.type,
      question: variable?.metadata?.question || variable.description || variable.name,
      unit: variable?.metadata?.unit || '',
      range: variable?.metadata?.range || null,
      isQuantitative,
      digitConfig: isQuantitative
        ? {
            intDigits: geometry.intDigits,
            decDigits: geometry.decDigits,
            decimalMarkerX_mm: geometry.decimalMarkerX_mm
          }
        : null,
      page,
      x_mm: 0,
      y_mm: cursorY_mm,
      width_mm: CONTENT_WIDTH_MM,
      height_mm: geometry.height_mm,
      options: geometry.options
    });

    cursorY_mm += totalBlockHeight_mm;
  });

  return {
    blocks,
    pages: Math.max(1, page),
    errors
  };
}
