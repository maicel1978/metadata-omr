// js/features/form-compiler/view.js
// Renderizado visual del formulario compilado (lineal + paginado)

import { createElement, appendChildren, clearElement } from '../../core/dom.js';

export function renderCompiledForm(container, compiledForm, project) {
  clearElement(container);

  const header = createElement('div', '', {
    html: `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div>
          <h2 style="margin:0; font-size:22px;">${project.name || 'Formulario Clínico'}</h2>
          <div style="color:#64748b; font-size:13px;">${project.specialty || ''}</div>
        </div>
        <div style="text-align:right; font-size:12px; color:#64748b;">
          ${compiledForm.variablesCount} variables • ${compiledForm.pages} página(s)<br>
          <span style="font-size:10px;">v${compiledForm.version} • ${new Date(compiledForm.compiledAt).toLocaleDateString()}</span>
        </div>
      </div>
    `
  });

  const pagesContainer = createElement('div', '');

  for (let page = 1; page <= compiledForm.pages; page++) {
    const pageEl = createElement('div', 'page', {
      style: `
        margin-bottom: 40px; 
        border: 1px solid #cbd5e1; 
        background: white; 
        padding: 28px 32px; 
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `
    });

    const pageHeader = createElement('div', '', {
      html: `<div style="font-size:10px; color:#94a3b8; margin-bottom:12px; text-align:right;">Página ${page} de ${compiledForm.pages}</div>`
    });

    const blocksOnPage = compiledForm.blocks.filter(b => b.page === page);

    blocksOnPage.forEach(block => {
      const blockEl = createElement('div', 'block', {
        'data-block-id': block.id,
        style: `
          display: block; 
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 22px 26px; 
          margin-bottom: 20px;
          background: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
        `
      });

      const categories = block.metadata?.categories || [];
      let content = '';

      // =====================================================
      // ESTRUCTURA UNIFICADA PARA TODAS LAS VARIABLES
      // =====================================================

      if (block.type.includes('Dicotómica') || 
          block.type.includes('Politómica') || 
          block.type === 'Ordinal') {
        
        // Variables Cualitativas
        const optionsHTML = categories.map(c => 
          `<label style="
            display: inline-flex; 
            align-items: center; 
            gap: 8px; 
            font-size: 14px; 
            margin: 4px 10px 4px 0;
            padding: 6px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            background: #f8fafc;
          ">
            <input type="radio" name="${block.id}" value="${c.label}" style="width:16px;height:16px; accent-color:#1e40af;"> 
            <span style="color:#334155;">${c.label}</span>
          </label>`
        ).join('');

        content = `
          <div style="width:100%;">
            <div style="margin-bottom:12px;">
              <strong style="font-size:15px; color:#0f172a;">${block.question}</strong>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">${optionsHTML}</div>
          </div>
        `;
      } 
      else if (block.type.includes('Cuantitativa')) {
        // Variables Cuantitativas - Matriz de dígitos (estilo unificado)
        const range = block.metadata?.range;
        const maxValue = range && range.max ? parseInt(range.max) : 99;
        const unit = block.metadata?.unit || '';
        const digits = maxValue > 99 ? 3 : 2;

        let digitColumns = '';

        for (let d = 0; d < digits; d++) {
          let bubbles = '';
          for (let i = 0; i <= 9; i++) {
            bubbles += `
              <label style="
                display: inline-flex; 
                align-items: center; 
                justify-content: center; 
                width: 20px; 
                height: 20px; 
                margin: 2px 3px;
                border: 1.5px solid #1e40af; 
                border-radius: 50%;
                font-size: 10px;
                color: #1e40af;
                cursor: pointer;
                background: white;
              ">
                <input type="radio" name="${block.id}-d${d}" value="${i}" style="opacity:0; width:1px; height:1px; position:absolute;">
                ${i}
              </label>
            `;
          }

          const label = digits === 3 
            ? (d === 0 ? 'Centenas' : d === 1 ? 'Decenas' : 'Unidades')
            : (d === 0 ? 'Decenas' : 'Unidades');

          digitColumns += `
            <div style="display:flex; flex-direction:column; align-items:center; margin:0 4px;">
              <div style="font-size:9px; color:#64748b; margin-bottom:3px; font-weight:600;">${label}</div>
              <div style="display:flex; flex-wrap:wrap; justify-content:center; max-width:70px;">
                ${bubbles}
              </div>
            </div>
          `;
        }

        content = `
          <div style="width:100%;">
            <div style="margin-bottom:12px;">
              <strong style="font-size:15px; color:#0f172a;">${block.question}</strong>
              ${unit ? `<span style="font-size:12px; color:#64748b; margin-left:6px;">(${unit})</span>` : ''}
            </div>
            <div style="
              display: inline-flex; 
              gap: 12px; 
              padding: 12px 16px; 
              background: #f8fafc; 
              border: 1px solid #cbd5e1; 
              border-radius: 8px;
            ">
              ${digitColumns}
            </div>
            <div style="margin-top:8px; font-size:11px; color:#64748b;">
              Rango permitido: <strong>0 - ${maxValue}</strong>
            </div>
          </div>
        `;
      } 
      else {
        content = `<div><strong>${block.question}</strong></div>`;
      }

      blockEl.innerHTML = content;
      pageEl.appendChild(blockEl);
    });

    appendChildren(pageEl, pageHeader);
    pagesContainer.appendChild(pageEl);
  }

  appendChildren(container, header, pagesContainer);
}