// tests/integration.test.js
//
// Esta prueba existe específicamente por el bug reportado por el usuario
// el 2026-06-20: el Lector OMR parecía detectar la categoría
// "complementaria" a la que realmente estaba marcada en el papel —
// visible sobre todo en variables dicotómicas. La causa raíz era que el
// texto de la categoría se imprimía DENTRO de su propia burbuja (5mm) y
// se desbordaba sobre la burbuja vecina, contaminando su densidad.
//
// Esta prueba usa el pipeline COMPLETO y real (compileForm ->
// coordenadas del layout-engine, las mismas que usaría omr-exporter) y
// simula una "imagen escaneada" donde el campo SOLO está oscuro en el
// píxel-rectángulo exacto de UNA opción real. Si el detector reporta esa
// opción, el bug está resuelto; si reporta la otra, no lo está.

import { describe, it, expect } from 'vitest';
import { compileForm } from '../js/features/form-compiler/service.js';
import { absoluteOptionBox } from '../js/core/layout-engine.js';
import { OMRDetector } from '../js/features/omr-reader/detection.js';

const PX_PER_MM = 4; // calibración de prueba: 1mm = 4px exactos, sin desplazamiento

function makeIdentityCalibration() {
  return {
    toPx: (x_mm, y_mm) => ({ x: x_mm * PX_PER_MM, y: y_mm * PX_PER_MM }),
    calibrated: true,
    confidence: 'marks-detected'
  };
}

// Crea un ctx falso que devuelve TODO NEGRO si el CENTRO del rectángulo
// consultado cae dentro del rectángulo (en píxeles) de la burbuja que se
// marcó; TODO BLANCO en cualquier otro caso. Se compara por centro (no por
// esquina exacta) para que la prueba siga siendo válida sin importar si
// detection.js recorta internamente el área que analiza dentro de cada
// burbuja (como ocurre desde el 2026-06-20, para evitar medir el borde
// impreso de la burbuja — ver detection.js).
function makeFakeCtx(markedPixelBox) {
  return {
    getImageData(qx, qy, qw, qh) {
      const centerX = qx + qw / 2;
      const centerY = qy + qh / 2;
      const inside =
        centerX >= markedPixelBox.x && centerX <= markedPixelBox.x + markedPixelBox.width &&
        centerY >= markedPixelBox.y && centerY <= markedPixelBox.y + markedPixelBox.height;
      const fill = inside ? 0 : 255;
      return { data: new Uint8ClampedArray(qw * qh * 4).fill(fill) };
    }
  };
}

function boxToPx(boxMm, calibration) {
  const topLeft = calibration.toPx(boxMm.x_mm, boxMm.y_mm);
  const bottomRight = calibration.toPx(boxMm.x_mm + boxMm.width_mm, boxMm.y_mm + boxMm.height_mm);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  };
}

describe('Integración: el detector identifica la burbuja realmente marcada, no la complementaria', () => {

  it('variable dicotómica (sexo): marcar "Femenino" debe detectar "Femenino", nunca "Masculino"', () => {
    const variables = [{
      name: 'sexo',
      type: 'Nominal Dicotómica',
      metadata: {
        question: '¿Sexo biológico del paciente?',
        categories: [
          { label: 'Masculino', synonyms: [] },
          { label: 'Femenino', synonyms: [] }
        ]
      }
    }];

    const compiled = compileForm(variables);
    const block = compiled.blocks[0];
    const femeninoOption = block.options.find(o => o.label === 'Femenino');
    const femeninoBoxMm = absoluteOptionBox(block, femeninoOption);

    const calibration = makeIdentityCalibration();
    const markedPixelBox = boxToPx(femeninoBoxMm, calibration);

    const ctx = makeFakeCtx(markedPixelBox);
    const detector = new OMRDetector('adaptive');

    // El detector necesita las opciones con boundingBox EN MM RELATIVOS AL
    // BLOQUE (igual que en el .omr real) — usamos directamente las del
    // compiledForm, que es exactamente lo que consume omr-exporter.
    // Igual que hace omr-exporter/service.js: las opciones que recibe el
    // detector real siempre llevan coordenadas ABSOLUTAS de página (ya
    // convertidas con absoluteOptionBox), nunca las relativas al bloque.
    const variableForDetector = {
      name: block.name,
      page: block.page,
      options: block.options.map(opt => ({ ...opt, boundingBox: absoluteOptionBox(block, opt) }))
    };

    const result = detector.detectVariable(ctx, variableForDetector, calibration, 2000, 2000);

    expect(result.value).toBe('Femenino');
    expect(result.value).not.toBe('Masculino');
  });

  it('lo mismo debe cumplirse al marcar "Masculino" en vez de "Femenino" (verifica que no hay un sesgo direccional fijo)', () => {
    const variables = [{
      name: 'sexo',
      type: 'Nominal Dicotómica',
      metadata: {
        question: '¿Sexo biológico del paciente?',
        categories: [
          { label: 'Masculino', synonyms: [] },
          { label: 'Femenino', synonyms: [] }
        ]
      }
    }];

    const compiled = compileForm(variables);
    const block = compiled.blocks[0];
    const masculinoOption = block.options.find(o => o.label === 'Masculino');
    const masculinoBoxMm = absoluteOptionBox(block, masculinoOption);

    const calibration = makeIdentityCalibration();
    const markedPixelBox = boxToPx(masculinoBoxMm, calibration);

    const ctx = makeFakeCtx(markedPixelBox);
    const detector = new OMRDetector('adaptive');

    const variableForDetector = {
      name: block.name,
      page: block.page,
      options: block.options.map(opt => ({ ...opt, boundingBox: absoluteOptionBox(block, opt) }))
    };
    const result = detector.detectVariable(ctx, variableForDetector, calibration, 2000, 2000);

    expect(result.value).toBe('Masculino');
  });

  it('variable Politómica con etiquetas largas (5 categorías): marcar la 3ra opción debe detectar exactamente la 3ra, no una vecina', () => {
    const variables = [{
      name: 'nivel_severidad',
      type: 'Nominal Politómica',
      metadata: {
        question: '¿Nivel de severidad clínica observado?',
        categories: [
          { label: 'Leve, sin compromiso sistémico', synonyms: [] },
          { label: 'Moderado, con compromiso leve', synonyms: [] },
          { label: 'Severo, con compromiso sistémico', synonyms: [] },
          { label: 'Crítico, riesgo vital inminente', synonyms: [] },
          { label: 'Terminal', synonyms: [] }
        ]
      }
    }];

    const compiled = compileForm(variables);
    const block = compiled.blocks[0];
    const targetOption = block.options[2]; // "Severo, con compromiso sistémico"
    const targetBoxMm = absoluteOptionBox(block, targetOption);

    const calibration = makeIdentityCalibration();
    const markedPixelBox = boxToPx(targetBoxMm, calibration);

    const ctx = makeFakeCtx(markedPixelBox);
    const detector = new OMRDetector('adaptive');
    const variableForDetector = {
      name: block.name,
      page: block.page,
      options: block.options.map(opt => ({ ...opt, boundingBox: absoluteOptionBox(block, opt) }))
    };
    const result = detector.detectVariable(ctx, variableForDetector, calibration, 2000, 2000);

    expect(result.value).toBe('Severo, con compromiso sistémico');
  });

});
