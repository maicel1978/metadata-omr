// js/features/omr-reader/calibration.js
//
// Calibración de escala/desplazamiento usando las 4 marcas de registro
// impresas en cada página (cuadrados negros de 6x6mm en las esquinas).
//
// ANTES: detection.js convertía mm -> px con una constante fija
// `pxPerMm = 3.78`, que solo es correcta si la imagen subida es EXACTAMENTE
// una página A4 escaneada a 96dpi sin recorte. Cualquier escaneo a 200/300/
// 600dpi (lo más común) o cualquier recorte del borde rompía por completo
// la correspondencia entre las coordenadas del .omr y la imagen real.
//
// AHORA: se busca el centroide de píxeles oscuros cerca de donde debería
// estar cada marca de registro, y se deriva una escala + desplazamiento
// reales a partir de su posición detectada. Esto corrige diferencias de
// DPI y pequeños desplazamientos de recorte.
//
// LO QUE ESTO **NO** HACE (alcance honesto, ver docs/OMR-ROADMAP.md):
// no corrige inclinación/rotación del escaneo. Si las 4 marcas no forman
// un rectángulo (hoja torcida al escanear/fotografiar), la calibración
// puede ser imprecisa. Cuando no se detectan las marcas con suficiente
// confianza, se usa una escala simple de respaldo y se marca el resultado
// como "no calibrado" para que el lector lo revise manualmente.

import { PAGE_WIDTH_MM, PAGE_HEIGHT_MM, REGISTRATION_MARK_SIZE_MM, REGISTRATION_MARK_OFFSET_MM } from '../../core/layout-engine.js';

const DARK_THRESHOLD = 100;
const SEARCH_RADIUS_MM = 12;

function findMarkCentroid(ctx, approxX, approxY, searchRadiusPx, imageWidth, imageHeight) {
  const minX = Math.max(0, Math.floor(approxX - searchRadiusPx));
  const minY = Math.max(0, Math.floor(approxY - searchRadiusPx));
  const maxX = Math.min(imageWidth, Math.floor(approxX + searchRadiusPx));
  const maxY = Math.min(imageHeight, Math.floor(approxY + searchRadiusPx));
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 4 || h <= 4) return null;

  let imageData;
  try {
    imageData = ctx.getImageData(minX, minY, w, h);
  } catch (e) {
    return null; // canvas "tainted" u otro error de seguridad; degradar con gracia
  }
  const data = imageData.data;

  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < DARK_THRESHOLD) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  const minDarkPixels = Math.max(20, w * h * 0.015);
  if (count < minDarkPixels) return null;

  return { x: minX + sumX / count, y: minY + sumY / count };
}

/**
 * Calibra una página a partir de su canvas ya dibujado.
 * Devuelve un objeto con `toPx(x_mm, y_mm)` para convertir cualquier
 * coordenada mm del .omr a píxeles reales de ESTA imagen específica.
 */
export function calibratePage(ctx, imageWidth, imageHeight) {
  const pxPerMmX0 = imageWidth / PAGE_WIDTH_MM;
  const pxPerMmY0 = imageHeight / PAGE_HEIGHT_MM;
  const searchRadiusPx = SEARCH_RADIUS_MM * Math.max(pxPerMmX0, pxPerMmY0);

  const markCenterOffset = REGISTRATION_MARK_OFFSET_MM + REGISTRATION_MARK_SIZE_MM / 2;
  const expected = {
    tl: { x: markCenterOffset, y: markCenterOffset },
    tr: { x: PAGE_WIDTH_MM - markCenterOffset, y: markCenterOffset },
    bl: { x: markCenterOffset, y: PAGE_HEIGHT_MM - markCenterOffset }
  };

  const detect = (pt) => findMarkCentroid(ctx, pt.x * pxPerMmX0, pt.y * pxPerMmY0, searchRadiusPx, imageWidth, imageHeight);

  const tl = detect(expected.tl);
  const tr = detect(expected.tr);
  const bl = detect(expected.bl);

  if (tl && tr && bl) {
    const pxPerMmX = (tr.x - tl.x) / (expected.tr.x - expected.tl.x);
    const pxPerMmY = (bl.y - tl.y) / (expected.bl.y - expected.tl.y);

    if (pxPerMmX > 0 && pxPerMmY > 0) {
      const offsetXPx = tl.x - expected.tl.x * pxPerMmX;
      const offsetYPx = tl.y - expected.tl.y * pxPerMmY;

      return {
        toPx: (x_mm, y_mm) => ({ x: offsetXPx + x_mm * pxPerMmX, y: offsetYPx + y_mm * pxPerMmY }),
        pxPerMmX,
        pxPerMmY,
        calibrated: true,
        confidence: 'marks-detected'
      };
    }
  }

  // Respaldo: escala simple basada en el tamaño de la imagen, sin corregir
  // desplazamientos. Mejor que nada, pero menos preciso.
  return {
    toPx: (x_mm, y_mm) => ({ x: x_mm * pxPerMmX0, y: y_mm * pxPerMmY0 }),
    pxPerMmX: pxPerMmX0,
    pxPerMmY: pxPerMmY0,
    calibrated: false,
    confidence: 'fallback-no-marks'
  };
}
