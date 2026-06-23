// tests/batch-processing.test.js
//
// Pruebas del soporte de lote (múltiples pacientes) y correcciones
// manuales pedido por el usuario el 2026-06-20. `processPage` se
// reemplaza por una versión determinista en cada prueba para no depender
// de Canvas/Image reales (no disponibles en el entorno de test) — lo que
// se prueba aquí es la lógica de agrupación, acumulación de registros y
// resolución de overrides, no la detección óptica en sí (esa ya tiene su
// propia cobertura en detection.test.js / integration.test.js).

import { describe, it, expect, beforeEach } from 'vitest';
import { OMRReaderService, naturalCompare } from '../js/features/omr-reader/service.js';

function makeFakeTemplate(pages) {
  return {
    meta: { formId: 'test-form', version: 1 },
    variables: Array.from({ length: pages }, (_, i) => ({
      name: `var_pagina_${i + 1}`,
      page: i + 1,
      options: [
        { label: 'A', value: 'A', boundingBox: { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 } },
        { label: 'B', value: 'B', boundingBox: { x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 5 } }
      ]
    }))
  };
}

function fakeImages(values) {
  return values.map((v, i) => ({ image: { fakeValue: v }, fileName: `img${i + 1}.jpg` }));
}

function withDeterministicProcessPage(service) {
  service.processPage = async ({ page, image }) => [{
    variable: `var_pagina_${page}`,
    value: image.fakeValue,
    confidence: 0.9,
    details: [],
    calibrationConfidence: 'marks-detected'
  }];
  return service;
}

describe('naturalCompare (orden de archivos para carga por carpeta)', () => {
  it('debe ordenar numéricamente, no alfabéticamente ("img2" antes que "img10")', () => {
    const files = ['img10.jpg', 'img2.jpg', 'img1.jpg'];
    files.sort(naturalCompare);
    expect(files).toEqual(['img1.jpg', 'img2.jpg', 'img10.jpg']);
  });

  it('debe mantener el orden correcto con prefijos de paciente', () => {
    const files = ['paciente10_pag1.jpg', 'paciente2_pag1.jpg', 'paciente2_pag2.jpg', 'paciente1_pag2.jpg', 'paciente1_pag1.jpg'];
    files.sort(naturalCompare);
    expect(files).toEqual([
      'paciente1_pag1.jpg',
      'paciente1_pag2.jpg',
      'paciente2_pag1.jpg',
      'paciente2_pag2.jpg',
      'paciente10_pag1.jpg'
    ]);
  });
});

