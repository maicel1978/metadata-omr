// tests/validator.test.js
import { validateClinicalStructure } from '../js/features/importer/validator.js';
import { describe, it, expect } from 'vitest';

describe('validateClinicalStructure', () => {

  it('debería rechazar un archivo que no es un objeto', () => {
    const result = validateClinicalStructure(null);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('debería rechazar un archivo sin campo project', () => {
    const data = {
      variables: []
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('project'))).toBe(true);
  });

  it('debería rechazar un archivo sin campo variables', () => {
    const data = {
      project: { name: 'Test' }
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('variables'))).toBe(true);
  });

  it('debería rechazar variables sin nombre', () => {
    const data = {
      project: { name: 'Test' },
      variables: [
        {
          type: 'Nominal Dicotómica',
          metadata: { question: '¿Test?', categories: [{ label: 'Sí' }] }
        }
      ]
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('.name'))).toBe(true);
  });

  it('debería rechazar variables cuantitativas sin rango válido', () => {
    const data = {
      project: { name: 'Test' },
      variables: [
        {
          name: 'edad',
          type: 'Cuantitativa Discreta',
          metadata: {
            question: '¿Edad?',
            range: { min: '', max: '' }
          }
        }
      ]
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('range'))).toBe(true);
  });

  it('debería rechazar variables cualitativas sin categorías', () => {
    const data = {
      project: { name: 'Test' },
      variables: [
        {
          name: 'sexo',
          type: 'Nominal Dicotómica',
          metadata: {
            question: '¿Sexo?',
            categories: []
          }
        }
      ]
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('categories'))).toBe(true);
  });

  it('debería aceptar un archivo válido', () => {
    const data = {
      project: { name: 'Investigación' },
      variables: [
        {
          name: 'sexo',
          type: 'Nominal Dicotómica',
          metadata: {
            question: '¿Sexo biológico?',
            categories: [
              { label: 'Masculino' },
              { label: 'Femenino' }
            ]
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
      ]
    };

    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('debería rechazar nombres de variable duplicados', () => {
    // Antes, dos variables con el mismo nombre pasaban la validación sin
    // problema y la segunda pisaba silenciosamente los datos de la
    // primera en cualquier estructura indexada por nombre.
    const data = {
      project: { name: 'Test' },
      variables: [
        { name: 'edad', type: 'Cuantitativa Discreta', metadata: { question: '¿Edad?', range: { min: '0', max: '100' } } },
        { name: 'Edad', type: 'Cuantitativa Discreta', metadata: { question: '¿Edad otra vez?', range: { min: '0', max: '100' } } }
      ]
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicado'))).toBe(true);
  });

  it('debería rechazar rangos con notación científica o texto suelto', () => {
    // Antes, un valor como "1e10" pasaba parseFloat() sin ser NaN y
    // generaba miles de columnas de dígitos en el formulario impreso.
    const data = {
      project: { name: 'Test' },
      variables: [
        { name: 'conteo', type: 'Cuantitativa Discreta', metadata: { question: '¿Conteo?', range: { min: '0', max: '1e10' } } }
      ]
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('números simples'))).toBe(true);
  });

  it('debería rechazar un rango que necesite más dígitos enteros de los representables', () => {
    const data = {
      project: { name: 'Test' },
      variables: [
        { name: 'celulas', type: 'Cuantitativa Discreta', metadata: { question: '¿Conteo celular?', range: { min: '0', max: '500000' } } }
      ]
    };
    const result = validateClinicalStructure(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('dígitos enteros'))).toBe(true);
  });

});