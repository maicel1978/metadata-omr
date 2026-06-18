// js/features/omr-reader/strategies/AdaptiveThresholdStrategy.js
// Estrategia de umbral adaptativo (basada en separación natural de densidades)

import { BaseThresholdStrategy } from './BaseThresholdStrategy.js';

export class AdaptiveThresholdStrategy extends BaseThresholdStrategy {
  constructor() {
    super();
  }

  calculateThreshold(densities) {
    if (!densities || densities.length === 0) return 0.15;

    const sorted = [...densities].sort((a, b) => a - b);
    const len = sorted.length;

    let bestThreshold = 0.15;
    let bestVariance = 0;

    for (let i = 1; i < len; i++) {
      const threshold = (sorted[i - 1] + sorted[i]) / 2;

      const group1 = sorted.filter(d => d < threshold);
      const group2 = sorted.filter(d => d >= threshold);

      if (group1.length === 0 || group2.length === 0) continue;

      const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
      const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;

      const variance = (group1.length * group2.length) * Math.pow(mean1 - mean2, 2);

      if (variance > bestVariance) {
        bestVariance = variance;
        bestThreshold = threshold;
      }
    }

    // Ajuste de seguridad
    return Math.max(0.05, Math.min(bestThreshold, 0.35));
  }
}