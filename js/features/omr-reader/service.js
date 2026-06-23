// js/features/omr-reader/service.js
// Servicio principal del OMR Reader.
//
// Revisión 2026-06-20 — soporte de lote (múltiples pacientes):
// - Las imágenes subidas se agrupan en "pacientes" de a `expectedPages`
//   imágenes cada uno (la cantidad de páginas que define la plantilla
//   .omr). Si se sube exactamente esa cantidad, es 1 paciente — el
//   comportamiento de siempre. Si se sube un múltiplo, son varios
//   pacientes, cada uno se convierte en un registro/fila independiente.
// - Cada llamada a `processForms()` AGREGA registros nuevos a los que ya
//   existían (no los reemplaza), para poder seguir sumando pacientes más
//   tarde sin perder lo ya procesado. `reset()` sí limpia todo.
// - Se admiten correcciones manuales (`setOverride`) que tienen prioridad
//   sobre el valor detectado automáticamente al exportar.
// - Los archivos se ordenan por nombre (orden natural: "img2" antes que
//   "img10") antes de agruparlos — importante para la carga de carpetas
//   completas, donde el orden de selección del sistema operativo no es
//   confiable.
// - Cada registro conserva sus imágenes originales (`sourceImages`) y
//   cada resultado lleva su número de página (`result.page`), para poder
//   construir recortes visuales de diagnóstico ("qué miró el sistema
//   exactamente para esta burbuja") en cualquier momento posterior — ver
//   `view.js -> renderBubbleInspector`.

import { OMRDetector } from './detection.js';
import { calibratePage } from './calibration.js';
import { validateResults, summarizeBatch } from './validation.js';
import { safeFileName } from '../../core/filename.js';
import { PAGE_WIDTH_MM, PAGE_HEIGHT_MM } from '../../core/layout-engine.js';

const EXPECTED_ASPECT_RATIO = PAGE_WIDTH_MM / PAGE_HEIGHT_MM; // ≈0.707 para A4
const ASPECT_RATIO_TOLERANCE = 0.12; // 12% de margen antes de avisar

export function naturalCompare(a, b) {
  const split = (s) => {
    const parts = [];
    s.replace(/(\d+)|(\D+)/g, (_, d, t) => {
      parts.push(d !== undefined ? [1, parseInt(d, 10)] : [0, t]);
      return '';
    });
    return parts;
  };
  const ax = split(a);
  const bx = split(b);
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const av = ax[i];
    const bv = bx[i];
    if (!av) return -1;
    if (!bv) return 1;
    if (av[0] !== bv[0]) return av[0] - bv[0];
    if (av[1] !== bv[1]) return av[1] < bv[1] ? -1 : av[1] > bv[1] ? 1 : 0;
  }
  return 0;
}

export class OMRReaderService {
  constructor() {
    this.template = null;
    this.images = []; // lote actual, todavía sin procesar
    this.records = []; // un registro por paciente ya procesado (se acumulan)
    this.overrides = {}; // `${recordId}::${variableName}` -> valor corregido a mano
    this.detector = new OMRDetector('adaptive');
    this.calibrationByPage = {};
    this._patientCounter = 0;
  }

  async loadTemplate(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const template = JSON.parse(e.target.result);
          if (!template.meta || !template.variables) {
            throw new Error('El archivo .omr no tiene la estructura esperada');
          }
          this.template = template;
          resolve(template);
        } catch (error) {
          reject(new Error('Error al leer el archivo .omr: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsText(file);
    });
  }

  getExpectedPages() {
    if (!this.template?.variables?.length) return 1;
    return Math.max(1, ...this.template.variables.map(v => Number(v.page) || 1));
  }

  async loadImages(files) {
    const sortedFiles = Array.from(files).sort((a, b) => naturalCompare(a.name, b.name));
    const loadedImages = [];

    for (const file of sortedFiles) {
      const image = await this.loadImageFile(file);
      loadedImages.push({ image, fileName: file.name, aspectWarning: this.checkAspectRatio(image) });
    }

    this.images = loadedImages;
    return loadedImages;
  }