describe('OMRReaderService: procesamiento por lotes (múltiples pacientes)', () => {
  let service;

  beforeEach(() => {
    service = withDeterministicProcessPage(new OMRReaderService());
    service.template = makeFakeTemplate(2); // formulario de 2 páginas por paciente
  });

  it('exactamente `expectedPages` imágenes deben producir 1 solo registro (comportamiento de siempre, sin cambios)', async () => {
    service.images = fakeImages(['A', 'B']);
    const newRecords = await service.processForms();

    expect(newRecords.length).toBe(1);
    expect(service.records.length).toBe(1);
    expect(service.records[0].results.map(r => r.value)).toEqual(['A', 'B']);
  });

  it('el doble de `expectedPages` imágenes debe producir 2 registros, cada uno con sus propias páginas (sin mezclarse entre pacientes)', async () => {
    service.images = fakeImages(['A1', 'B1', 'A2', 'B2']);
    const newRecords = await service.processForms();

    expect(newRecords.length).toBe(2);
    expect(service.records[0].results.map(r => r.value)).toEqual(['A1', 'B1']);
    expect(service.records[1].results.map(r => r.value)).toEqual(['A2', 'B2']);
  });

  it('una cantidad de imágenes que NO es múltiplo de `expectedPages` debe rechazarse con un error legible (no emparejar a ciegas)', async () => {
    service.images = fakeImages(['A1', 'B1', 'A2']); // 3 imágenes, se esperan múltiplos de 2
    await expect(service.processForms()).rejects.toThrow(/múltiplo/);
  });

  it('procesar dos lotes por separado debe ACUMULAR registros, no reemplazarlos ("agregar pacientes después")', async () => {
    service.images = fakeImages(['A1', 'B1']);
    await service.processForms();

    service.images = fakeImages(['A2', 'B2']);
    await service.processForms();

    expect(service.records.length).toBe(2);
    expect(service.records[0].label).toBe('Paciente 1');
    expect(service.records[1].label).toBe('Paciente 2');
  });

  it('después de procesar, el lote de imágenes pendientes debe quedar vacío (no se reprocesa en la siguiente llamada)', async () => {
    service.images = fakeImages(['A1', 'B1']);
    await service.processForms();
    expect(service.images.length).toBe(0);
  });

  it('reset() debe limpiar registros, overrides y el contador de pacientes', async () => {
    service.images = fakeImages(['A1', 'B1']);
    await service.processForms();
    service.setOverride(1, 'var_pagina_1', 'Z');

    service.reset();

    expect(service.records.length).toBe(0);
    expect(service.getOverride(1, 'var_pagina_1')).toBeUndefined();

    service.template = makeFakeTemplate(2);
    service.images = fakeImages(['X', 'Y']);
    await service.processForms();
    expect(service.records[0].label).toBe('Paciente 1'); // el contador se reinició también
  });

  it('no debe lanzar si se llama processForms() sin haber cargado ninguna imagen', async () => {
    service.images = [];
    await expect(service.processForms()).rejects.toThrow(/al menos un conjunto de imágenes/);
  });

  it('no debe lanzar un error confuso si se procesa sin haber cargado la plantilla', async () => {
    const bareService = new OMRReaderService();
    bareService.images = fakeImages(['A']);
    await expect(bareService.processForms()).rejects.toThrow(/plantilla/);
  });
});

describe('OMRReaderService: correcciones manuales (overrides)', () => {
  let service;

  beforeEach(() => {
    service = withDeterministicProcessPage(new OMRReaderService());
    service.template = makeFakeTemplate(1);
  });

  it('un override debe tener prioridad sobre el valor detectado al resolver y al exportar', async () => {
    service.images = [{ image: { fakeValue: 'A' }, fileName: 'img1.jpg' }];
    await service.processForms();

    const record = service.records[0];
    expect(service.resolveValue(record, 'var_pagina_1', 'A')).toBe('A');

    service.setOverride(record.id, 'var_pagina_1', 'B');
    expect(service.resolveValue(record, 'var_pagina_1', 'A')).toBe('B');

    const structured = service.getStructuredResults();
    expect(structured.records[0].data.var_pagina_1.value).toBe('B');
    expect(structured.records[0].data.var_pagina_1.source).toBe('manual');
    expect(structured.records[0].data.var_pagina_1.needsReview).toBe(false);
  });

  it('asignar un override vacío debe eliminarlo (volver al valor automático)', async () => {
    service.images = [{ image: { fakeValue: 'A' }, fileName: 'img1.jpg' }];
    await service.processForms();
    const record = service.records[0];

    service.setOverride(record.id, 'var_pagina_1', 'B');
    expect(service.hasOverride(record.id, 'var_pagina_1')).toBe(true);

    service.setOverride(record.id, 'var_pagina_1', '');
    expect(service.hasOverride(record.id, 'var_pagina_1')).toBe(false);
  });

  it('un override de un paciente NO debe afectar a otro paciente con la misma variable', async () => {
    service.template = makeFakeTemplate(1);
    service.images = [{ image: { fakeValue: 'A' }, fileName: 'img1.jpg' }];
    await service.processForms();
    service.images = [{ image: { fakeValue: 'A' }, fileName: 'img2.jpg' }];
    await service.processForms();

    service.setOverride(service.records[0].id, 'var_pagina_1', 'CORREGIDO');

    expect(service.resolveValue(service.records[0], 'var_pagina_1', 'A')).toBe('CORREGIDO');
    expect(service.resolveValue(service.records[1], 'var_pagina_1', 'A')).toBe('A');
  });
});

