// js/features/printer/service.js
// Generador de HTML imprimible A4 real y estable

import Store from '../../core/store.js';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 20;

export function generatePrintableHTML() {
  const state = Store.getState();
  const { project, compiledForm } = state;

  if (!compiledForm || !compiledForm.blocks || compiledForm.blocks.length === 0) {
    return null;
  }

  const formId = compiledForm.id || 'unknown';
  const version = compiledForm.version || 1;
  const compiledDate = compiledForm.compiledAt 
    ? new Date(compiledForm.compiledAt).toLocaleDateString('es-ES') 
    : new Date().toLocaleDateString('es-ES');

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${project.name || 'Formulario Clínico'} - OMR Suite</title>
  <style>
    @page {
      size: A4;
      margin: ${MARGIN_MM}mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000000;
      margin: 0;
      padding: 0;
      background: white;
    }
    
    .page {
      width: ${A4_WIDTH_MM}mm;
      min-height: ${A4_HEIGHT_MM}mm;
      padding: ${MARGIN_MM}mm;
      margin: 0 auto 20px auto;
      background: white;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      page-break-after: always;
      position: relative;
      box-sizing: border-box;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .header {
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    
    .header h1 {
      font-size: 16pt;
      margin: 0 0 4px 0;
      font-weight: 700;
    }
    
    .header .meta {
      font-size: 9pt;
      color: #444;
    }
    
    .form-meta {
      position: absolute;
      top: 12mm;
      right: 20mm;
      font-size: 8pt;
      color: #666;
      text-align: right;
    }
    
    .block {
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
    }
    
    .block:last-child {
      border-bottom: none;
    }
    
    .question {
      font-weight: 600;
      font-size: 11pt;
      margin-bottom: 6px;
    }
    
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 4px;
    }
    
    .option {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11pt;
    }
    
    .option input {
      width: 14px;
      height: 14px;
      accent-color: #000;
    }
    
    .page-number {
      position: absolute;
      bottom: 12mm;
      right: 20mm;
      font-size: 9pt;
      color: #555;
    }
    
    .registration-mark {
      position: absolute;
      width: 6mm;
      height: 6mm;
      border: 2px solid black;
      background: white;
    }
    
    .registration-mark.top-left { top: 6mm; left: 6mm; }
    .registration-mark.top-right { top: 6mm; right: 6mm; }
    .registration-mark.bottom-left { bottom: 6mm; left: 6mm; }
    .registration-mark.bottom-right { bottom: 6mm; right: 6mm; }
    
    @media print {
      body {
        background: white;
      }
      .page {
        box-shadow: none;
        margin: 0;
        width: 100%;
      }
    }
  </style>
</head>
<body>
`;

  // Agrupar bloques por página
  const pages = {};
  compiledForm.blocks.forEach(block => {
    if (!pages[block.page]) pages[block.page] = [];
    pages[block.page].push(block);
  });

  Object.keys(pages).forEach(pageNum => {
    const blocks = pages[pageNum];
    
    html += `
  <div class="page">
    <!-- Registration marks para OMR futuro -->
    <div class="registration-mark top-left"></div>
    <div class="registration-mark top-right"></div>
    <div class="registration-mark bottom-left"></div>
    <div class="registration-mark bottom-right"></div>
    
    <div class="form-meta">
      ID: ${formId}<br>
      v${version} • ${compiledDate}
    </div>
    
    <div class="header">
      <h1>${project.name || 'Formulario Clínico'}</h1>
      <div class="meta">${project.specialty || ''} • ${project.date || ''}</div>
    </div>
`;

    blocks.forEach(block => {
      let content = '';

      const categories = block.metadata?.categories || [];

      if (block.type.includes('Dicotómica') || 
          block.type.includes('Politómica') || 
          block.type === 'Ordinal') {
        
        const optionsHTML = categories.map(c => 
          `<div class="option">
            <input type="radio" name="${block.id}">
            <span>${c.label}</span>
          </div>`
        ).join('');

        content = `
          <div>
            <div class="question">${block.question}</div>
            <div class="options">${optionsHTML}</div>
          </div>
        `;
      } 
      else if (block.type.includes('Cuantitativa')) {
        // Renderizado de variables cuantitativas con matriz de dígitos OMR
        const range = block.metadata?.range;
        const maxValue = range && range.max ? parseInt(range.max) : 99;
        const unit = block.metadata?.unit || '';
        const digits = maxValue > 99 ? 3 : 2;

        let digitColumns = '';

        for (let d = 0; d < digits; d++) {
          let bubbles = '';
          for (let i = 0; i <= 9; i++) {
            bubbles += `
              <div style="
                display: inline-flex; 
                align-items: center; 
                justify-content: center; 
                width: 18px; 
                height: 18px; 
                margin: 1px 2px;
                border: 1.5px solid #000; 
                border-radius: 50%;
                font-size: 9px;
                color: #000;
              ">
                ${i}
              </div>
            `;
          }

          const label = digits === 3 
            ? (d === 0 ? 'C' : d === 1 ? 'D' : 'U') 
            : (d === 0 ? 'D' : 'U');

          digitColumns += `
            <div style="display:flex; flex-direction:column; align-items:center; margin:0 6px;">
              <div style="font-size:8px; color:#555; margin-bottom:2px;">${label}</div>
              <div style="display:flex; flex-wrap:wrap; justify-content:center; max-width:65px;">
                ${bubbles}
              </div>
            </div>
          `;
        }

        content = `
          <div>
            <div class="question">${block.question}</div>
            <div style="
              display: inline-flex; 
              gap: 10px; 
              padding: 8px 12px; 
              margin-top: 6px;
              border: 1px solid #ccc; 
              border-radius: 6px;
              background: #fafafa;
            ">
              ${digitColumns}
            </div>
            <div style="margin-top:4px; font-size:9pt; color:#555;">
              Rango: 0 - ${maxValue} ${unit ? `(${unit})` : ''}
            </div>
          </div>
        `;
      }

      html += `
    <div class="block" data-field="${block.name}">
      ${content}
    </div>
`;
    });

    html += `
    <div class="page-number">Página ${pageNum} de ${compiledForm.pages}</div>
  </div>
`;
  });

  html += `
</body>
</html>`;

  return html;
}

export function printDocument() {
  const html = generatePrintableHTML();
  if (!html) {
    alert('No hay formulario compilado para imprimir.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}

export function showPrintPreview(htmlContent) {
  const previewWindow = window.open('', '_blank', 'width=900,height=700');
  previewWindow.document.write(htmlContent);
  previewWindow.document.close();
}