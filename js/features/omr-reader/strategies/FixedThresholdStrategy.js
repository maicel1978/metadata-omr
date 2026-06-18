// js/features/omr-reader/strategies/FixedThresholdStrategy.js
// Estrategia de umbral fijo (comportamiento original)

import { BaseThresholdStrategy } from './BaseThresholdStrategy.js';

export class FixedThresholdStrategy extends BaseThresholdStrategy {
  constructor(threshold = 0.15) {
    super();
    this.fixedThreshold = threshold;
  }

  calculateThreshold(densities) {
    return this.fixedThreshold;
  }
}