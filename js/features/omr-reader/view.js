// js/features/omr-reader/view.js
// Vista del OMR Reader con Canvas, Debug Visual y tabla de resultados
// por lote (múltiples pacientes).
//
// Revisión 2026-06-20:
// - Se agrega un botón de carga de carpeta completa (además del selector
//   de archivos múltiple de siempre, que NO se quita).
// - Los resultados ahora se muestran como una tabla Pacientes × Variables
//   (antes era una sola tabla con una fila por variable, pensada para un
//   único paciente). Las celdas marcadas para revisión manual se pueden
//   corregir directamente desde esta tabla.

import { createElement, appendChildren, clearElement } from '../../core/dom.js';
import { escapeHTML } from '../../core/sanitize.js';

export class OMRReaderView {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.currentImage = null;
  }

  render() {
    clearElement(this.container);

    const wrapper = createElement('div', '', {
      style: 'padding: 20px; max-width: 1200px; margin: 0 auto;'
    });

    const title = createElement('h2', '', {
      text: 'Lector OMR',
      style: 'margin-bottom: 8px;'
    });

    const subtitle = createElement('p', '', {
      text: 'Carga una plantilla .omr y las imágenes escaneadas. Puedes procesar un paciente o un lote de varios a la vez.',
      style: 'color: #64748b; margin-bottom: 24px;'
    });

    const uploadSection = this.createUploadSection();
    const debugSection = this.createDebugSection();
    const resultsSection = this.createResultsSection();

    appendChildren(wrapper, title, subtitle, uploadSection, debugSection, resultsSection);
    appendChildren(this.container, wrapper);
  }

  createUploadSection() {
    const section = createElement('div', '', {
      style: 'display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; margin-bottom: 30px;'
    });

    const omrBox = createElement('div', '', {
      style: 'border: 2px dashed #cbd5e1; padding: 20px; border-radius: 12px;'
    });
    omrBox.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">1. Plantilla OMR (.omr)</div>
      <input type="file" id="omr-file" accept=".omr" style="margin-bottom:10px;">
      <div id="omr-status" style="font-size:12px; color:#64748b;">Sin cargar</div>
    `;

    const imgBox = createElement('div', '', {
      style: 'border: 2px dashed #cbd5e1; padding: 20px; border-radius: 12px;'
    });
    imgBox.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">2. Imágenes escaneadas (PNG/JPG)</div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
        <input type="file" id="images-file" accept="image/*" multiple style="max-width:260px;">
        <button id="folder-btn" type="button" class="btn btn-secondary" style="font-size:12px; padding:6px 12px;">📁 Cargar carpeta</button>
        <input type="file" id="folder-file" accept="image/*" multiple webkitdirectory style="display:none;">
      </div>
      <div id="images-status" style="font-size:12px; color:#64748b;">0 imágenes cargadas</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
        Las imágenes se ordenan por nombre de archivo antes de agruparlas — nómbralas de forma que ese orden coincida con el real
        (ej: <code>paciente01_pag1.jpg</code>, <code>paciente01_pag2.jpg</code>, <code>paciente02_pag1.jpg</code>...).
        Si subes un múltiplo exacto de las páginas del formulario, cada grupo se procesa como un paciente distinto.
      </div>
    `;

    appendChildren(section, omrBox, imgBox);
    return section;
  }

  createDebugSection() {
    const section = createElement('div', '', { style: 'margin-bottom: 30px;' });

    const header = createElement('div', '', {
      style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;'
    });
    header.innerHTML = `
      <div>
        <div style="font-weight:600;">3. Vista de Detección (Debug)</div>
        <div id="batch-hint" style="font-size:11px; color:#94a3b8; margin-top:2px;"></div>
      </div>
      <button id="process-btn" class="btn btn-primary" disabled>Procesar</button>
    `;

    const canvasContainer = createElement('div', '', {
      style: 'border: 1px solid #e2e8f0; background:#fff; padding:10px; border-radius:8px; position:relative;'
    });

    this.canvas = createElement('canvas', '', {
      width: '800',
      height: '600',
      style: 'max-width:100%; border:1px solid #ddd; display:block;'
    });
    this.ctx = this.canvas.getContext('2d');

    this.loadingMessage = createElement('div', '', {
      style: 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(255,255,255,0.9); padding:12px 24px; border-radius:6px; font-size:14px; color:#334155; display:none;'
    });
    this.loadingMessage.textContent = 'Procesando imágenes...';

    appendChildren(canvasContainer, this.canvas, this.loadingMessage);
    appendChildren(section, header, canvasContainer);

    return section;
  }

  createResultsSection() {
    const section = createElement('div', '', {
      id: 'results-section',
      style: 'display:none; margin-top:30px;'
    });

    section.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div style="font-weight:600;">4. Resultados (un paciente por fila)</div>
        <div id="batch-summary" style="font-size:12px; color:#64748b;"></div>
      </div>

      <div id="results-content" style="background:#f8fafc; padding:0; border-radius:8px; overflow-x:auto; border:1px solid #e2e8f0;"></div>

      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        <button id="export-json" class="btn btn-secondary" disabled>Exportar JSON</button>
        <button id="export-csv" class="btn btn-secondary" disabled>Exportar CSV</button>
        <button id="reset-btn" class="btn btn-secondary">Reiniciar todo</button>
      </div>
      <div style="font-size:11px; color:#94a3b8; margin-top:6px;">
        Para agregar más pacientes: carga nuevas imágenes arriba y pulsa "Procesar" otra vez — se suman a esta tabla, no la reemplazan.
        "Reiniciar todo" borra todos los pacientes ya procesados.
      </div>

      <div style="margin-top:30px; display:flex; justify-content:space-between; border-top:1px solid #e2e8f0; padding-top:20px;">
        <button id="omr-back-btn" class="btn btn-secondary">← Volver a Impresión</button>
      </div>

      <div id="bubble-inspector" style="display:none; margin-top:20px; border:1px solid #93c5fd; border-radius:10px; padding:16px; background:#f0f7ff;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <strong style="font-size:13px;">🔍 Inspector de burbujas — <span id="inspector-patient-label"></span></strong>
          <button id="inspector-close-btn" class="btn btn-secondary" style="font-size:11px; padding:4px 10px;">Cerrar</button>
        </div>
        <div style="font-size:11px; color:#475569; margin-bottom:12px;">
          Cada recorte muestra exactamente lo que el sistema vio para esa burbuja, ampliado, con la región
          que realmente se midió marcada con un recuadro (verde si se consideró marcada, rojo si no). Si el
          recuadro cae sobre papel en blanco en vez de sobre la burbuja real, hay un desajuste de calibración.
        </div>
        <div id="inspector-content"></div>
      </div>
    `;

    return section;
  }

  drawBoundingBoxes(results, image, calibration) {
    if (!this.ctx || !image) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);

    // Si no hay calibración disponible, se cae de respaldo a una escala
    // fija — pero lo normal es que siempre venga calculada desde service.js.
    const toPx = calibration ? calibration.toPx : (x_mm, y_mm) => ({ x: x_mm * 3.78, y: y_mm * 3.78 });

    results.forEach(result => {
      if (!result.details) return;

      result.details.forEach(detail => {
        const bbox = detail.boundingBox || detail.bubble;
        if (!bbox) return;

        const color = detail.isSelected ? '#22c55e' : '#ef4444';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        const topLeft = toPx(bbox.x_mm, bbox.y_mm);
        const bottomRight = toPx(bbox.x_mm + (bbox.width_mm || 5), bbox.y_mm + (bbox.height_mm || 5));

        this.ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      });
    });
  }

  /**
   * Tabla Pacientes × Variables. `service` se pasa para poder resolver
   * overrides (correcciones manuales) y para que el controller pueda leer
   * `data-*` de cada celda al manejar los clics de edición.
   */
  showBatchResults(records, service) {
    const section = document.getElementById('results-section');
    const content = document.getElementById('results-content');
    const summaryEl = document.getElementById('batch-summary');

    section.style.display = 'block';

    if (records.length === 0) {
      content.innerHTML = '<div style="padding:20px; color:#94a3b8; text-align:center;">Sin pacientes procesados todavía.</div>';
      summaryEl.textContent = '';
      return;
    }

    const variableNames = service.getAllVariableNames();
    const batchSummary = service.getBatchSummary();

    summaryEl.innerHTML = batchSummary.pendingReview > 0
      ? `<span style="color:#b45309; font-weight:600;">⚠ ${batchSummary.pendingReview} celda(s) pendientes de revisión</span> de ${batchSummary.totalFields} en total`
      : `<span style="color:#166534; font-weight:600;">✓ Todo revisado</span> (${batchSummary.totalFields} celdas en ${batchSummary.totalPatients} paciente(s))`;

    let html = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<thead><tr style="background:#e2e8f0; text-align:left;">';
    html += '<th style="padding:8px 10px; white-space:nowrap;">Paciente</th>';
    variableNames.forEach(name => {
      html += `<th style="padding:8px 10px; white-space:nowrap;">${escapeHTML(name)}</th>`;
    });
    html += '</tr></thead><tbody>';

    records.forEach(record => {
      html += `<tr style="border-bottom:1px solid #e2e8f0;">`;
      html += `<td style="padding:8px 10px; font-weight:600; white-space:nowrap; vertical-align:top;">
        ${escapeHTML(record.label)}
        <button class="omr-inspect-btn" data-record-id="${record.id}" title="Inspeccionar burbujas de este paciente" style="border:none; background:none; cursor:pointer; font-size:11px; opacity:0.7; margin-left:4px;">🔍</button>
      </td>`;

      variableNames.forEach(name => {
        const result = record.results.find(r => r.variable === name);
        const override = service.getOverride(record.id, name);
        const hasOverride = override !== undefined;
        const autoValue = result ? result.value : null;
        const displayValue = hasOverride ? override : autoValue;
        const needsReview = !hasOverride && result && result.needsReview;

        const valueHTML = (displayValue !== null && displayValue !== undefined && displayValue !== '')
          ? escapeHTML(String(displayValue))
          : '<span style="color:#999;">—</span>';

        const tag = hasOverride
          ? `<span title="Corregido manualmente" style="font-size:9px; color:#2563eb; margin-left:4px;">✎ manual</span>`
          : (needsReview ? `<span style="font-size:9px; color:#b45309; margin-left:4px;">⚠ revisar</span>` : '');

        const bg = needsReview ? 'background:#fffbeb;' : '';

        // Diagnóstico SIEMPRE visible (no solo al pasar el mouse, porque
        // en una captura de pantalla compartida un tooltip no se ve): la
        // densidad de tinta medida en cada opción, y si la calibración de
        // esta página usó marcas de registro reales o cayó al respaldo.
        // Esto permite diagnosticar lecturas inesperadas con números
        // concretos en vez de adivinar a partir de colores.
        let diagnosticHTML = '';
        if (result && Array.isArray(result.details) && result.details.length > 0) {
          const parts = result.details.map(d =>
            `${escapeHTML(String(d.label))}:${d.density.toFixed(2)}${d.isSelected ? '✓' : ''}`
          );
          const calibFlag = result.calibrationConfidence === 'fallback-no-marks' ? ' ⚠sin marcas' : '';
          diagnosticHTML = `<div class="omr-cell-diagnostic" style="font-size:9px; color:#94a3b8; margin-top:2px;" title="Densidad medida por opción (umbral: ${result.usedThreshold != null ? result.usedThreshold.toFixed(2) : '?'})">${parts.join(' ')}${calibFlag}</div>`;
        }

        html += `
          <td class="omr-cell" data-record-id="${record.id}" data-variable="${escapeHTML(name)}" data-current="${escapeHTML(String(displayValue ?? ''))}" style="padding:6px 10px; vertical-align:top; ${bg}">
            <div class="omr-cell-display" style="display:flex; align-items:center; gap:4px;">
              <span class="omr-cell-value">${valueHTML}</span>
              ${tag}
              <button class="omr-edit-btn" title="Corregir manualmente" style="margin-left:auto; border:none; background:none; cursor:pointer; font-size:11px; opacity:0.6;">✎</button>
              ${hasOverride ? `<button class="omr-undo-btn" title="Deshacer corrección" style="border:none; background:none; cursor:pointer; font-size:11px; color:#dc2626;">↩</button>` : ''}
            </div>
            ${diagnosticHTML}
          </td>
        `;
      });

      html += '</tr>';
    });

    html += '</tbody></table>';
    content.innerHTML = html;
  }

  /**
   * Convierte una celda específica en un campo editable (input de texto).
   * No vuelve a renderizar toda la tabla — evita perder el foco/scroll.
   *
   * Nota de diseño: se evita a propósito tener botones separados de
   * "Guardar"/"Cancelar" junto al input. Al hacer clic en cualquier botón
   * vecino, el navegador dispara `blur` sobre el input ANTES del propio
   * `click` del botón — si `blur` guardara y el botón fuera "Cancelar",
   * el valor se guardaría de todas formas por culpa del orden de eventos.
   * Por eso la regla es simple y sin ambigüedad: Enter o perder el foco
   * guarda; Escape cancela.
   */
  startEditingCell(cell) {
    const current = cell.getAttribute('data-current') || '';
    cell.innerHTML = `
      <input type="text" class="omr-cell-input" value="${escapeHTML(current)}" style="width:100%; font-size:12px; padding:3px 5px; border:1px solid #2563eb; border-radius:4px;">
      <div style="font-size:9px; color:#94a3b8; margin-top:2px;">Enter para guardar · Esc para cancelar</div>
    `;
    const input = cell.querySelector('.omr-cell-input');
    input.focus();
    input.select();
    return input;
  }

  /**
   * Construye y muestra el panel de "qué miró exactamente el sistema"
   * para cada burbuja del registro dado. Esta es la forma más directa de
   * diagnosticar un desajuste de calibración: si el recuadro de la región
   * analizada cae sobre papel en blanco en vez de sobre la burbuja real,
   * se ve a simple vista, sin tener que interpretar números o colores.
   */
  renderBubbleInspector(record) {
    const panel = document.getElementById('bubble-inspector');
    const content = document.getElementById('inspector-content');
    const label = document.getElementById('inspector-patient-label');
    if (!panel || !content || !label) return;

    label.textContent = record.label;
    content.innerHTML = '';

    record.results.forEach(result => {
      const sourceImage = record.sourceImages ? record.sourceImages[(result.page || 1) - 1] : null;

      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #dbeafe;';

      const title = document.createElement('div');
      title.style.cssText = 'font-weight:600; font-size:12px; margin-bottom:6px;';
      title.textContent = `${result.variable}` + (result.usedThreshold != null ? ` — umbral usado: ${result.usedThreshold.toFixed(2)}` : '');
      row.appendChild(title);

      const cropsRow = document.createElement('div');
      cropsRow.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap;';

      (result.details || []).forEach(detail => {
        const cell = document.createElement('div');
        cell.style.cssText = 'text-align:center; font-size:10px; width:78px;';

        if (sourceImage && detail.fullRectPx) {
          const canvas = this.buildBubbleCrop(sourceImage, detail.fullRectPx, detail.sampledRectPx, detail.isSelected);
          cell.appendChild(canvas);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'width:70px; height:70px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; border-radius:6px; font-size:9px;';
          placeholder.textContent = 'sin imagen';
          cell.appendChild(placeholder);
        }

        const caption = document.createElement('div');
        caption.style.marginTop = '4px';
        caption.style.lineHeight = '1.3';
        const labelSpan = document.createElement('strong');
        labelSpan.textContent = String(detail.label);
        caption.appendChild(labelSpan);
        caption.appendChild(document.createElement('br'));
        caption.appendChild(document.createTextNode(`${detail.density.toFixed(2)}${detail.isSelected ? ' ✓' : ''}`));
        cell.appendChild(caption);

        cropsRow.appendChild(cell);
      });

      row.appendChild(cropsRow);
      content.appendChild(row);
    });

    panel.style.display = 'block';
    if (typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  hideBubbleInspector() {
    const panel = document.getElementById('bubble-inspector');
    if (panel) panel.style.display = 'none';
  }

  /**
   * Dibuja un recorte ampliado de la burbuja (con un margen de papel
   * alrededor para dar contexto) y superpone un recuadro mostrando
   * exactamente qué región interior se usó para medir la densidad.
   */
  buildBubbleCrop(sourceImage, fullRectPx, sampledRectPx, isSelected) {
    const SIZE = 70;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.border = `2px solid ${isSelected ? '#22c55e' : '#cbd5e1'}`;
    canvas.style.borderRadius = '4px';
    canvas.style.background = '#fff';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas; // entornos sin canvas real (p. ej. jsdom en pruebas)

    try {
      const marginRatio = 0.4; // margen de papel alrededor de la burbuja, para dar contexto
      const marginX = fullRectPx.width * marginRatio;
      const marginY = fullRectPx.height * marginRatio;
      const sx = fullRectPx.x - marginX;
      const sy = fullRectPx.y - marginY;
      const sw = fullRectPx.width + marginX * 2;
      const sh = fullRectPx.height + marginY * 2;

      ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

      if (sampledRectPx) {
        const scaleX = SIZE / sw;
        const scaleY = SIZE / sh;
        const localX = (sampledRectPx.x - sx) * scaleX;
        const localY = (sampledRectPx.y - sy) * scaleY;
        const localW = sampledRectPx.width * scaleX;
        const localH = sampledRectPx.height * scaleY;

        ctx.strokeStyle = isSelected ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(localX, localY, localW, localH);
      }
    } catch (e) {
      // drawImage podría fallar en navegadores que consideren el canvas
      // "tainted"; no debería ocurrir aquí (la imagen viene de un archivo
      // local del propio usuario), pero se degrada con gracia mostrando
      // el recuadro vacío en vez de romper toda la vista.
    }

    return canvas;
  }
}
