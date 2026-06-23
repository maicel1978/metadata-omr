// js/features/preview/view.js
// Vista previa simple del formulario (lineal)

import { createElement, appendChildren, clearElement } from '../../core/dom.js';
import { escapeHTML } from '../../core/sanitize.js';

export function renderPreview(container, project, variables) {
  clearElement(container);

  // Header del proyecto
  const header = createElement('div', '', {
    html: `
      <h2 style="margin:0 0 4px; font-size:22px;">${escapeHTML(project.name || 'Formulario Clínico')}</h2>
      <div style="color:#64748b; font-size:13px; margin-bottom:24px;">
        ${escapeHTML(project.specialty || '')} • ${escapeHTML(project.date || '')}
      </div>
    `
  });

  // Lista de variables (lineal)
  const list = createElement('div', 'form-preview');

  variables.forEach((variable, index) => {
    const block = createElement('div', 'block');
    block.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:15px;">${escapeHTML(variable.name)}</strong>
          <div style="font-size:12px; color:#64748b; margin-top:2px;">
            ${escapeHTML(variable.metadata?.question || variable.description || '')}
          </div>
        </div>
        <div style="font-size:11px; padding:2px 10px; background:#f1f5f9; border-radius:999px; color:#475569;">
          ${escapeHTML(variable.type)}
        </div>
      </div>
    `;
    list.appendChild(block);
  });

  appendChildren(container, header, list);
}