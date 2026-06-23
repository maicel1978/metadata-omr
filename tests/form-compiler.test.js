// tests/form-compiler.test.js
import { compileForm, isVariableComplete } from '../js/features/form-compiler/service.js';
import { describe, it, expect } from 'vitest';

describe('isVariableComplete', () => {

  it('debería rechazar una variable sin nombre', () => {
    const variable = {
      type: 'Nominal Dicotómica',
      metadata: {
        question: '¿Test?',
        categories: [{ label: 'Sí' }]
      }
    };
    expect(isVariableComplete(variable)).toBe(false);
  });

  it('debería rechazar una variable cuantitativa sin rango', () => {
    const variable = {
      name: 'edad',
      type: 'Cuantitativa Discreta',
      metadata: {
        question: '¿Edad?'
      }
    };
    expect(isVariableComplete(variable)).toBe(false);
  });

  it('debería aceptar una variable cualitativa válida', () => {
    const variable = {
      name: 'sexo',
      type: 'Nominal Dicotómica',
      metadata: {
        question: '¿Sexo?',
        categories: [{ label: 'Masculino' }, { label: 'Femenino' }]
      }
    };
    expect(isVariableComplete(variable)).toBe(true);
  });

  it('debería aceptar una variable cuantitativa válida', () => {
    const variable = {
      name: 'edad',
      type: 'Cuantitativa Discreta',
      metadata: {
        question: '¿Edad?',
        range: { min: '0', max: '120' }
      }
    };
    expect(isVariableComplete(variable)).toBe(true);
  });

});

describe('compileForm', () => {

  it('debería lanzar error si hay variables incompletas', () => {
    const variables = [
      {
        name: '',
        type: 'Nominal Dicotómica',
        metadata: { question: '¿Test?', categories: [] }
      }
    ];

    expect(() => compileForm(variables)).toThrow();
  });

  it('debería compilar correctamente variables válidas', () => {
    const variables = [
      {
        name: 'sexo',
        type: 'Nominal Dicotómica',
        metadata: {
          question: '¿Sexo?',
          categories: [{ label: 'Masculino' }, { label: 'Femenino' }]
        }
      },
      {
        name: 'edad',
        type: 'Cuantitativa Discreta',
        metadata: {
          question: '¿Edad?',
          range: { min: '0', max: '120' }
        }
      }
    ];

    const result = compileForm(variables);

    expect(result.blocks.length).toBe(2);
    expect(result.pages).toBeGreaterThanOrEqual(1);
    expect(result.id).toBeDefined();
    expect(result.compiledAt).toBeDefined();
  });

  it('debería generar más de una página si hay muchas variables', () => {
    const variables = Array.from({ length: 25 }, (_, i) => ({
      name: `variable_${i}`,
      type: 'Nominal Dicotómica',
      metadata: {
        question: `Pregunta ${i}`,
        categories: [{ label: 'Sí' }, { label: 'No' }]
      }
    }));

    const result = compileForm(variables);
    expect(result.pages).toBeGreaterThan(1);
  });

});