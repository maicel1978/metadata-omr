// js/features/omr-reader/controller.js
// Controlador del OMR Reader.
//
// Revisión 2026-06-20 (lote + corrección manual):
// - Botón de carga de carpeta completa, además del selector múltiple de
//   siempre (ambos alimentan el mismo `service.loadImages`).
// - Cada clic en "Procesar" AGREGA pacientes nuevos a la tabla de
//   resultados (no la reemplaza) — así se puede seguir sumando pacientes
//   más tarde sin perder lo ya procesado. "Reiniciar todo" sí limpia todo.
// - Edición manual: clic en ✎ en cualquier celda la convierte en un campo
//   de texto (Enter o perder el foco guarda, Escape cancela); clic en ↩
//   deshace una corrección ya guardada.
//
// (Las correcciones de la revisión anterior — fuga de listeners, notify
// en vez de alert(), calibración real para el debug view, conexión del
// botón "Volver a Impresión" — se mantienen sin cambios.)

import { OMRReaderService } from './service.js';
import { OMRReaderView } from './view.js';
import { notify } from '../../core/notifications.js';

export class OMRReaderController {
  constructor() {
    this.service = new OMRReaderService();
    this.view = null;
    this.container = null;
    this._containerEventsBound = false;
  }

  init(containerId = 'step-omr') {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.view = new OMRReaderView(this.container);
    this.view.render();

    this.bindFormEvents();
    this.bindContainerEventsOnce();
  }

  // Listener delegado: se registra UNA sola vez por instancia (ver nota
  // histórica sobre la fuga de listeners en versiones anteriores).
  bindContainerEventsOnce() {
    if (this._containerEventsBound) return;
    this._containerEventsBound = true;

    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'export-json') { this.service.exportToJSON(); return; }
      if (e.target.id === 'export-csv') { this.service.exportToCSV(); return; }
      if (e.target.id === 'reset-btn') { this.resetAll(); return; }
      if (e.target.id === 'inspector-close-btn') { this.view.hideBubbleInspector(); return; }

      const editBtn = e.target.closest('.omr-edit-btn');
      if (editBtn) { this.beginEditCell(editBtn.closest('.omr-cell')); return; }

      const undoBtn = e.target.closest('.omr-undo-btn');
      if (undoBtn) { this.clearOverride(undoBtn.closest('.omr-cell')); return; }

