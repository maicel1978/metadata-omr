// js/features/omr-exporter/service.js
// Generador de plantilla OMR determinista (.omr)

import Store from '../../core/store.js';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 20;
const BUBBLE_SIZE_MM = 5;
const BUBBLE_GAP_MM = 3;
const MAX_PAGE_HEIGHT_MM = PAGE_HEIGHT_MM - (MARGIN_MM * 2) - 10; // Margen de seguridad

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
      pageSize: {
        width_mm: PAGE_WIDTH_MM,
        height_mm: PAGE_HEIGHT_MM
      },
      margin_mm: MARGIN_MM,
      generatedAt: new Date().toISOString(),
      referenceImages: [] // Preparado para imágenes por página
    },
    pages: {},
    variables: []
  };

  // Agrupar bloques por página
  const blocksByPage = {};
  compiledForm.blocks.forEach(block => {
    if (!blocksByPage[block.page]) {
      blocksByPage[block.page] = [];
    }
    blocksByPage[block.page].push(block);
  });

  const pageNumbers = Object.keys(blocksByPage).map(Number).sort((a, b) => a - b);

  // Conversión más precisa (considerando que 1mm ≈ 3.78px a 96dpi)
  const PX_TO_MM_RATIO = 3.78;

  pageNumbers.forEach(pageNum => {
    const blocks = blocksByPage[pageNum];
    const pageVariables = [];

    let currentY = MARGIN_MM + 35;

    blocks.forEach((block) => {
      const categories = block.metadata?.categories || [];
      const blockHeightMM = (block.height / PX_TO_MM_RATIO) + 4;

      // Control de desbordamiento de página
      if (currentY + blockHeightMM > MAX_PAGE_HEIGHT_MM) {
        console.warn(`[OMR Exporter] Variable "${block.name}" excede el límite de la página ${pageNum}`);
      }

      // === Bounding Box principal de la variable ===
      const variableBoundingBox = {
        x_mm: MARGIN_MM,
        y_mm: currentY,
        width_mm: PAGE_WIDTH_MM - (MARGIN_MM * 2),
        height_mm: blockHeightMM
      };

      const variable = {
        id: block.id,
        name: block.name,
        type: block.type,
        page: pageNum,
        question: block.question,
        
        // Bounding Box estable para detección futura
        boundingBox: variableBoundingBox,
        
        // Metadata de referencia
        reference: {
          fieldId: block.name,
          expectedType: block.type,
          hasOptions: categories.length > 0
        },
        
        bubble: {
          size_mm: BUBBLE_SIZE_MM,
          gap_mm: BUBBLE_GAP_MM
        },
        options: []
      };

      // =====================================================
      // GENERACIÓN DE BURBUJAS PARA TODOS LOS TIPOS
      // =====================================================

      const range = block.metadata?.range;
      const maxValue = range && range.max ? parseInt(range.max) : 99;

      if (block.type.includes('Dicotómica') || 
          block.type.includes('Politómica') || 
          block.type === 'Ordinal') {
        
        // Opciones con bounding box individual
        categories.forEach((cat, optIndex) => {
          const optionX = MARGIN_MM + (optIndex * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 9));
          
          variable.options.push({
            label: cat.label,
            value: cat.label,
            boundingBox: {
              x_mm: optionX,
              y_mm: currentY + 8,
              width_mm: BUBBLE_SIZE_MM,
              height_mm: BUBBLE_SIZE_MM
            },
            bubble: {
              x_mm: optionX,
              y_mm: currentY + 8,
              width_mm: BUBBLE_SIZE_MM,
              height_mm: BUBBLE_SIZE_MM
            }
          });
        });

        currentY += blockHeightMM + 14;

      } else if (block.type.includes('Cuantitativa')) {
        
        if (maxValue <= 30) {
          // Burbujas individuales (0 - maxValue)
          for (let i = 0; i <= maxValue; i++) {
            const optionX = MARGIN_MM + (i * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 3));
            
            variable.options.push({
              label: String(i),
              value: i,
              boundingBox: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              },
              bubble: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              }
            });
          }
        } else if (maxValue <= 99) {
          // Formato de 2 dígitos
          for (let i = 0; i <= 9; i++) {
            const optionX = MARGIN_MM + (i * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 2));
            variable.options.push({
              label: `Decenas-${i}`,
              value: i,
              boundingBox: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              },
              bubble: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              }
            });
          }

          for (let i = 0; i <= 9; i++) {
            const optionX = MARGIN_MM + 60 + (i * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 2));
            variable.options.push({
              label: `Unidades-${i}`,
              value: i,
              boundingBox: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              },
              bubble: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              }
            });
          }
        } else {
          // Formato de 3 dígitos (Centenas + Decenas + Unidades)
          for (let i = 0; i <= 9; i++) {
            const optionX = MARGIN_MM + (i * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 1.8));
            variable.options.push({
              label: `Centenas-${i}`,
              value: i,
              boundingBox: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              },
              bubble: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              }
            });
          }

          for (let i = 0; i <= 9; i++) {
            const optionX = MARGIN_MM + 55 + (i * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 1.8));
            variable.options.push({
              label: `Decenas-${i}`,
              value: i,
              boundingBox: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              },
              bubble: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              }
            });
          }

          for (let i = 0; i <= 9; i++) {
            const optionX = MARGIN_MM + 110 + (i * (BUBBLE_SIZE_MM + BUBBLE_GAP_MM * 1.8));
            variable.options.push({
              label: `Unidades-${i}`,
              value: i,
              boundingBox: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              },
              bubble: {
                x_mm: optionX,
                y_mm: currentY + 8,
                width_mm: BUBBLE_SIZE_MM,
                height_mm: BUBBLE_SIZE_MM
              }
            });
          }
        }

        currentY += blockHeightMM + 18;

      } else if (block.type.includes('Cuantitativa')) {
        variable.options.push({
          label: "valor",
          value: null,
          
          boundingBox: {
            x_mm: MARGIN_MM + 120,
            y_mm: currentY + 6,
            width_mm: 25,
            height_mm: 7
          },
          
          input: {
            x_mm: MARGIN_MM + 120,
            y_mm: currentY + 6,
            width_mm: 25,
            height_mm: 7
          }
        });

        currentY += blockHeightMM + 12;
      }

      pageVariables.push(variable);
      template.variables.push(variable);
    });

    template.pages[pageNum] = {
      pageNumber: pageNum,
      variables: pageVariables,
      totalVariables: pageVariables.length,
      referenceImage: null // Se llenará cuando se escanee la página
    };
  });

  return template;
}

export function exportOMRTemplate() {
  const template = generateOMRTemplate();
  
  if (!template) {
    alert('No hay formulario compilado para exportar como plantilla OMR.');
    return;
  }

  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `formulario_${template.meta.project.name || 'sin_nombre'}_v${template.meta.version}.omr`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);


  return template;
}