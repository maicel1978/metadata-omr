// tests/layout-engine.test.js
//
// Estas pruebas existen específicamente para el problema central que
// motivó esta reescritura: variables con muchas categorías generaban
// burbujas con coordenadas fuera del borde físico de la página A4. La
// prueba más importante de este archivo es la que recorre TODAS las
// burbujas calculadas y verifica que ninguna caiga fuera de la página.

import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  getDigitConfig,
  absoluteOptionBox,
  absoluteBlockBox,
  absoluteLabelBox,
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MAX_INT_DIGITS
} from '../js/core/layout-engine.js';

function makeNominalVariable(name, categoryCount) {
  return {
    name,
    type: 'Nominal Politómica',
    metadata: {
      question: `¿${name}?`,
      categories: Array.from({ length: categoryCount }, (_, i) => ({
        label: `Categoría ${i + 1} con texto más largo de lo normal`,
        synonyms: []
      }))
    }
  };
}

describe('layout-engine: ninguna burbuja debe caer fuera de la página', () => {

  it('una variable Politómica con muchas categorías (10) debe envolver en varias filas, no salirse de la página', () => {
    const variable = makeNominalVariable('nivel_educativo', 10);
    const layout = computeLayout([variable]);

    expect(layout.errors.length).toBe(0);

    layout.blocks.forEach(block => {
      block.options.forEach(option => {
        const box = absoluteOptionBox(block, option);
        expect(box.x_mm).toBeGreaterThanOrEqual(0);
        expect(box.x_mm + box.width_mm).toBeLessThanOrEqual(PAGE_WIDTH_MM);
        expect(box.y_mm).toBeGreaterThanOrEqual(0);
        expect(box.y_mm + box.height_mm).toBeLessThanOrEqual(PAGE_HEIGHT_MM);
      });
    });
  });

  it('lo mismo debe cumplirse con un Ordinal de muchas categorías (antes solo Politómica escalaba su altura)', () => {
    const variable = { ...makeNominalVariable('severidad', 9), type: 'Ordinal' };
    const layout = computeLayout([variable]);

    layout.blocks.forEach(block => {
      block.options.forEach(option => {
        const box = absoluteOptionBox(block, option);
        expect(box.x_mm + box.width_mm).toBeLessThanOrEqual(PAGE_WIDTH_MM);
      });
    });
  });

  it('20 variables cualitativas variadas no deben generar ninguna burbuja fuera de los límites de ninguna página', () => {
    const variables = Array.from({ length: 20 }, (_, i) =>
      makeNominalVariable(`var_${i}`, 3 + (i % 8))
    );
    const layout = computeLayout(variables);

    expect(layout.blocks.length).toBe(20);

    layout.blocks.forEach(block => {
      const blockBox = absoluteBlockBox(block);
      expect(blockBox.y_mm + blockBox.height_mm).toBeLessThanOrEqual(PAGE_HEIGHT_MM);

      block.options.forEach(option => {
        const box = absoluteOptionBox(block, option);
        expect(box.x_mm).toBeGreaterThanOrEqual(0);
        expect(box.x_mm + box.width_mm).toBeLessThanOrEqual(PAGE_WIDTH_MM);
      });
    });
  });

  it('una variable con una cantidad extrema de categorías (60) debe rechazarse en vez de desbordar el borde inferior de la página', () => {
    // Encontrado en la auditoría final: un solo bloque que necesita más
    // alto que el máximo disponible en CUALQUIER página (incluso
    // empezando en la primera fila) no tenía ningún chequeo — se
    // desbordaba por el borde inferior sin avisar a nadie.
    const variable = makeNominalVariable('diagnostico_extenso', 60);
    const layout = computeLayout([variable]);
    expect(layout.errors.length).toBeGreaterThan(0);
    expect(layout.errors[0]).toContain('diagnostico_extenso');
  });

  it('el texto de una categoría nunca debe superponerse con la burbuja de la opción siguiente', () => {
    // Bug crítico reportado por el usuario el 2026-06-20: el nombre de la
    // categoría se imprimía DENTRO de la propia burbuja (5mm), se
    // desbordaba visualmente sobre la burbuja vecina, y contaminaba su
    // densidad de tinta — el Lector OMR terminaba marcando la categoría
    // "complementaria" a la que realmente se había rellenado a mano.
    //
    // Esta prueba verifica geométricamente que ya no puede pasar: el
    // rectángulo de texto de cada opción (`labelBox`) nunca se solapa con
    // el círculo (`boundingBox`) de NINGUNA otra opción de la misma
    // variable, sin importar qué tan largo sea el nombre de la categoría.
    const variable = {
      name: 'sexo',
      type: 'Nominal Dicotómica',
      metadata: {
        question: '¿Sexo biológico del paciente?',
        categories: [
          { label: 'Masculino', synonyms: [] },
          { label: 'Femenino', synonyms: [] }
        ]
      }
    };

    const layout = computeLayout([variable]);
    const block = layout.blocks[0];

    function overlaps(a, b) {
      return !(
        a.x_mm + a.width_mm <= b.x_mm ||
        b.x_mm + b.width_mm <= a.x_mm ||
        a.y_mm + a.height_mm <= b.y_mm ||
        b.y_mm + b.height_mm <= a.y_mm
      );
    }

    block.options.forEach(optionWithLabel => {
      const labelBox = absoluteLabelBox(block, optionWithLabel);
      expect(labelBox).not.toBeNull();

      block.options.forEach(otherOption => {
        if (otherOption === optionWithLabel) return;
        const otherBubble = absoluteOptionBox(block, otherOption);
        expect(overlaps(labelBox, otherBubble)).toBe(false);
      });
    });
  });

  it('una categoría con un nombre muy largo no debe hacer que su propio texto se superponga con la burbuja de la siguiente fila/columna', () => {
    const variable = makeNominalVariable('comorbilidad_principal', 5);
    // Forzamos un nombre extremadamente largo en la primera categoría
    variable.metadata.categories[0].label = 'Insuficiencia cardíaca congestiva descompensada de origen multifactorial';

    const layout = computeLayout([variable]);
    const block = layout.blocks[0];

    function overlaps(a, b) {
      return !(
        a.x_mm + a.width_mm <= b.x_mm ||
        b.x_mm + b.width_mm <= a.x_mm ||
        a.y_mm + a.height_mm <= b.y_mm ||
        b.y_mm + b.height_mm <= a.y_mm
      );
    }

    const longLabelOption = block.options[0];
    const longLabelBox = absoluteLabelBox(block, longLabelOption);

    block.options.slice(1).forEach(otherOption => {
      const otherBubble = absoluteOptionBox(block, otherOption);
      expect(overlaps(longLabelBox, otherBubble)).toBe(false);
    });
  });

});

