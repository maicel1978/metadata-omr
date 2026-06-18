// js/features/omr-reader/view.js
// Vista del OMR Reader MVP con Canvas y Debug Visual

import { createElement, appendChildren, clearElement } from '../../core/dom.js';

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
      style: 'padding: 20px; max-width: 1100px; margin: 0 auto;'
    });

    // Título
    const title = createElement('h2', '', { 
      text: 'Lector OMR MVP',
      style: 'margin-bottom: 8px;'
    });

    const subtitle = createElement('p', '', {
      text: 'Carga una plantilla .omr y las imágenes escaneadas del formulario para detectar marcas.',
      style: 'color: #64748b; margin-bottom: 24px;'
    });

    // Sección de carga
    const uploadSection = this.createUploadSection();

    // Canvas + Debug
    const debugSection = this.createDebugSection();

    // Resultados
    const resultsSection = this.createResultsSection();

    appendChildren(wrapper, title, subtitle, uploadSection, debugSection, resultsSection);
    appendChildren(this.container, wrapper);
  }

  createUploadSection() {
    const section = createElement('div', '', {
      style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;'
    });

    // Carga de .omr
    const omrBox = createElement('div', '', {
      style: 'border: 2px dashed #cbd5e1; padding: 20px; border-radius: 12px;'
    });
    omrBox.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">1. Plantilla OMR (.omr)</div>
      <input type="file" id="omr-file" accept=".omr" style="margin-bottom:10px;">
      <div id="omr-status" style="font-size:12px; color:#64748b;">Sin cargar</div>
    `;

    // Carga de imágenes
    const imgBox = createElement('div', '', {
      style: 'border: 2px dashed #cbd5e1; padding: 20px; border-radius: 12px;'
    });
    imgBox.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">2. Imágenes escaneadas (PNG/JPG)</div>
      <input type="file" id="images-file" accept="image/*" multiple style="margin-bottom:10px;">
      <div id="images-status" style="font-size:12px; color:#64748b;">0 imágenes cargadas</div>
    `;

    appendChildren(section, omrBox, imgBox);
    return section;
  }

  createDebugSection() {
    const section = createElement('div', '', {
      style: 'margin-bottom: 30px;'
    });

    const header = createElement('div', '', {
      style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;'
    });
    header.innerHTML = `
      <div style="font-weight:600;">3. Vista de Detección (Debug)</div>
      <button id="process-btn" class="btn btn-primary" disabled>Procesar Formulario</button>
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

    // Mensaje de carga
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
      <div style="font-weight:600; margin-bottom:12px;">4. Resultados Detectados</div>
      <div id="results-content" style="background:#f8fafc; padding:16px; border-radius:8px; font-family:monospace; font-size:13px;"></div>
      
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        <button id="export-json" class="btn btn-secondary">Exportar JSON</button>
        <button id="export-csv" class="btn btn-secondary">Exportar CSV</button>
        <button id="reset-btn" class="btn btn-secondary">Reiniciar</button>
      </div>

      <!-- Navegación -->
      <div style="margin-top:30px; display:flex; justify-content:space-between; border-top:1px solid #e2e8f0; padding-top:20px;">
        <button id="omr-back-btn" class="btn btn-secondary">← Volver a Impresión</button>
        <div style="font-size:12px; color:#64748b; display:flex; align-items:center;">
          Resultados listos para exportar
        </div>
      </div>
    `;

    return section;
  }

  // Métodos auxiliares para el controller
  drawBoundingBoxes(results, image) {
    if (!this.ctx || !image) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);

    results.forEach(result => {
      if (!result.details) return;

      result.details.forEach(detail => {
        const color = detail.isSelected ? '#22c55e' : '#ef4444';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;

        // Dibujar bounding box (usando coordenadas mm convertidas)
        const pxPerMm = 3.78;
        const bbox = detail.boundingBox || detail.bubble;
        if (!bbox) return;

        const x = bbox.x_mm * pxPerMm;
        const y = bbox.y_mm * pxPerMm;
        const w = (bbox.width_mm || 5) * pxPerMm;
        const h = (bbox.height_mm || 5) * pxPerMm;

        this.ctx.strokeRect(x, y, w, h);
      });
    });
  }

  showResults(results) {
    const section = document.getElementById('results-section');
    const content = document.getElementById('results-content');

    section.style.display = 'block';

    let html = '<table style="width:100%; border-collapse:collapse;">';
    html += '<tr style="background:#e2e8f0;"><th style="padding:6px;">Variable</th><th>Valor Detectado</th><th>Confianza</th></tr>';

    results.forEach(r => {
      const value = r.value || '<span style="color:#999;">No detectado</span>';
      html += `
        <tr>
          <td style="padding:6px; border-bottom:1px solid #ddd;">${r.variable}</td>
          <td style="padding:6px; border-bottom:1px solid #ddd;">${value}</td>
          <td style="padding:6px; border-bottom:1px solid #ddd;">${(r.confidence * 100).toFixed(1)}%</td>
        </tr>
      `;
    });

    html += '</table>';
    content.innerHTML = html;
  }
}