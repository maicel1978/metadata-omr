// js/features/omr-exporter/service.js
// Generador de la plantilla OMR (.omr)
//
// Antes, este archivo RECALCULABA la posición de cada burbuja con su
// propia aritmética (constantes BUBBLE_GAP_MM*9, *3, *2, *1.8 distintas
// según el caso), completamente desconectada de lo que printer/service.js
// realmente dibujaba. Eso es lo que permitía que, por ejemplo, una
// variable con 7+ categorías generara coordenadas fuera del borde físico
// de la página A4 (212mm en una hoja de 210mm de ancho).
//
// Ahora este archivo NO calcula nada: toma las cajas (bounding boxes) que
// ya calculó core/layout-engine.js para el mismo `compiledForm` que se usa
// en pantalla y en impresión, y simplemente las envuelve en el formato
// del archivo .omr. Las tres vistas leen exactamente el mismo número.

import Store from '../../core/store.js';
import { safeFileName } from '../../core/filename.js';
import { notify } from '../../core/notifications.js';
import {
  PAGE_WIDTH_MM,
  PAGE_HEIGHT_MM,
  MARGIN_MM,
  absoluteOptionBox,
  absoluteBlockBox
} from '../../core/layout-engine.js';

export function generateOMRTemplate() {
  const state = Store.getState();
  const { project, compiledForm } = state;

  if (!compiledForm || !compiledForm.blocks || compiledForm.blocks.length === 0) {
    return null;
  }

  const template = {
    meta: {
      formId: compiledForm.id,
      version: compiledForm.version,
      compiledAt: compiledForm.compiledAt,
      project: {
        name: project.name,
        specialty: project.specialty,
        date: project.date
      },
      pageSize: { width_mm: PAGE_WIDTH_MM, height_mm: PAGE_HEIGHT_MM },
      margin_mm: MARGIN_MM,
      generatedAt: new Date().toISOString()
    },
    pages: {},
    variables: []
  };

  const byPage = {};

  compiledForm.blocks.forEach(block => {
    const variable = {
      id: block.id,
      name: block.name,
      type: block.type,
      page: block.page,
      question: block.question,
      boundingBox: absoluteBlockBox(block),
      reference: {
        fieldId: block.name,
        expectedType: block.type,
        isQuantitative: block.isQuantitative
      },
      digitConfig: block.digitConfig || null,
      options: block.options.map(opt => ({
        label: opt.label,
        value: opt.value,
        digitKind: opt.digitKind || null,
        digitPosition: opt.digitPosition ?? null,
        boundingBox: absoluteOptionBox(block, opt)
      }))
    };

    template.variables.push(variable);
    if (!byPage[block.page]) byPage[block.page] = [];
    byPage[block.page].push(variable);
  });

  Object.keys(byPage).forEach(p => {
    template.pages[p] = {
      pageNumber: Number(p),
      variables: byPage[p],
      totalVariables: byPage[p].length
    };
  });

  return template;
}

export function exportOMRTemplate() {
  const template = generateOMRTemplate();

  if (!template) {
    notify.error('No hay formulario compilado para exportar como plantilla OMR.');
    return null;
  }

  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(template.meta.project.name, 'formulario')}_v${template.meta.version}.omr`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  notify.success('Plantilla .omr exportada correctamente.');
  return template;
}
