// js/features/importer/view.js
// UI del importador

import { createElement, appendChildren } from '../../core/dom.js';

export function renderImporter(container) {
  container.innerHTML = '';

  const dropzone = createElement('div', 'dropzone');
  dropzone.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">📥</div>
    <h3 style="margin: 0 0 8px; font-size: 20px;">Importar archivo .clinical</h3>
    <p>Arrastra el archivo aquí o haz clic para seleccionar</p>
    <input type="file" id="file-input" accept=".clinical" style="display: none;">
    <button id="select-btn" class="btn btn-primary" style="margin-top: 20px;">
      Seleccionar archivo
    </button>
  `;

  appendChildren(container, dropzone);
}