  /**
   * Compara la proporción ancho/alto de la imagen contra la de una hoja
   * A4 (210x297mm). Si difieren mucho, lo más probable es que la imagen
   * sea un recorte/captura parcial de la página (no la hoja completa), lo
   * que rompe el supuesto que usa la calibración de respaldo (cuando no
   * se detectan las marcas de registro) de que el ancho/alto de la
   * imagen corresponde 1:1 a la página entera. Esto no bloquea nada — es
   * solo una alerta temprana para diagnosticar el tipo de desajuste que
   * reportó el usuario el 2026-06-20 ("discordancia entre el fichero de
   * metadatos y la imagen") antes de procesar, no después.
   */
  checkAspectRatio(image) {
    if (!image.width || !image.height) return null;
    const actual = image.width / image.height;
    const diff = Math.abs(actual - EXPECTED_ASPECT_RATIO) / EXPECTED_ASPECT_RATIO;
    if (diff > ASPECT_RATIO_TOLERANCE) {
      return (
        `La proporción de esta imagen (${image.width}×${image.height}px) no se parece a una hoja A4 completa ` +
        `(se esperaba ancho/alto ≈ ${EXPECTED_ASPECT_RATIO.toFixed(3)}, esta imagen tiene ≈ ${actual.toFixed(3)}). ` +
        `Es probable que sea un recorte/captura parcial de la página en vez de la hoja completa — eso puede ` +
        `desalinear la calibración si además no se detectan las marcas de registro de las esquinas.`
      );
    }
    return null;
  }

  loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Error al cargar la imagen'));
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Procesa el lote de imágenes actualmente cargado, agrupándolo en
   * pacientes de `getExpectedPages()` imágenes cada uno. Lanza un error
   * legible (en vez de emparejar páginas a ciegas) si la cantidad subida
   * no es un múltiplo exacto de lo que espera la plantilla.
   */
  async processForms() {
    if (!this.template) {
      throw new Error('Debe cargar la plantilla .omr antes de procesar.');
    }
    if (this.images.length === 0) {
      throw new Error('Debe cargar al menos un conjunto de imágenes.');
    }

    const expectedPages = this.getExpectedPages();

    if (this.images.length % expectedPages !== 0) {
      throw new Error(
        `Se subieron ${this.images.length} imagen(es), pero la plantilla espera ${expectedPages} página(s) por paciente. ` +
        `La cantidad debe ser un múltiplo exacto de ${expectedPages} (p. ej. ${expectedPages}, ${expectedPages * 2}, ${expectedPages * 3}...). ` +
        `Revisa que no falte ninguna página de algún paciente.`
      );
    }

    const patientCount = this.images.length / expectedPages;
    const newRecords = [];

    for (let p = 0; p < patientCount; p++) {
      const patientImages = this.images.slice(p * expectedPages, (p + 1) * expectedPages);
      const allResults = [];

      for (let i = 0; i < patientImages.length; i++) {
        const relativePage = i + 1;
        const pageResults = await this.processPage({ page: relativePage, image: patientImages[i].image });
        allResults.push(...pageResults);
      }

      const validatedResults = validateResults(allResults);

      this._patientCounter += 1;
      newRecords.push({
        id: this._patientCounter,
        label: `Paciente ${this._patientCounter}`,
        results: validatedResults,
        sourceFiles: patientImages.map(pi => pi.fileName),
        // Se conservan las imágenes originales de este paciente (no solo
        // los resultados) para poder construir recortes visuales de "qué
        // miró el sistema" en cualquier momento posterior, incluso después
        // de que `this.images` se vacíe al terminar de procesar el lote.
        sourceImages: patientImages.map(pi => pi.image),
        processedAt: new Date().toISOString()
      });
    }

    this.records.push(...newRecords);

    // El lote recién cargado ya se convirtió en registros; se limpia para
    // que la siguiente carga de imágenes no se vuelva a procesar junto
    // con esta.
    this.images = [];

    return newRecords;
  }

