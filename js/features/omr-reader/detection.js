// js/features/omr-reader/detection.js
// Motor de detección OMR refactorizado con Strategy Pattern

import { FixedThresholdStrategy } from './strategies/FixedThresholdStrategy.js';
import { AdaptiveThresholdStrategy } from './strategies/AdaptiveThresholdStrategy.js';
import { BaseThresholdStrategy } from './strategies/BaseThresholdStrategy.js';

export class OMRDetector {
  constructor(strategy = 'adaptive') {
    this.setStrategy(strategy);
  }

  /**
   * Permite cambiar la estrategia de umbral en tiempo de ejecución
   */
  setStrategy(strategy) {
    if (strategy === 'adaptive' || strategy instanceof AdaptiveThresholdStrategy) {
      this.thresholdStrategy = new AdaptiveThresholdStrategy();
    } else if (strategy === 'fixed' || strategy instanceof FixedThresholdStrategy) {
      this.thresholdStrategy = new FixedThresholdStrategy(
        strategy.fixedThreshold || 0.15
      );
    } else if (strategy instanceof BaseThresholdStrategy) {
      this.thresholdStrategy = strategy;
    } else {
      // Fallback
      this.thresholdStrategy = new AdaptiveThresholdStrategy();
    }
  }

  /**
   * Analiza un bounding box y calcula densidad de píxeles oscuros
   */
  analyzeRegion(ctx, boundingBox, imageWidth, imageHeight) {
    const { x_mm, y_mm, width_mm, height_mm } = boundingBox;
    const pxPerMm = 3.78;

    const x = Math.floor(x_mm * pxPerMm);
    const y = Math.floor(y_mm * pxPerMm);
    const width = Math.floor(width_mm * pxPerMm);
    const height = Math.floor(height_mm * pxPerMm);

    const safeX = Math.max(0, Math.min(x, imageWidth - 1));
    const safeY = Math.max(0, Math.min(y, imageHeight - 1));
    const safeWidth = Math.min(width, imageWidth - safeX);
    const safeHeight = Math.min(height, imageHeight - safeY);

    if (safeWidth <= 0 || safeHeight <= 0) {
      return { density: 0, pixelCount: 0, darkPixels: 0 };
    }

    const imageData = ctx.getImageData(safeX, safeY, safeWidth, safeHeight);
    const data = imageData.data;

    let darkPixels = 0;
    const totalPixels = safeWidth * safeHeight;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avg < 120) darkPixels++;
    }

    const density = totalPixels > 0 ? darkPixels / totalPixels : 0;

    return {
      density: parseFloat(density.toFixed(4)),
      pixelCount: totalPixels,
      darkPixels
    };
  }

  /**
   * Procesa una variable usando la estrategia de umbral actual
   */
  detectVariable(ctx, variable, imageWidth, imageHeight) {
    const results = [];
    const allDensities = [];

    if (!variable.options || variable.options.length === 0) {
      return { variable: variable.name, value: null, confidence: 0 };
    }

    // Primera pasada: recolectar densidades
    variable.options.forEach(option => {
      const bbox = option.boundingBox || option.bubble;
      if (!bbox) return;

      const analysis = this.analyzeRegion(ctx, bbox, imageWidth, imageHeight);
      allDensities.push(analysis.density);
    });

    // Calcular umbral usando la estrategia actual
    const threshold = this.thresholdStrategy.calculateThreshold(allDensities);

    let maxDensity = 0;
    let selectedOption = null;

    // Segunda pasada: aplicar umbral
    variable.options.forEach((option, index) => {
      const bbox = option.boundingBox || option.bubble;
      if (!bbox) return;

      const density = allDensities[index];
      const isSelected = density >= threshold;

      results.push({
        label: option.label,
        density,
        isSelected
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