describe('OMRReaderService: detección de proporción de imagen (diagnóstico temprano de recorte/escala)', () => {
  it('una imagen con proporción A4 normal no debe generar advertencia', () => {
    const service = new OMRReaderService();
    // 210x297mm a cualquier DPI mantiene la proporción ~0.707
    const warning = service.checkAspectRatio({ width: 2100, height: 2970 });
    expect(warning).toBeNull();
  });

  it('una imagen claramente recortada/con otra proporción debe generar una advertencia explicativa', () => {
    const service = new OMRReaderService();
    // Una captura cuadrada o muy alargada no se parece a una hoja A4 completa
    const warning = service.checkAspectRatio({ width: 1000, height: 1000 });
    expect(warning).not.toBeNull();
    expect(warning).toContain('A4');
  });

  it('una imagen sin width/height definidos no debe lanzar, solo devolver null', () => {
    const service = new OMRReaderService();
    expect(service.checkAspectRatio({})).toBeNull();
  });
});

describe('OMRReaderService: exportación con múltiples pacientes', () => {
  it('debe generar un registro por paciente y mantener el orden de variables', async () => {
    const service = withDeterministicProcessPage(new OMRReaderService());
    service.template = makeFakeTemplate(2);

    service.images = [
      { image: { fakeValue: 'A1' }, fileName: 'p1_1.jpg' },
      { image: { fakeValue: 'B1' }, fileName: 'p1_2.jpg' },
      { image: { fakeValue: 'A2' }, fileName: 'p2_1.jpg' },
      { image: { fakeValue: 'B2' }, fileName: 'p2_2.jpg' }
    ];
    await service.processForms();

    expect(service.getAllVariableNames()).toEqual(['var_pagina_1', 'var_pagina_2']);

    const structured = service.getStructuredResults();
    expect(structured.totalPatients).toBe(2);
    expect(structured.records[0].data.var_pagina_1.value).toBe('A1');
    expect(structured.records[1].data.var_pagina_2.value).toBe('B2');
  });

  it('getBatchSummary debe contar correctamente las celdas pendientes de revisión a través de varios pacientes', async () => {
    const service = withDeterministicProcessPage(new OMRReaderService());
    service.template = makeFakeTemplate(1);

    // Forzamos que el resultado del "paciente 2" tenga baja confianza, que
    // es justamente el criterio real que validateResults() usa para
    // marcar `needsReview` (fijar `needsReview` a mano en el mock no
    // serviría: processForms() siempre vuelve a calcularlo con
    // validateResults() antes de guardar el registro).
    let call = 0;
    service.processPage = async ({ page, image }) => {
      call++;
      return [{
        variable: `var_pagina_${page}`,
        value: image.fakeValue,
        confidence: call === 2 ? 0.01 : 0.9,
        details: [],
        calibrationConfidence: 'marks-detected'
      }];
    };

    service.images = [{ image: { fakeValue: 'A' }, fileName: 'img1.jpg' }];
    await service.processForms();
    service.images = [{ image: { fakeValue: 'B' }, fileName: 'img2.jpg' }];
    await service.processForms();

    const summary = service.getBatchSummary();
    expect(summary.totalPatients).toBe(2);
    expect(summary.pendingReview).toBe(1);

    // Si se corrige manualmente, debe dejar de contar como pendiente.
    service.setOverride(service.records[1].id, 'var_pagina_1', 'CORREGIDO');
    const summaryAfterFix = service.getBatchSummary();
    expect(summaryAfterFix.pendingReview).toBe(0);
  });
});
