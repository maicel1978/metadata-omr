// js/features/omr-reader/detection.js
// Motor de detección OMR con Strategy Pattern para el umbral.
//
// Cambios respecto a la versión anterior:
// 1. `analyzeRegion` ya no usa una constante fija `pxPerMm = 3.78`. Recibe
//    un objeto de calibración (ver calibration.js) que convierte mm -> px
//    usando la escala/desplazamiento reales de la imagen analizada.
// 2. Cada entrada de `details` ahora incluye su propio `boundingBox` (en
//    mm). Antes no se guardaba, así que la vista de depuración
//    (drawBoundingBoxes) nunca tenía nada que dibujar — el recuadro
//    verde/rojo prometido en la documentación nunca se veía en pantalla.
// 3. Se añade un piso absoluto de densidad de tinta: una burbuja solo
//    puede marcarse como "seleccionada" si además de superar el umbral
//    relativo, su densidad supera un mínimo absoluto. Esto evita falsos
//    positivos cuando una pregunta se deja completamente en blanco y
//    todas las densidades son ruido bajo.
// 4. Se recorta hacia el interior de cada burbuja antes de medir (ver
//    INK_SAMPLE_INSET_RATIO), para que el borde impreso de la burbuja no
//    contamine la comparación entre marcada/sin marcar.
// 5. Cada detalle ahora incluye `fullRectPx`/`sampledRectPx` — los
//    rectángulos EN PÍXELES REALES de la imagen que se usaron. Esto
//    permite construir un recorte visual ("qué miró exactamente el
//    sistema") para diagnosticar desajustes de calibración de forma
//    directa, en vez de inferirlos de números o colores.

import { FixedThresholdStrategy } from './strategies/FixedThresholdStrategy.js';
import { AdaptiveThresholdStrategy } from './strategies/AdaptiveThresholdStrategy.js';
import { BaseThresholdStrategy } from './strategies/BaseThresholdStrategy.js';

const DARK_PIXEL_LUMA = 120;
const MIN_INK_DENSITY = 0.08; // piso absoluto, independiente del umbral relativo

// El borde impreso de cada burbuja (círculo negro de ~1.3pt) ocupa, por sí
// solo, una porción considerable del área de la burbuja (~25-30% de su
// densidad en una burbuja de 5mm) — IGUAL si está marcada que si no. Si se
// midiera el área completa de la burbuja, esa "densidad base" del borde
// podría acercarse o incluso superar la de una marca real hecha a mano que
// no sea un relleno perfecto, dificultando (o invirtiendo, si además hay
// un pequeño desajuste de calibración) la separación entre marcada/vacía.
// Por eso solo se analiza la región CENTRAL de cada burbuja — casi
// exclusivamente su interior, donde el papel está blanco si no se marcó y
// oscuro si sí — recortando un porcentaje de cada lado.
const INK_SAMPLE_INSET_RATIO = 0.16;

export class OMRDetector {
  constructor(strategy = 'adaptive') {
    this.setStrategy(strategy);
  }

  setStrategy(strategy) {
    if (strategy === 'adaptive' || strategy instanceof AdaptiveThresholdStrategy) {
      this.thresholdStrategy = new AdaptiveThresholdStrategy();
    } else if (strategy === 'fixed' || strategy instanceof FixedThresholdStrategy) {
      this.thresholdStrategy = new FixedThresholdStrategy(strategy.fixedThreshold || 0.15);
    } else if (strategy instanceof BaseThresholdStrategy) {
      this.thresholdStrategy = strategy;
    } else {
      this.thresholdStrategy = new AdaptiveThresholdStrategy();
    }
  }

  /**
   * Analiza un bounding box (en mm) y calcula densidad de píxeles oscuros,
   * usando la calibración real de la imagen en vez de una escala fija.
   *
   * Devuelve, además de la densidad, los rectángulos en píxeles reales
   * usados (`fullRectPx`: la burbuja completa antes del recorte;
   * `sampledRectPx`: la región interior efectivamente analizada). Esto
   * permite construir un recorte visual de "qué miró el sistema
   * exactamente" para cada burbuja — la forma más directa y robusta de
   * diagnosticar un desajuste de calibración (en vez de inferirlo de
   * números de densidad o de colores en una captura de pantalla).
   */
  analyzeRegion(ctx, boundingBox, calibration, imageWidth, imageHeight) {
    const { x_mm, y_mm, width_mm, height_mm } = boundingBox;

    const topLeft = calibration.toPx(x_mm, y_mm);
    const bottomRight = calibration.toPx(x_mm + width_mm, y_mm + height_mm);

    const fullRectPx = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };

