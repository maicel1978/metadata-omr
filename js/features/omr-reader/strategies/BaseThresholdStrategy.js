// js/features/omr-reader/strategies/BaseThresholdStrategy.js
// Clase base abstracta para estrategias de umbral

export class BaseThresholdStrategy {
  constructor() {
    if (this.constructor === BaseThresholdStrategy) {
      throw new Error("BaseThresholdStrategy es abstracta y no puede instanciarse directamente");
    }
  }

  /**
   * Calcula el umbral basado en las densidades proporcionadas
   * @param {number[]} densities - Array de densidades de píxeles
   * @returns {number} - Umbral calculado
   */
  calculateThreshold(densities) {
    throw new Error("El método calculateThreshold debe ser implementado por la subclase");
  }

  getName() {
    return this.constructor.name;
  }
}