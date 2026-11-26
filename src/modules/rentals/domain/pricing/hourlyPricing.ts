import { ValidationError } from '../../../../shared/errors.js';
import { PricingStrategy, PricingCalculationResult } from './pricingStrategy.js';

export class HourlyPricing implements PricingStrategy {
  public readonly unit = 'HOUR' as const;

  public calculate(
    startsAt: Date,
    endsAt: Date,
    unitPricePesos: number,
  ): PricingCalculationResult {
    if (!(startsAt instanceof Date) || isNaN(startsAt.getTime())) {
      throw new ValidationError('La fecha de inicio es inválida');
    }
    if (!(endsAt instanceof Date) || isNaN(endsAt.getTime())) {
      throw new ValidationError('La fecha de fin es inválida');
    }

    const diffMs = endsAt.getTime() - startsAt.getTime();
    if (diffMs <= 0) {
      throw new ValidationError('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    if (!Number.isFinite(unitPricePesos) || unitPricePesos < 0) {
      throw new ValidationError('El precio unitario no puede ser negativo');
    }

    const durationHours = diffMs / (1000 * 60 * 60);
    // Fracciones de hora se redondean hacia arriba (mínimo 1 hora según A-06)
    const unitsBilled = Math.max(1, Math.ceil(durationHours));
    const amountPesos = Math.round(unitsBilled * unitPricePesos);

    return {
      amountPesos,
      unitsBilled,
      unit: this.unit,
      unitPricePesos,
      durationHours,
    };
  }
}
