// smoke-test.mjs
// Prueba de humo manual (no forma parte de `npm test`): arranca el flujo
// completo de un solo paciente — importar -> compilar -> imprimir ->
// exportar .omr — sobre un DOM simulado (jsdom), y además verifica
// explícitamente la corrección del 2026-06-20 (texto de categoría
// separado de su burbuja, ya no impreso dentro de ella).

import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('./index.html', 'utf-8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });

global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;

let failed = false;
function check(label, cond) {
  if (cond) console.log(`OK   ${label}`);
  else { console.log(`FAIL ${label}`); failed = true; }
}

try {
  const Store = (await import('./js/core/store.js')).default;
  const { parseClinicalFile } = await import('./js/features/importer/service.js');
  const { compileForm } = await import('./js/features/form-compiler/service.js');
  const { generateOMRTemplate } = await import('./js/features/omr-exporter/service.js');
  const { generatePrintableHTML } = await import('./js/features/printer/service.js');
  const { computeLayout, PAGE_WIDTH_MM, PAGE_HEIGHT_MM } = await import('./js/core/layout-engine.js');

  Store.init();

  const clinicalFile = JSON.stringify({
    project: { name: 'Estudio de Hipertensión Pediátrica', specialty: 'Pediatría', date: '2026-01-01' },
    variables: [
      {
        name: 'Tensión Sistólica',
        type: 'Cuantitativa Continua',
        description: 'TA sistólica',
        metadata: { question: '¿Tensión arterial sistólica?', unit: 'mmHg', range: { min: '60', max: '220' }, categories: [] }
      },
      {
        name: 'sexo',
        type: 'Nominal Dicotómica',
        description: 'Sexo biológico',
        metadata: { question: '¿Sexo biológico?', unit: '', range: { min: '', max: '' }, categories: [
          { label: 'Masculino', synonyms: ['m'] },
          { label: 'Femenino', synonyms: ['f'] }
        ]}
      },
      {
        name: 'Niño con Comorbilidades',
        type: 'Nominal Politómica',
        description: 'Comorbilidades',
        metadata: {
          question: '¿Comorbilidad principal?',
          unit: '', range: { min: '', max: '' },
          categories: Array.from({ length: 9 }, (_, i) => ({ label: `Comorbilidad número ${i + 1}`, synonyms: [String(i)] }))
        }
      }
    ]
  });

  const { data, errors } = parseClinicalFile(clinicalFile);
  check('Importación: sin errores de parseo', errors.length === 0);
  check('Importación: nombre con tilde transliterado correctamente (tension_sistolica)', data.variables[0].name === 'tension_sistolica');
  check('Importación: ñ transliterada correctamente (nino_con_comorbilidades)', data.variables[2].name === 'nino_con_comorbilidades');

  Store.setState({ project: data.project, variables: data.variables, currentStep: 'preview' });

  const compiled = compileForm(data.variables);
  check('Compilación: genera bloques para las 3 variables', compiled.blocks.length === 3);
  Store.setCompiledForm(compiled);

  const layout = computeLayout(data.variables);
  let anyOverflow = false;
  layout.blocks.forEach(block => {
    block.options.forEach(opt => {
      const x = block.x_mm + opt.boundingBox.x_mm;
      if (x + opt.boundingBox.width_mm > PAGE_WIDTH_MM || x < 0) anyOverflow = true;
    });
  });
  check('Layout: ninguna burbuja fuera del ancho de la página A4', !anyOverflow);

  const printableHTML = generatePrintableHTML();
  check('Impresión: genera HTML sin lanzar excepción', typeof printableHTML === 'string' && printableHTML.length > 0);
  check('Impresión: incluye las 4 marcas de registro', (printableHTML.match(/<div class="omr-registration-mark omr-registration-mark--/g) || []).length === 4 * compiled.pages);
  check('Impresión: el nombre del proyecto aparece escapado/sin romper el HTML', printableHTML.includes('Estudio de Hipertensión Pediátrica'));

  // Verificación específica de la corrección del 2026-06-20: el texto de
  // cada categoría debe estar en su propio elemento `.omr-option-label`,
  // SEPARADO de la burbuja `.omr-bubble` — no debe haber un <span> con el
  // nombre completo de la categoría dentro de un .omr-bubble.
  check('Impresión: "Masculino"/"Femenino" aparecen como .omr-option-label (no dentro de la burbuja)', printableHTML.includes('class="omr-option-label"') && printableHTML.includes('>Masculino<'));
  const bubbleWithFullWordInside = /<div class="omr-bubble[^>]*"[^>]*><span>Masculino<\/span><\/div>/.test(printableHTML);
  check('Impresión: la burbuja de "Masculino" ya NO contiene el texto completo dentro (bug del 2026-06-20)', !bubbleWithFullWordInside);

  const omrTemplate = generateOMRTemplate();
  check('Exportación .omr: no es null', omrTemplate !== null);
  check('Exportación .omr: contiene las 3 variables', omrTemplate.variables.length === 3);

  const comorbilidad = omrTemplate.variables.find(v => v.name === 'nino_con_comorbilidades');
  check('Exportación .omr: las 9 categorías sobreviven (ninguna perdida por desborde)', comorbilidad.options.length === 9);

  let exportOverflow = false;
  omrTemplate.variables.forEach(v => v.options.forEach(o => {
    if (o.boundingBox.x_mm + o.boundingBox.width_mm > PAGE_WIDTH_MM) exportOverflow = true;
    if (o.boundingBox.y_mm + o.boundingBox.height_mm > PAGE_HEIGHT_MM) exportOverflow = true;
  }));
  check('Exportación .omr: ninguna coordenada exportada cae fuera de la página física', !exportOverflow);

  const badVariables = [{
    name: 'conteo_imposible',
    type: 'Cuantitativa Discreta',
    metadata: { question: '¿Conteo?', range: { min: '0', max: '999999' } }
  }];
  let threw = false;
  try { compileForm(badVariables); } catch (e) { threw = true; }
  check('Compilación: rechaza con error legible un rango irrepresentable (en vez de truncar en silencio)', threw);

  const dupFile = JSON.stringify({
    project: { name: 'Test' },
    variables: [
      { name: 'edad', type: 'Cuantitativa Discreta', metadata: { question: '¿Edad?', range: { min: '0', max: '100' } } },
      { name: 'édad', type: 'Cuantitativa Discreta', metadata: { question: '¿Edad 2?', range: { min: '0', max: '100' } } }
    ]
  });
  const dupResult = parseClinicalFile(dupFile);
  check('Importación: rechaza colisión de nombres creada por la normalización (edad/édad)', dupResult.data === null && dupResult.errors.length > 0);

} catch (err) {
  console.error('ERROR INESPERADO:', err);
  failed = true;
}

console.log(failed ? '\n=== SMOKE TEST: FALLÓ ===' : '\n=== SMOKE TEST: TODO OK ===');
process.exit(failed ? 1 : 0);
