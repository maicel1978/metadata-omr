// js/features/form-compiler/view.js
// Renderizado visual del formulario compilado (paginado).
//
// Antes, este archivo recalculaba por su cuenta la matriz de burbujas
// (con sus propias constantes, distintas a las de printer/service.js y
// omr-exporter/service.js) e interpolaba texto del .clinical sin escapar.
// Ahora solo pide a core/render-page.js que dibuje exactamente los mismos
// bloques que se usarán al imprimir y al exportar el .omr.

import { clearElement } from '../../core/dom.js';
import { escapeHTML } from '../../core/sanitize.js';
import { renderPageHTML, OMR_PAGE_CSS } from '../../core/render-page.js';

function ensureCSSInjected() {
  if (!document.getElementById('omr-page-css')) {
    const style = document.createElement('style');
    style.id = 'omr-page-css';
    style.textContent = OMR_PAGE_CSS;
    document.head.appendChild(style);
  }
}

export function renderCompiledForm(container, compiledForm, project) {
  ensureCSSInjected();
  clearElement(container);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-family: system-ui, sans-serif;';
  header.innerHTML = `
    <div>
      <h2 style="margin:0; font-size:22px;">${escapeHTML(project.name || 'Formulario Clínico')}</h2>
      <div style="color:#64748b; font-size:13px;">${escapeHTML(project.specialty || '')}</div>
    </div>
    <div style="text-align:right; font-size:12px; color:#64748b;">
      ${compiledForm.variablesCount} variables · ${compiledForm.pages} página(s)<br>
      <span style="font-size:10px;">v${escapeHTML(String(compiledForm.version))} · ${escapeHTML(new Date(compiledForm.compiledAt).toLocaleDateString('es-ES'))}</span>
    </div>
  `;

  const scroller = document.createElement('div');
  scroller.className = 'omr-preview-scroll';

  const formMeta = {
    id: compiledForm.id,
    version: compiledForm.version,
    dateLabel: new Date(compiledForm.compiledAt).toLocaleDateString('es-ES'),
    totalPages: compiledForm.pages
  };

  let pagesHTML = '';
  for (let page = 1; page <= compiledForm.pages; page++) {
    const blocksOnPage = compiledForm.blocks.filter(b => b.page === page);
    pagesHTML += renderPageHTML(page, blocksOnPage, project, formMeta);
  }
  scroller.innerHTML = pagesHTML;

  container.appendChild(header);
  container.appendChild(scroller);
}
