// js/core/render-page.js
//
// Renderizador ÚNICO de páginas del formulario compilado. Tanto la vista en
// pantalla (form-compiler) como la ventana de impresión (printer) llaman a
// `renderPageHTML` con los mismos `blocks` que salieron del layout-engine.
// Esto es lo que garantiza que lo que el usuario ve en pantalla, lo que se
// imprime en papel y las coordenadas que se exportan en el .omr sean
// siempre el mismo número — no tres cálculos independientes como antes.
//
// Todas las posiciones se expresan en milímetros y se dibujan con
// `position:absolute` dentro de `.omr-page`, usando unidades CSS `mm`
// directamente. Esto evita depender del flujo de flexbox/fuentes del
// navegador para decidir dónde cae cada burbuja.

import { escapeHTML } from './sanitize.js';
import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_MM,
  REGISTRATION_MARK_SIZE_MM,
  REGISTRATION_MARK_OFFSET_MM,
  absoluteBlockBox,
  absoluteOptionBox,
  absoluteLabelBox,
  getHeaderHeightForPage
} from './layout-engine.js';

export const OMR_PAGE_CSS = `
.omr-page {
  position: relative;
  width: ${PAGE_WIDTH_MM}mm;
  height: ${PAGE_HEIGHT_MM}mm;
  background: #ffffff;
  margin: 0 auto 12mm auto;
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  overflow: hidden;
  font-family: Georgia, 'Times New Roman', serif;
  color: #0a0a0a;
}
.omr-registration-mark {
  position: absolute;
  width: ${REGISTRATION_MARK_SIZE_MM}mm;
  height: ${REGISTRATION_MARK_SIZE_MM}mm;
  border: 2px solid #000;
  background: #fff;
}
.omr-registration-mark--tl { top: ${REGISTRATION_MARK_OFFSET_MM}mm; left: ${REGISTRATION_MARK_OFFSET_MM}mm; }
.omr-registration-mark--tr { top: ${REGISTRATION_MARK_OFFSET_MM}mm; right: ${REGISTRATION_MARK_OFFSET_MM}mm; }
.omr-registration-mark--bl { bottom: ${REGISTRATION_MARK_OFFSET_MM}mm; left: ${REGISTRATION_MARK_OFFSET_MM}mm; }
.omr-registration-mark--br { bottom: ${REGISTRATION_MARK_OFFSET_MM}mm; right: ${REGISTRATION_MARK_OFFSET_MM}mm; }

.omr-page-meta {
  position: absolute;
  top: 8mm;
  right: ${MARGIN_MM + 6}mm;
  font-size: 7pt;
  color: #555;
  text-align: right;
  font-family: 'Courier New', monospace;
  line-height: 1.4;
}

.omr-header {
  position: absolute;
  top: ${MARGIN_MM}mm;
  left: ${MARGIN_MM}mm;
  width: ${PAGE_WIDTH_MM - MARGIN_MM * 2}mm;
  border-bottom: 1.5pt solid #000;
  padding-bottom: 4mm;
}
.omr-header h1 { font-size: 16pt; margin: 0 0 2mm 0; }
.omr-header-meta { font-size: 9pt; color: #444; }
.omr-header--continuation {
  position: absolute;
  top: ${MARGIN_MM}mm;
  left: ${MARGIN_MM}mm;
  width: ${PAGE_WIDTH_MM - MARGIN_MM * 2}mm;
  font-size: 9pt;
  color: #777;
  border-bottom: 0.5pt solid #ccc;
  padding-bottom: 2mm;
}

.omr-question { position: absolute; font-size: 10.5pt; font-weight: 700; line-height: 1.25; }
.omr-unit { font-weight: 400; font-size: 9pt; color: #555; }

.omr-option-label {
  position: absolute;
  font-size: 9.5pt;
  font-weight: 400;
  line-height: 1.15;
  display: flex;
  align-items: center;
  color: #0a0a0a;
}

.omr-bubble {
  position: absolute;
  border: 1.3pt solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6.5pt;
  font-family: 'Courier New', monospace;
  background: #fff;
  box-sizing: border-box;
}
.omr-bubble span { pointer-events: none; }

.omr-decimal-marker { position: absolute; font-size: 14pt; font-weight: 700; }
.omr-range-hint { position: absolute; font-size: 7.5pt; color: #555; }
.omr-page-number { position: absolute; bottom: 10mm; right: ${MARGIN_MM}mm; font-size: 8pt; color: #555; }

.omr-preview-scroll { overflow-x: auto; padding: 12px 0; }

@media print {
  body { margin: 0; background: #fff; }
  .omr-page { box-shadow: none; margin: 0; page-break-after: always; }
  .omr-page:last-child { page-break-after: auto; }
}
`;

