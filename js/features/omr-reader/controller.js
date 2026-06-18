// js/features/omr-reader/controller.js
// Controlador del OMR Reader MVP

import { OMRReaderService } from './service.js';
import { OMRReaderView } from './view.js';

export class OMRReaderController {
  constructor() {
    this.service = new OMRReaderService();
    this.view = null;
    this.container = null;
  }

  init(containerId = 'step-omr') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.view = new OMRReaderView(this.container);
    this.view.render();

    this.bindEvents();
  }

  bindEvents() {
    // Carga de plantilla .omr
    const omrInput = this.container.querySelector('#omr-file');
    const omrStatus = this.container.querySelector('#omr-status');

    omrInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        await this.service.loadTemplate(file);
        omrStatus.innerHTML = `✅ Plantilla cargada: <strong>${this.service.template.meta.project?.name || 'Sin nombre'}</strong>`;
        omrStatus.style.color = '#166534';
        this.checkReadyToProcess();
      } catch (error) {
        alert(error.message);
        omrStatus.innerHTML = '❌ Error al cargar plantilla';
        omrStatus.style.color = '#b91c1c';
      }
    };

    // Carga de imágenes
    const imagesInput = this.container.querySelector('#images-file');
    const imagesStatus = this.container.querySelector('#images-status');

    imagesInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      try {
        const loaded = await this.service.loadImages(files);
        imagesStatus.innerHTML = `✅ ${loaded.length} imagen(es) cargada(s)`;
        imagesStatus.style.color = '#166534';
        this.checkReadyToProcess();
      } catch (error) {
        alert('Error al cargar las imágenes: ' + error.message);
      }
    };

    // Botón Procesar
    const processBtn = this.container.querySelector('#process-btn');
    processBtn.onclick = async () => {
      await this.processForms();
    };

    // Exportaciones
    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'export-json') this.service.exportToJSON();
      if (e.target.id === 'export-csv') this.service.exportToCSV();
      if (e.target.id === 'reset-btn') this.resetAll();
    });
  }

  checkReadyToProcess() {
    const processBtn = this.container.querySelector('#process-btn');
    const hasTemplate = !!this.service.template;
    const hasImages = this.service.images.length > 0;

    processBtn.disabled = !(hasTemplate && hasImages);
  }

  async processForms() {
    const processBtn = this.container.querySelector('#process-btn');
    const loadingMsg = this.view.loadingMessage;

    processBtn.disabled = true;
    processBtn.textContent = 'Procesando...';

    if (loadingMsg) loadingMsg.style.display = 'block';

    try {
      const results = await this.service.processForms();

      // Ocultar mensaje de carga
      if (loadingMsg) loadingMsg.style.display = 'none';

      // Mostrar primera imagen en canvas con bounding boxes
      if (this.service.images.length > 0) {
        const firstImage = this.service.images[0].image;
        this.view.canvas.width = firstImage.width;
        this.view.canvas.height = firstImage.height;
        this.view.ctx.drawImage(firstImage, 0, 0);

        // Dibujar bounding boxes
        this.view.drawBoundingBoxes(results, firstImage);
      }

      // Mostrar resultados
      this.view.showResults(results);

      // Mostrar mensaje de éxito
      this.showSuccessMessage(`Procesamiento completado. ${results.length} variables analizadas.`);

      // Activar botones de exportación
      const exportJson = this.container.querySelector('#export-json');
      const exportCsv = this.container.querySelector('#export-csv');
      if (exportJson) exportJson.disabled = false;
      if (exportCsv) exportCsv.disabled = false;

    } catch (error) {
      if (loadingMsg) loadingMsg.style.display = 'none';
      this.showErrorMessage('Error durante el procesamiento: ' + error.message);
    } finally {
      processBtn.textContent = 'Procesar Formulario';
      processBtn.disabled = false;
    }
  }

  showSuccessMessage(message) {
    const msg = document.createElement('div');
    msg.style.cssText = 'background:#dcfce7; color:#166534; padding:10px 14px; border-radius:6px; margin:12px 0; font-size:13px;';
    msg.textContent = '✅ ' + message;

    const resultsSection = this.container.querySelector('#results-section');
    if (resultsSection) {
      resultsSection.insertBefore(msg, resultsSection.firstChild);
      setTimeout(() => msg.remove(), 4000);
    }
  }

  showErrorMessage(message) {
    const msg = document.createElement('div');
    msg.style.cssText = 'background:#fee2e2; color:#b91c1c; padding:10px 14px; border-radius:6px; margin:12px 0; font-size:13px;';
    msg.textContent = '⚠️ ' + message;

    const debugSection = this.container.querySelector('#results-section') || this.container;
    debugSection.insertBefore(msg, debugSection.firstChild);
    setTimeout(() => msg.remove(), 5000);
  }

  resetAll() {
    this.service.reset();
    this.view.render();
    this.bindEvents();
  }
}

// Instancia global para inicialización
let omrControllerInstance = null;

export function initOMRReader() {
  if (!omrControllerInstance) {
    omrControllerInstance = new OMRReaderController();
  }
  omrControllerInstance.init('step-omr');
}

export function showOMRReader() {
  if (omrControllerInstance) {
    omrControllerInstance.view.render();
    omrControllerInstance.bindEvents();
  }
}

// === Compatibilidad con Form Compiler ===
export function prepareOMRRegions() {
  // Esta función mantiene compatibilidad con el Form Compiler
  // Retorna un array vacío por ahora (el nuevo OMR Reader es más avanzado)

  return [];
}

export function getOMRRegions() {
  return [];
}