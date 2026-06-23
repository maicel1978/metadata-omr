// tests/omr-reader.test.js
import { OMRDetector } from '../js/features/omr-reader/detection.js';
import { describe, it, expect } from 'vitest';

// Calibración trivial para pruebas: 1mm = 2px, sin desplazamiento.
const identityCalibration = {
  toPx: (x_mm, y_mm) => ({ x: x_mm * 2, y: y_mm * 2 }),
  calibrated: true,
  confidence: 'marks-detected'
};

describe('OMRDetector', () => {

  it('analyzeRegion debe analizar una región más pequeña que la burbuja completa, centrada dentro de ella (evita medir el borde impreso)', () => {
    // El borde impreso de cualquier burbuja (~1.3pt) aporta por sí solo
    // una densidad de tinta considerable, igual en una burbuja marcada
    // que en una sin marcar. Por eso analyzeRegion recorta hacia el
    // interior antes de medir — esta prueba confirma que ese recorte
    // realmente ocurre, registrando qué rectángulo se le pide al canvas.
    const detector = new OMRDetector();

    let requested = null;
    const mockCtx = {
      getImageData(qx, qy, qw, qh) {
        requested = { x: qx, y: qy, width: qw, height: qh };
        return { data: new Uint8ClampedArray(qw * qh * 4).fill(255) };
      }
    };

    // Burbuja de 5mm con la calibración de prueba (1mm = 2px) -> 10x10px nominales.
    const bbox = { x_mm: 10, y_mm: 10, width_mm: 5, height_mm: 5 };
    detector.analyzeRegion(mockCtx, bbox, identityCalibration, 500, 500);

    const nominalX = 10 * 2, nominalY = 10 * 2, nominalSize = 5 * 2; // 20,20,10,10 en px

    expect(requested).not.toBeNull();
    // La región analizada debe ser estrictamente más chica que la burbuja completa.
    expect(requested.width).toBeLessThan(nominalSize);
    expect(requested.height).toBeLessThan(nominalSize);
    // Debe quedar centrada dentro de la burbuja, no desplazada hacia una esquina.
    expect(requested.x).toBeGreaterThan(nominalX);
    expect(requested.y).toBeGreaterThan(nominalY);
    expect(requested.x + requested.width).toBeLessThan(nominalX + nominalSize);
    expect(requested.y + requested.height).toBeLessThan(nominalY + nominalSize);
  });

  it('debería instanciarse correctamente', () => {
    const detector = new OMRDetector();
    expect(detector).toBeInstanceOf(OMRDetector);
  });

  it('debería instanciarse con estrategia adaptativa por defecto', () => {
    const detector = new OMRDetector();
    expect(detector.thresholdStrategy).toBeDefined();
    expect(detector.thresholdStrategy.getName()).toBe('AdaptiveThresholdStrategy');
  });

  it('debería permitir cambiar de estrategia', () => {
    const detector = new OMRDetector('fixed');
    expect(detector.thresholdStrategy).toBeDefined();
    expect(detector.thresholdStrategy.getName()).toBe('FixedThresholdStrategy');
  });

  it('un valor no reconocido (p. ej. un número) debe caer a la estrategia adaptativa, no fallar en silencio', () => {
    // Antes, `new OMRDetector(0.12)` no lanzaba error pero tampoco hacía
    // nada: el número se ignoraba y se usaba adaptativa de todos modos sin
    // que quedara claro por qué. Se documenta explícitamente ese
    // comportamiento con una prueba.
    const detector = new OMRDetector(0.12);
    expect(detector.thresholdStrategy.getName()).toBe('AdaptiveThresholdStrategy');
  });

  it('debería analizar una región vacía sin errores usando una calibración', () => {
    const detector = new OMRDetector();

    const mockCtx = {
      getImageData: (qx, qy, qw, qh) => ({
        data: new Uint8ClampedArray(qw * qh * 4).fill(255) // todo blanco
      })
    };

    const bbox = { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 };

    const result = detector.analyzeRegion(mockCtx, bbox, identityCalibration, 200, 200);

    expect(result).toHaveProperty('density');
    expect(result).toHaveProperty('pixelCount');
    expect(result.density).toBe(0); // todo blanco -> ninguna marca
  });

  it('debería detectar una burbuja oscura como seleccionada', () => {
    const detector = new OMRDetector();

    const mockCtx = {
      getImageData: (qx, qy, qw, qh) => ({
        data: new Uint8ClampedArray(qw * qh * 4).fill(0) // todo negro
      })
    };

    const bbox = { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 };
    const result = detector.analyzeRegion(mockCtx, bbox, identityCalibration, 200, 200);

    expect(result.density).toBe(1);
  });

  it('detectVariable debe incluir el boundingBox de cada opción en los detalles', () => {
    // Antes, los resultados de detectVariable NO incluían el boundingBox,
    // lo que hacía que la vista de depuración (drawBoundingBoxes) nunca
    // tuviera nada que dibujar.
    const detector = new OMRDetector();

    const mockCtx = {
      getImageData: (qx, qy, qw, qh) => ({ data: new Uint8ClampedArray(qw * qh * 4).fill(255) })
    };

    const variable = {
      name: 'sexo',
      options: [
        { label: 'Masculino', value: 'Masculino', boundingBox: { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 } },
        { label: 'Femenino', value: 'Femenino', boundingBox: { x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 5 } }
      ]
    };

    const result = detector.detectVariable(mockCtx, variable, identityCalibration, 200, 200);

    expect(result.details.length).toBe(2);
    result.details.forEach(d => expect(d.boundingBox).toBeDefined());
  });

  it('no debe marcar como seleccionada una burbuja con densidad por debajo del piso absoluto de tinta', () => {
    // Si la pregunta está completamente en blanco, todas las densidades
    // son ruido bajo. Antes el umbral relativo podía forzar una
    // separación igual y marcar "seleccionada" la opción con más ruido.
    const detector = new OMRDetector();

    let call = 0;
    const mockCtx = {
      getImageData: (qx, qy, qw, qh) => {
        call++;
        // Primera opción: levemente más oscura por ruido, pero ambas muy por
        // debajo del piso absoluto de tinta (MIN_INK_DENSITY = 0.08).
        const fillValue = call === 1 ? 250 : 254;
        return { data: new Uint8ClampedArray(qw * qh * 4).fill(fillValue) };
      }
    };

    const variable = {
      name: 'hta',
      options: [
        { label: 'Sí', value: 'Sí', boundingBox: { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 } },
        { label: 'No', value: 'No', boundingBox: { x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 5 } }
      ]
    };

    const result = detector.detectVariable(mockCtx, variable, identityCalibration, 200, 200);

    expect(result.value).toBeNull();
  });

  it('una opción sin boundingBox no debe desalinear las densidades de las opciones siguientes', () => {
    // Bug encontrado en la auditoría final: si una opción intermedia no
    // tenía boundingBox, el código anterior indexaba `allDensities` con
    // el índice ORIGINAL del array (que sí incluía el hueco), atribuyendo
    // la densidad de una burbuja a la opción equivocada.
    const detector = new OMRDetector();

    let call = 0;
    const mockCtx = {
      getImageData: (qx, qy, qw, qh) => {
        call++;
        // La primera burbuja real (Masculino) es oscura; la segunda
        // (Femenino, después del hueco sin bbox) es clara.
        const fillValue = call === 1 ? 0 : 255;
        return { data: new Uint8ClampedArray(qw * qh * 4).fill(fillValue) };
      }
    };

    const variable = {
      name: 'sexo_con_hueco',
      options: [
        { label: 'Masculino', value: 'Masculino', boundingBox: { x_mm: 0, y_mm: 0, width_mm: 5, height_mm: 5 } },
        { label: 'Opción sin coordenadas', value: 'x' }, // sin boundingBox a propósito
        { label: 'Femenino', value: 'Femenino', boundingBox: { x_mm: 10, y_mm: 0, width_mm: 5, height_mm: 5 } }
      ]
    };

    const result = detector.detectVariable(mockCtx, variable, identityCalibration, 200, 200);

    // Debe haber exactamente 2 resultados (la opción sin bbox se omite),
    // y el resultado oscuro debe seguir siendo "Masculino", no "Femenino".
    expect(result.details.length).toBe(2);
    expect(result.value).toBe('Masculino');
  });

});