  async processPage(pageData) {
    const { page, image } = pageData;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const calibration = calibratePage(ctx, image.width, image.height);
    this.calibrationByPage[page] = calibration;

    const pageVariables = this.template.variables.filter(v => v.page === page);
    const pageResults = [];

    for (const variable of pageVariables) {
      const result = this.detector.detectVariable(ctx, variable, calibration, image.width, image.height);
      result.calibrationConfidence = calibration.confidence;
      result.page = page; // necesario para saber de qué imagen recortar después
      pageResults.push(result);
    }

    return pageResults;
  }

  getCalibration(page) {
    return this.calibrationByPage[page] || null;
  }

  /**
   * Devuelve la imagen original de una página específica de un registro
   * ya procesado, para poder construir recortes visuales de diagnóstico.
   */
  getRecordImage(record, page) {
    if (!record || !Array.isArray(record.sourceImages)) return null;
    return record.sourceImages[page - 1] || null;
  }

  // --- Correcciones manuales ---------------------------------------

  setOverride(recordId, variableName, value) {
    const key = `${recordId}::${variableName}`;
    if (value === null || value === undefined || value === '') {
      delete this.overrides[key];
    } else {
      this.overrides[key] = value;
    }
  }

  getOverride(recordId, variableName) {
    const key = `${recordId}::${variableName}`;
    return Object.prototype.hasOwnProperty.call(this.overrides, key) ? this.overrides[key] : undefined;
  }

  hasOverride(recordId, variableName) {
    return this.getOverride(recordId, variableName) !== undefined;
  }

  resolveValue(record, variableName, autoValue) {
    const override = this.getOverride(record.id, variableName);
    return override !== undefined ? override : autoValue;
  }

  // --- Resultados / resumen -------------------------------------------

  getAllVariableNames() {
    const names = [];
    const seen = new Set();
    this.records.forEach(r => r.results.forEach(res => {
      if (!seen.has(res.variable)) { seen.add(res.variable); names.push(res.variable); }
    }));
    return names;
  }

  getBatchSummary() {
    return summarizeBatch(this.records, (record, variableName) => this.hasOverride(record.id, variableName));
  }

  getStructuredResults() {
    return {
      formId: this.template?.meta?.formId || 'unknown',
      version: this.template?.meta?.version || 1,
      exportedAt: new Date().toISOString(),
      totalPatients: this.records.length,
      records: this.records.map(record => {
        const data = {};
        record.results.forEach(result => {
          const override = this.getOverride(record.id, result.variable);
          data[result.variable] = {
            value: override !== undefined ? override : result.value,
            source: override !== undefined ? 'manual' : 'auto',
            needsReview: override === undefined && !!result.needsReview
          };
        });
        return {
          patientId: record.id,
          patientLabel: record.label,
          processedAt: record.processedAt,
          sourceFiles: record.sourceFiles,
          data
        };
      })
    };
  }

  exportToJSON() {
    if (this.records.length === 0) return;
    const data = this.getStructuredResults();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadFile(blob, `resultados_omr_${safeFileName(data.formId, 'formulario')}_${this.records.length}pac.json`);
  }

  exportToCSV() {
    if (this.records.length === 0) return;

    const variableNames = this.getAllVariableNames();

    const escapeCSV = (val) => {
      const s = String(val ?? '');
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const header = ['Paciente', 'ProcesadoEn', ...variableNames].map(escapeCSV).join(',');

    const rows = this.records.map(record => {
      const cells = [record.label, record.processedAt];
      variableNames.forEach(name => {
        const result = record.results.find(r => r.variable === name);
        const value = this.resolveValue(record, name, result ? result.value : null);
        cells.push(value);
      });
      return cells.map(escapeCSV).join(',');
    });

    const csv = [header, ...rows].join('\n');
    // BOM para que Excel detecte UTF-8 correctamente (tildes/ñ en valores)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    this.downloadFile(blob, `resultados_omr_${safeFileName(this.template?.meta?.formId, 'formulario')}_${this.records.length}pac.csv`);
  }

  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  reset() {
    this.template = null;
    this.images = [];
    this.records = [];
    this.overrides = {};
    this.calibrationByPage = {};
    this._patientCounter = 0;
  }
}
