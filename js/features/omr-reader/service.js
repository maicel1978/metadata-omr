// js/features/omr-reader/service.js
// Servicio principal del OMR Reader MVP

import { OMRDetector } from './detection.js';

export class OMRReaderService {
  constructor() {
    this.template = null;
    this.images = []; // { page: number, image: HTMLImageElement, fileName: string }
    this.detector = new OMRDetector(0.12); // Umbral ajustable
    this.results = [];
  }

  /**
   * Carga y valida un archivo .omr
   */
  async loadTemplate(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const template = JSON.parse(e.target.result);
          
          // Validación básica de la plantilla
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

  /**
   * Carga múltiples imágenes escaneadas
   */
  async loadImages(files) {
    const loadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pageNumber = i + 1;

      const image = await this.loadImageFile(file);
      loadedImages.push({
        page: pageNumber,
        image,
        fileName: file.name
      });
    }

    this.images = loadedImages;
    return loadedImages;
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
   * Ejecuta la detección OMR sobre todas las páginas
   */
  async processForms() {
    if (!this.template || this.images.length === 0) {
      throw new Error('Debe cargar tanto la plantilla .omr como las imágenes');
    }

    const allResults = [];

    for (const pageData of this.images) {
      const pageResults = await this.processPage(pageData);
      allResults.push(...pageResults);
    }

    this.results = allResults;
    return allResults;
  }

  async processPage(pageData) {
    const { page, image } = pageData;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const pageVariables = this.template.variables.filter(v => v.page === page);
    const pageResults = [];

    for (const variable of pageVariables) {
      const result = this.detector.detectVariable(
        ctx,
        variable,
        image.width,
        image.height
      );
      pageResults.push(result);
    }

    return pageResults;
  }

  /**
   * Devuelve los resultados en formato clínico estructurado
   */
  getStructuredResults() {
    const output = {
      formId: this.template?.meta?.formId || 'unknown',
      version: this.template?.meta?.version || 1,
      processedAt: new Date().toISOString(),
      pages: this.images.length,
      data: {}
    };

    this.results.forEach(result => {
      output.data[result.variable] = result.value;
    });

    return output;
  }

  /**
   * Exporta los resultados a JSON
   */
  exportToJSON() {
    const data = this.getStructuredResults();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadFile(blob, `resultados_omr_${data.formId}.json`);
  }

  /**
   * Exporta los resultados a CSV
   */
  exportToCSV() {
    const data = this.getStructuredResults();
    let csv = 'Variable,Valor\n';

    Object.entries(data.data).forEach(([key, value]) => {
      csv += `${key},${value || ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadFile(blob, `resultados_omr_${data.formId}.csv`);
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
    this.results = [];
  }
}