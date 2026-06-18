// js/features/omr-exporter/controller.js

import { renderOMRExporterUI } from './view.js';
import { exportOMRTemplate } from './service.js';

let container = null;

export function initOMRExporter() {
  container = document.getElementById('step-omr');
  if (!container) return;

  renderOMRExporterUI(container);

  // Escuchar evento de exportación
  window.addEventListener('omr:export-template', () => {
    exportOMRTemplate();
  });
}

export function showOMRExporter() {
  if (container) {
    renderOMRExporterUI(container);
  }
}