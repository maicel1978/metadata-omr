// js/features/printer/view.js

import { createElement, appendChildren } from '../../core/dom.js';

export function renderPrintUI(container) {
  container.innerHTML = '';

  const wrapper = createElement('div', '', {
    style: 'text-align:center; padding:60px 40px;'
  });

  wrapper.innerHTML = `
    <div style="font-size:48px; margin-bottom:16px;">🖨️</div>
    <h2 style="margin:0 0 8px;">Exportar para Impresión</h2>
    <p style="color:#64748b; max-width:480px; margin:0 auto 32px;">
      Genera un documento en formato A4 real, optimizado para impresión y futuro escaneo OMR.
    </p>
  `;

  const btnContainer = createElement('div', '', {
    style: 'display:flex; gap:12px; justify-content:center; flex-wrap:wrap;'
  });

  // Botón Imprimir
  const printBtn = createElement('button', 'btn btn-primary', {
    text: 'Imprimir Formulario (Ctrl+P)',
    style: 'font-size:15px; padding:14px 32px;'
  });
  printBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:print'));
  };

  // Botón Vista Previa
  const previewBtn = createElement('button', 'btn btn-secondary', {
    text: 'Ver Vista Previa de Impresión',
    style: 'font-size:15px; padding:14px 32px;'
  });
  previewBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:print-preview'));
  };

  appendChildren(btnContainer, printBtn, previewBtn);
  appendChildren(wrapper, btnContainer);

  // Navegación inferior
  const nav = document.createElement('div');
  nav.style.marginTop = '40px';
  nav.style.display = 'flex';
  nav.style.justifyContent = 'space-between';
  nav.style.flexWrap = 'wrap';
  nav.style.gap = '12px';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary';
  backBtn.textContent = '← Volver al Formulario';
  backBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
      detail: { step: 'adjust' } 
    }));
  };

  // También agregamos evento al botón del OMR Reader
  const omrBackBtn = document.getElementById('omr-back-btn');
  if (omrBackBtn) {
    omrBackBtn.onclick = () => {
      window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
        detail: { step: 'print' } 
      }));
    };
  }

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn btn-secondary';
  exportBtn.textContent = 'Exportar Plantilla .omr';
  exportBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:export-template'));
  };

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary';
  nextBtn.textContent = 'Ir al Lector OMR →';
  nextBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
      detail: { step: 'omr' } 
    }));
  };

  nav.appendChild(backBtn);
  nav.appendChild(exportBtn);
  nav.appendChild(nextBtn);

  appendChildren(wrapper, nav);
  appendChildren(container, wrapper);
}