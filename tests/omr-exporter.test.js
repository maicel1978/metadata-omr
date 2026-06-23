// tests/omr-exporter.test.js
//
// Antes, este archivo solo comprobaba que `generateOMRTemplate` fuera una
// función exportada — no validaba absolutamente nada sobre las coordenadas
// que produce. Por eso el bug de burbujas fuera de la página (ver
// CHANGELOG.md) nunca fue detectado por la batería de tests existente.
//
// Ahora se compila un formulario real, se genera la plantilla .omr, y se
// verifica que (a) las coordenadas exportadas coincidan exactamente con
// las que calcula el layout-engine (la garantía central de esta
// reescritura: una sola fuente de verdad), y (b) ninguna caiga fuera de
// los límites físicos de la página.

import { describe, it, expect, beforeEach } from 'vitest';
import { generateOMRTemplate } from '../js/features/omr-exporter/service.js';
import { compileForm } from '../js/features/form-compiler/service.js';
import { computeLayout, PAGE_WIDTH_MM, PAGE_HEIGHT_MM, absoluteOptionBox } from '../js/core/layout-engine.js';
import Store from '../js/core/store.js';

function buildVariables() {
  return [
    {
      name: 'sexo',
      type: 'Nominal Dicotómica',
      metadata: { question: '¿Sexo biológico?', categories: [{ label: 'Masculino', synonyms: [] }, { label: 'Femenino', synonyms: [] }] }
    },
    {
      name: 'nivel_educativo',
      type: 'Nominal Politómica',
      metadata: {
        question: '¿Nivel educativo?',
        categories: Array.from({ length: 8 }, (_, i) => ({ label: `Nivel ${i + 1} con etiqueta larga`, synonyms: [] }))
      }
    },
    {
      name: 'edad',
      type: 'Cuantitativa Discreta',
      metadata: { question: '¿Edad?', range: { min: '0', max: '120' } }
    }
  ];
}

describe('generateOMRTemplate', () => {

  beforeEach(() => {
    const variables = buildVariables();
    const compiled = compileForm(variables);
    Store.setState({
      project: { name: 'Estudio de Prueba', specialty: 'Pediatría', date: '2026-01-01' },
      variables,
      compiledForm: compiled
    });
  });

  it('debería ser una función exportada', () => {
    expect(typeof generateOMRTemplate).toBe('function');
  });

  it('debería devolver null si no hay formulario compilado', () => {
    Store.setState({ compiledForm: { blocks: [], pages: 1 } });
    expect(generateOMRTemplate()).toBeNull();
  });

  it('las coordenadas exportadas deben coincidir EXACTAMENTE con las del layout-engine (fuente única de verdad)', () => {
    const state = Store.getState();
    const template = generateOMRTemplate();
    const layout = computeLayout(state.variables);

    expect(template.variables.length).toBe(layout.blocks.length);

    template.variables.forEach((exportedVar, i) => {
      const block = layout.blocks[i];
      exportedVar.options.forEach((exportedOpt, j) => {
        const expectedBox = absoluteOptionBox(block, block.options[j]);
        expect(exportedOpt.boundingBox).toEqual(expectedBox);
      });
    });
  });

  it('ninguna burbuja exportada debe caer fuera de los límites físicos de la página A4', () => {
    // Esta es la prueba que habría detectado el bug original: variables
    // con 7+ categorías generaban x_mm > 210 (fuera del ancho de la hoja).
    const template = generateOMRTemplate();

    template.variables.forEach(variable => {
      variable.options.forEach(opt => {
        expect(opt.boundingBox.x_mm).toBeGreaterThanOrEqual(0);
        expect(opt.boundingBox.x_mm + opt.boundingBox.width_mm).toBeLessThanOrEqual(PAGE_WIDTH_MM);
        expect(opt.boundingBox.y_mm).toBeGreaterThanOrEqual(0);
        expect(opt.boundingBox.y_mm + opt.boundingBox.height_mm).toBeLessThanOrEqual(PAGE_HEIGHT_MM);
      });
    });
  });

  it('la variable con 8 categorías (nivel_educativo) debe exportar 8 opciones, ninguna perdida por desborde', () => {
    const template = generateOMRTemplate();
    const nivelEducativo = template.variables.find(v => v.name === 'nivel_educativo');
    expect(nivelEducativo.options.length).toBe(8);
  });

});