      const inspectBtn = e.target.closest('.omr-inspect-btn');
      if (inspectBtn) {
        const recordId = Number(inspectBtn.getAttribute('data-record-id'));
        const record = this.service.records.find(r => r.id === recordId);
        if (record) this.view.renderBubbleInspector(record);
        return;
      }
    });
  }

  // Handlers por elemento: se reasignan en cada render porque los
  // elementos del DOM se recrean (esto es seguro y NO se acumula, ya que
  // `.onchange =` / `.onclick =` reemplazan, no agregan).
  bindFormEvents() {
    const omrInput = this.container.querySelector('#omr-file');
    const omrStatus = this.container.querySelector('#omr-status');

    omrInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        await this.service.loadTemplate(file);
        omrStatus.innerHTML = `✅ Plantilla cargada: <strong>${this.escapeText(this.service.template.meta.project?.name || 'Sin nombre')}</strong> (${this.service.getExpectedPages()} página(s) por paciente)`;
        omrStatus.style.color = '#166534';
        this.checkReadyToProcess();
      } catch (error) {
        notify.error(error.message);
        omrStatus.innerHTML = '❌ Error al cargar plantilla';
        omrStatus.style.color = '#b91c1c';
      }
    };

    const imagesInput = this.container.querySelector('#images-file');
    const imagesStatus = this.container.querySelector('#images-status');

    imagesInput.onchange = async (e) => {
      await this.handleImageFiles(e.target.files, imagesStatus);
    };

    // Carga de carpeta completa: usa el mismo flujo que el selector
    // múltiple de siempre — esto es puramente aditivo, no reemplaza nada.
    const folderBtn = this.container.querySelector('#folder-btn');
    const folderInput = this.container.querySelector('#folder-file');
    folderBtn.onclick = () => folderInput.click();
    folderInput.onchange = async (e) => {
      await this.handleImageFiles(e.target.files, imagesStatus);
    };

    const processBtn = this.container.querySelector('#process-btn');
    processBtn.onclick = async () => {
      await this.processForms();
    };

    const backBtn = this.container.querySelector('#omr-back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        window.dispatchEvent(new CustomEvent('omr:go-to-step', { detail: { step: 'print' } }));
      };
    }
  }

  async handleImageFiles(fileList, statusEl) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    try {
      const loaded = await this.service.loadImages(files);
      statusEl.innerHTML = `✅ ${loaded.length} imagen(es) cargada(s)`;
      statusEl.style.color = '#166534';
      this.reportBatchHint(loaded.length);
      this.checkReadyToProcess();

      const withAspectIssue = loaded.filter(img => img.aspectWarning);
      if (withAspectIssue.length > 0) {
        notify.warning(
          `${withAspectIssue.length} imagen(es) no tienen la proporción de una hoja A4 completa (${withAspectIssue[0].fileName}). ` +
          `Si la lectura sale mal, esta es la primera causa a revisar — usa el 🔍 inspector después de procesar para confirmarlo.`,
          9000
        );
      }
    } catch (error) {
      notify.error('Error al cargar las imágenes: ' + error.message);
    }
  }

  // Antes solo avisaba si la cantidad no coincidía exactamente con las
  // páginas esperadas. Ahora informa cuántos pacientes se detectarían
  // (un múltiplo exacto de las páginas por paciente), o avisa si la
  // cantidad no es un múltiplo válido (processForms() de todas formas lo
  // rechazará con un error claro al intentar procesar).
  reportBatchHint(uploadedCount) {
    const hintEl = this.container.querySelector('#batch-hint');
    if (!this.service.template) return;

    const expectedPages = this.service.getExpectedPages();

    if (!hintEl) return;

    if (uploadedCount % expectedPages !== 0) {
      hintEl.innerHTML = `⚠ ${uploadedCount} imagen(es) no es un múltiplo de ${expectedPages} página(s)/paciente.`;
      hintEl.style.color = '#b45309';
    } else {
      const patients = uploadedCount / expectedPages;
      hintEl.innerHTML = patients === 1
        ? `1 paciente (${expectedPages} página(s))`
        : `${patients} pacientes detectados (${expectedPages} página(s) cada uno)`;
      hintEl.style.color = '#64748b';
    }
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

    // Se captura ANTES de llamar a processForms(), porque el servicio
    // vacía `this.images` al terminar de procesar el lote (para que la
    // próxima carga no se vuelva a procesar junto con esta).
    const firstImageForDebug = this.service.images[0]?.image || null;

    try {
      const newRecords = await this.service.processForms();

      if (loadingMsg) loadingMsg.style.display = 'none';

      if (firstImageForDebug && newRecords.length > 0) {
        this.view.canvas.width = firstImageForDebug.width;
        this.view.canvas.height = firstImageForDebug.height;

        const calibration = this.service.getCalibration(1);
        this.view.drawBoundingBoxes(newRecords[0].results, firstImageForDebug, calibration);

        if (calibration && !calibration.calibrated) {
          notify.warning(
            'No se detectaron con claridad las marcas de registro de la primera página de este lote; se usó una escala estimada. Revisa los resultados con cuidado.',
            8000
          );
        }
      }

      this.refreshResultsTable();

      const totalFieldsThisBatch = newRecords.reduce((sum, r) => sum + r.results.length, 0);
      const reviewThisBatch = newRecords.reduce((sum, r) => sum + r.results.filter(x => x.needsReview).length, 0);

      if (reviewThisBatch === 0) {
        notify.success(`${newRecords.length} paciente(s) procesado(s) correctamente (${totalFieldsThisBatch} campos).`);
      } else {
        notify.warning(`${newRecords.length} paciente(s) procesado(s). ${reviewThisBatch} campo(s) necesitan revisión manual.`, 8000);
      }

      const exportJson = this.container.querySelector('#export-json');
      const exportCsv = this.container.querySelector('#export-csv');
      if (exportJson) exportJson.disabled = false;
      if (exportCsv) exportCsv.disabled = false;

      this.checkReadyToProcess(); // ya no hay imágenes pendientes -> se deshabilita hasta que se cargue otra cosa

    } catch (error) {
      if (loadingMsg) loadingMsg.style.display = 'none';
      notify.error(error.message);
    } finally {
      processBtn.textContent = 'Procesar';
      processBtn.disabled = this.service.images.length === 0;
    }
  }

  refreshResultsTable() {
    this.view.showBatchResults(this.service.records, this.service);
  }

  beginEditCell(cell) {
    if (!cell) return;
    const recordId = Number(cell.getAttribute('data-record-id'));
    const variableName = cell.getAttribute('data-variable');

    const input = this.view.startEditingCell(cell);
    let resolved = false;

    const finish = (commit) => {
      if (resolved) return;
      resolved = true;
      if (commit) {
        this.service.setOverride(recordId, variableName, input.value.trim());
      }
      this.refreshResultsTable();
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    };
    input.onblur = () => finish(true);
  }

  clearOverride(cell) {
    if (!cell) return;
    const recordId = Number(cell.getAttribute('data-record-id'));
    const variableName = cell.getAttribute('data-variable');
    this.service.setOverride(recordId, variableName, '');
    this.refreshResultsTable();
  }

  escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  resetAll() {
    this.service.reset();
    this.view.render();
    this.bindFormEvents(); // NO se vuelve a llamar bindContainerEventsOnce()
  }
}

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
    omrControllerInstance.bindFormEvents(); // NO se vuelve a llamar bindContainerEventsOnce()
  }
}