// Posiciona el separador decimal a media altura de la columna de burbujas
// (alto de la pregunta + aprox. mitad de la columna de 10 burbujas).
const DECIMAL_MARKER_Y_OFFSET_MM = 7 + 22;

function renderBubble(option, block, extraClass = '', showInnerLabel = false) {
  const box = absoluteOptionBox(block, option);
  const inner = showInnerLabel ? `<span>${escapeHTML(String(option.label))}</span>` : '';
  return `<div class="omr-bubble ${extraClass}" style="left:${box.x_mm}mm; top:${box.y_mm}mm; width:${box.width_mm}mm; height:${box.height_mm}mm;">${inner}</div>`;
}

// Texto legible de una categoría, SEPARADO de su burbuja (ver nota en
// layout-engine.js: antes este texto se imprimía dentro de la propia
// burbuja, lo que contaminaba la lectura de densidad del Lector OMR).
function renderOptionLabel(option, block) {
  const labelBox = absoluteLabelBox(block, option);
  if (!labelBox) return '';
  return `<div class="omr-option-label" style="left:${labelBox.x_mm}mm; top:${labelBox.y_mm}mm; width:${labelBox.width_mm}mm; height:${labelBox.height_mm}mm;">${escapeHTML(String(option.label))}</div>`;
}

function renderBlock(block) {
  const box = absoluteBlockBox(block);
  const questionStyle = `left:${box.x_mm}mm; top:${box.y_mm}mm; width:${box.width_mm}mm;`;
  const unitLabel = block.unit ? ` <span class="omr-unit">(${escapeHTML(block.unit)})</span>` : '';

  let html = `<div class="omr-block" data-field="${escapeHTML(block.name)}">`;
  html += `<div class="omr-question" style="${questionStyle}">${escapeHTML(block.question)}${unitLabel}</div>`;

  if (block.isQuantitative) {
    html += block.options.map(opt => renderBubble(opt, block, 'omr-bubble--digit', true)).join('');

    if (block.digitConfig && block.digitConfig.decimalMarkerX_mm != null) {
      const headerHeight = getHeaderHeightForPage(block.page);
      const markerX = MARGIN_MM + block.x_mm + block.digitConfig.decimalMarkerX_mm;
      const markerY = MARGIN_MM + headerHeight + block.y_mm + DECIMAL_MARKER_Y_OFFSET_MM;
      html += `<div class="omr-decimal-marker" style="left:${markerX}mm; top:${markerY}mm;">,</div>`;
    }

    if (block.range) {
      const hintY = box.y_mm + box.height_mm - 5;
      const min = block.range.min ?? '?';
      const max = block.range.max ?? '?';
      html += `<div class="omr-range-hint" style="left:${box.x_mm}mm; top:${hintY}mm;">Rango permitido: ${escapeHTML(String(min))} – ${escapeHTML(String(max))}</div>`;
    }
  } else {
    html += block.options.map(opt => renderBubble(opt, block, '', false) + renderOptionLabel(opt, block)).join('');
  }

  html += `</div>`;
  return html;
}

export function renderPageHTML(pageNumber, blocksOnPage, project, formMeta) {
  const isFirst = pageNumber === 1;

  let html = `<div class="omr-page" data-page="${pageNumber}">`;
  html += `<div class="omr-registration-mark omr-registration-mark--tl"></div>`;
  html += `<div class="omr-registration-mark omr-registration-mark--tr"></div>`;
  html += `<div class="omr-registration-mark omr-registration-mark--bl"></div>`;
  html += `<div class="omr-registration-mark omr-registration-mark--br"></div>`;
  html += `<div class="omr-page-meta">ID: ${escapeHTML(String(formMeta.id || ''))}<br>v${escapeHTML(String(formMeta.version || 1))} · ${escapeHTML(String(formMeta.dateLabel || ''))}</div>`;

  if (isFirst) {
    html += `<div class="omr-header">
      <h1>${escapeHTML(project.name || 'Formulario Clínico')}</h1>
      <div class="omr-header-meta">${escapeHTML(project.specialty || '')}${project.specialty && project.date ? ' · ' : ''}${escapeHTML(project.date || '')}</div>
    </div>`;
  } else {
    html += `<div class="omr-header--continuation">${escapeHTML(project.name || '')}</div>`;
  }

  blocksOnPage.forEach(block => { html += renderBlock(block); });

  html += `<div class="omr-page-number">Página ${pageNumber} de ${formMeta.totalPages}</div>`;
  html += `</div>`;
  return html;
}