describe('layout-engine: dígitos de variables cuantitativas', () => {

  it('un rango pequeño (0-120) debe necesitar 3 dígitos enteros y 0 decimales', () => {
    const variable = { name: 'edad', type: 'Cuantitativa Discreta', metadata: { range: { min: '0', max: '120' } } };
    const config = getDigitConfig(variable);
    expect(config.intDigits).toBe(3);
    expect(config.decDigits).toBe(0);
    expect(config.overflow).toBe(false);
  });

  it('una variable Continua debe reservar al menos 1 decimal por defecto', () => {
    const variable = { name: 'imc', type: 'Cuantitativa Continua', metadata: { range: { min: '10', max: '60' } } };
    const config = getDigitConfig(variable);
    expect(config.decDigits).toBe(1);
  });

  it('un rango que exceda MAX_INT_DIGITS debe marcarse como overflow, no truncarse en silencio', () => {
    // Antes, form-compiler/view.js y printer/service.js calculaban
    // `digits = maxValue > 99 ? 3 : 2` y truncaban silenciosamente
    // cualquier valor mayor a 999, sin avisar a nadie.
    const variable = { name: 'celulas', type: 'Cuantitativa Discreta', metadata: { range: { min: '0', max: '500000' } } };
    const config = getDigitConfig(variable);
    expect(config.overflow).toBe(true);
  });

  it('computeLayout debe rechazar (con un error legible) una variable cuyo rango no se puede representar', () => {
    const variable = { name: 'celulas', type: 'Cuantitativa Discreta', metadata: { range: { min: '0', max: '500000' } } };
    const layout = computeLayout([variable]);
    expect(layout.errors.length).toBeGreaterThan(0);
    expect(layout.errors[0]).toContain('celulas');
  });

  it(`MAX_INT_DIGITS debe ser un techo razonable (>=3, <=5)`, () => {
    expect(MAX_INT_DIGITS).toBeGreaterThanOrEqual(3);
    expect(MAX_INT_DIGITS).toBeLessThanOrEqual(5);
  });

});

describe('layout-engine: paginación determinista', () => {

  it('debe paginar de forma estable: compilar dos veces el mismo input da el mismo resultado', () => {
    const variables = Array.from({ length: 15 }, (_, i) => makeNominalVariable(`v${i}`, 4));
    const layoutA = computeLayout(variables);
    const layoutB = computeLayout(variables);

    expect(layoutA.pages).toBe(layoutB.pages);
    expect(layoutA.blocks.map(b => b.page)).toEqual(layoutB.blocks.map(b => b.page));
  });

});
