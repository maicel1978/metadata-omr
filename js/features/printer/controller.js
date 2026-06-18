// js/features/printer/controller.js

import { renderPrintUI } from './view.js';
import { printDocument, generatePrintableHTML, showPrintPreview } from './service.js';

let container = null;

export function initPrinter() {
  container = document.getElementById('step-print');
  if (!container) return;

  renderPrintUI(container);

  // Escuchar evento global de impresión
  window.addEventListener('omr:print', () => {
    printDocument();
  });
}

export function showPrintStep() {
  if (container) {
    renderPrintUI(container);
  }
}

// Función para mostrar vista previa de impresión
export function showPrintPreviewMode() {
  const html = generatePrintableHTML();
  if (!html) {
    alert('No hay formulario compilado.');
    return;
  }
  showPrintPreview(html);
}