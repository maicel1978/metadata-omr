// js/features/omr-exporter/view.js

import { createElement, appendChildren } from '../../core/dom.js';

export function renderOMRExporterUI(container) {
  container.innerHTML = '';

  const wrapper = createElement('div', '', {
    style: 'text-align:center; padding:40px 30px;'
  });

  wrapper.innerHTML = `
    <div style="font-size:42px; margin-bottom:12px;">📤</div>
    <h2 style="margin:0 0 8px;">Exportar Plantilla OMR</h2>
    <p style="color:#64748b; max-width:480px; margin:0 auto 24px; font-size:13px;">
      Genera un archivo <strong>.omr</strong> con las posiciones físicas del formulario 
      para que el futuro lector OMR pueda interpretar las imágenes escaneadas.
    </p>
  `;

  const info = createElement('div', '', {
    style: 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; max-width:460px; margin:0 auto 24px; font-size:12px; text-align:left;'
  });

  info.innerHTML = `
    <strong>Contenido del archivo .omr:</strong><br><br>
    • ID y versión del formulario<br>
    • Posiciones de cada variable (x, y en mm)<br>
    • Tamaño de burbujas (5mm × 5mm)<br>
    • Número de página por variable<br>
    • Layout compilado (no editable)
  `;

  const exportBtn = createElement('button', 'btn btn-primary', {
    text: 'Exportar Plantilla .omr',
    style: 'font-size:15px; padding:14px 36px;'
  });

  exportBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:export-template'));
  };

  appendChildren(wrapper, info, exportBtn);
  appendChildren(container, wrapper);
}