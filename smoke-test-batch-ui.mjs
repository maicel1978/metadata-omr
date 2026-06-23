// smoke-test-batch-ui.mjs
// Prueba manual de humo (no forma parte de `npm test`): verifica, sobre un
// DOM real simulado con jsdom, que la tabla de resultados por lote y la
// edición manual de celdas funcionan de extremo a extremo — clics reales,
// eventos de teclado reales, no solo llamadas directas a métodos del
// servicio.

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="step-omr"></div></body></html>', {
  url: 'http://localhost/'
});

global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;
global.Image = dom.window.Image;

let failed = false;
function check(label, cond) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) failed = true;
}

function fireClick(el) {
  el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}
function fireKey(el, key) {
  el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }));
}

try {
  const { OMRReaderController } = await import('./js/features/omr-reader/controller.js');

  const controller = new OMRReaderController();
  controller.init('step-omr');

  // Mock de processPage para no depender de Canvas/Image reales —
  // simulamos 2 pacientes de 1 página cada uno, cada uno con 1 variable.
  controller.service.template = {
    meta: { formId: 'smoke-form', version: 1, project: { name: 'Estudio Smoke Test' } },
    variables: [{ name: 'sexo', page: 1, options: [
      { label: 'Masculino', value: 'Masculino', boundingBox: { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 } },
      { label: 'Femenino', value: 'Femenino', boundingBox: { x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 5 } }
    ]}]
  };

  let callIndex = 0;
  const fakeValues = ['Masculino', 'Femenino'];
  controller.service.processPage = async () => {
    const value = fakeValues[callIndex];
    callIndex++;
    return [{
      variable: 'sexo',
      value,
      confidence: 0.9,
      details: [],
      calibrationConfidence: 'marks-detected'
    }];
  };

  controller.service.images = [
    { image: { width: 100, height: 100 }, fileName: 'p1.jpg' },
    { image: { width: 100, height: 100 }, fileName: 'p2.jpg' }
  ];

  await controller.processForms();

  const rows = document.querySelectorAll('#results-content tbody tr');
  check('procesar 2 imágenes (1 página/paciente) produce 2 filas en la tabla', rows.length === 2);

  const firstCellValue = rows[0]?.querySelector('.omr-cell-value')?.textContent;
  const secondCellValue = rows[1]?.querySelector('.omr-cell-value')?.textContent;
  check('la primera fila muestra "Masculino"', firstCellValue === 'Masculino');
  check('la segunda fila muestra "Femenino"', secondCellValue === 'Femenino');

  const exportJsonBtn = document.getElementById('export-json');
  const exportCsvBtn = document.getElementById('export-csv');
  check('los botones de exportar se habilitan después de procesar', !exportJsonBtn.disabled && !exportCsvBtn.disabled);

  // --- Edición manual de una celda ---
  // Importante: cada llamada a refreshResultsTable() reemplaza TODA la
  // tabla vía innerHTML, así que cualquier referencia de fila/celda
  // capturada ANTES de una acción que dispare un re-render queda
  // obsoleta (desconectada del documento) después de esa acción. Por eso
  // se vuelve a consultar el DOM con `document.querySelector(...)` tras
  // cada paso que modifica el estado, en vez de reutilizar referencias
  // viejas.
  let firstCell = document.querySelectorAll('#results-content tbody tr')[0].querySelector('.omr-cell');
  let editBtn = firstCell.querySelector('.omr-edit-btn');
  fireClick(editBtn);

  // Tras el clic en ✎, `firstCell` SIGUE siendo la celda correcta (esa
  // mutación es in-place, no reemplaza la tabla entera) — se reconsulta
  // de todas formas por claridad.
  firstCell = document.querySelectorAll('#results-content tbody tr')[0].querySelector('.omr-cell');
  const input = firstCell.querySelector('.omr-cell-input');
  check('al hacer clic en ✎ aparece un input editable', !!input);

  input.value = 'CORREGIDO A MANO';
  fireKey(input, 'Enter'); // esto SÍ reemplaza toda la tabla vía refreshResultsTable()

  const updatedCellAfterEdit = document.querySelectorAll('#results-content tbody tr')[0].querySelector('.omr-cell');
  const updatedValue = updatedCellAfterEdit?.querySelector('.omr-cell-value')?.textContent;
  check('tras Enter, la celda muestra el valor corregido manualmente', updatedValue === 'CORREGIDO A MANO');

  const manualTag = updatedCellAfterEdit?.innerHTML.includes('manual');
  check('la celda corregida muestra la etiqueta "manual"', manualTag === true);

  // --- Deshacer la corrección ---
  const undoBtn = updatedCellAfterEdit.querySelector('.omr-undo-btn');
  check('aparece un botón de deshacer en la celda corregida', !!undoBtn);
  fireClick(undoBtn); // también reemplaza toda la tabla

  const revertedCell = document.querySelectorAll('#results-content tbody tr')[0].querySelector('.omr-cell');
  const revertedValue = revertedCell?.querySelector('.omr-cell-value')?.textContent;
  check('tras deshacer, vuelve a mostrar el valor detectado automáticamente', revertedValue === 'Masculino');

  // --- Inspector de burbujas (recortes visuales de diagnóstico) ---
  const inspectBtn = document.querySelector('.omr-inspect-btn');
  check('aparece el botón 🔍 de inspección junto a cada paciente', !!inspectBtn);
  fireClick(inspectBtn);

  const inspectorPanel = document.getElementById('bubble-inspector');
  check('al hacer clic en 🔍 el panel inspector se muestra (sin lanzar excepción, aunque no haya canvas real)', inspectorPanel && inspectorPanel.style.display === 'block');

  const inspectorLabel = document.getElementById('inspector-patient-label')?.textContent;
  check('el panel inspector muestra la etiqueta del paciente correspondiente', inspectorLabel === 'Paciente 1');

  const closeBtn = document.getElementById('inspector-close-btn');
  fireClick(closeBtn);
  check('el botón "Cerrar" oculta el panel inspector', document.getElementById('bubble-inspector').style.display === 'none');

  // --- Agregar un segundo lote (más pacientes) sin perder el primero ---
  controller.service.images = [{ image: { width: 100, height: 100 }, fileName: 'p3.jpg' }];
  callIndex = 0;
  fakeValues[0] = 'Femenino';
  await controller.processForms();

  const rowsAfterSecondBatch = document.querySelectorAll('#results-content tbody tr');
  check('procesar un segundo lote AGREGA filas en vez de reemplazar las anteriores', rowsAfterSecondBatch.length === 3);

  // --- Reiniciar todo ---
  const resetBtn = document.getElementById('reset-btn');
  fireClick(resetBtn);

  const rowsAfterReset = document.querySelectorAll('#results-content tbody tr');
  check('"Reiniciar todo" deja la tabla sin pacientes', rowsAfterReset.length === 0 || document.getElementById('results-section').style.display === 'none' || !document.getElementById('results-content'));

} catch (err) {
  console.error('ERROR INESPERADO:', err);
  failed = true;
}

console.log(failed ? '\n=== SMOKE TEST UI POR LOTES: FALLÓ ===' : '\n=== SMOKE TEST UI POR LOTES: TODO OK ===');
process.exit(failed ? 1 : 0);