    let x = fullRectPx.x;
    let y = fullRectPx.y;
    let width = fullRectPx.width;
    let height = fullRectPx.height;

    // Recorte al interior de la burbuja (ver nota de INK_SAMPLE_INSET_RATIO).
    const insetX = width * INK_SAMPLE_INSET_RATIO;
    const insetY = height * INK_SAMPLE_INSET_RATIO;
    x += insetX;
    y += insetY;
    width -= insetX * 2;
    height -= insetY * 2;

    const safeX = Math.max(0, Math.min(Math.floor(x), imageWidth - 1));
    const safeY = Math.max(0, Math.min(Math.floor(y), imageHeight - 1));
    const safeWidth = Math.max(1, Math.min(Math.floor(width), imageWidth - safeX));
    const safeHeight = Math.max(1, Math.min(Math.floor(height), imageHeight - safeY));

    const sampledRectPx = { x: safeX, y: safeY, width: safeWidth, height: safeHeight };

    if (safeWidth <= 0 || safeHeight <= 0) {
      return { density: 0, pixelCount: 0, darkPixels: 0, fullRectPx, sampledRectPx };
    }

    const imageData = ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
    const data = imageData.data;

    let darkPixels = 0;
    const totalPixels = safeWidth * safeHeight;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < DARK_PIXEL_LUMA) darkPixels++;
    }

    const density = totalPixels > 0 ? darkPixels / totalPixels : 0;

    return {
      density: parseFloat(density.toFixed(4)),
      pixelCount: totalPixels,
      darkPixels,
      fullRectPx,
      sampledRectPx
    };
  }

  /**
   * Procesa una variable usando la estrategia de umbral actual.
   *
   * Nota de la auditoría final (2026-06-20): la versión anterior de este
   * método construía `allDensities` SALTÁNDOSE las opciones sin
   * boundingBox, y luego volvía a recorrer `variable.options` indexando
   * `allDensities[index]` con el índice ORIGINAL del array — si alguna
   * opción intermedia carecía de boundingBox (un .omr corrupto o
   * incompleto), todas las densidades posteriores a esa quedaban
   * desalineadas respecto a la opción real, atribuyendo silenciosamente
   * la densidad de una burbuja a la opción equivocada. Ahora cada opción
   * lleva su propia densidad ligada directamente a sí misma; no hay
   * indexación posicional que pueda desalinearse.
   */
  detectVariable(ctx, variable, calibration, imageWidth, imageHeight) {
    if (!variable.options || variable.options.length === 0) {
      return { variable: variable.name, value: null, confidence: 0, details: [] };
    }

    const analyzed = variable.options.map(option => {
      const bbox = option.boundingBox || option.bubble;
      if (!bbox) return { option, bbox: null, density: null };
      const analysis = this.analyzeRegion(ctx, bbox, calibration, imageWidth, imageHeight);
      return { option, bbox, density: analysis.density, fullRectPx: analysis.fullRectPx, sampledRectPx: analysis.sampledRectPx };
    });

    const validDensities = analyzed.filter(a => a.density !== null).map(a => a.density);
    const threshold = this.thresholdStrategy.calculateThreshold(validDensities);

    const results = [];
    let maxDensity = 0;
    let selectedOption = null;

    analyzed.forEach(({ option, bbox, density, fullRectPx, sampledRectPx }) => {
      if (bbox === null) return; // opción sin coordenadas: no se puede evaluar

      const isSelected = density >= threshold && density >= MIN_INK_DENSITY;

      results.push({
        label: option.label,
        density,
        isSelected,
        boundingBox: bbox,
        fullRectPx,
        sampledRectPx
      });

      if (isSelected && density > maxDensity) {
        maxDensity = density;
        selectedOption = option.label;
      }
    });

    const selectedCount = results.filter(r => r.isSelected).length;

    return {
      variable: variable.name,
      value: selectedCount === 1 ? selectedOption : null,
      confidence: maxDensity,
      details: results,
      usedThreshold: threshold,
      strategy: this.thresholdStrategy.getName()
    };
  }
}
