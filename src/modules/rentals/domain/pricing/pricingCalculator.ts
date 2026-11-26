import { PricingUnit } from '../../../catalog/domain/entities.js';
import { ValidationError, NotFoundError } from '../../../../shared/errors.js';
import { PricingStrategy, PricingCalculationResult } from './pricingStrategy.js';
import { HourlyPricing } from './hourlyPricing.js';
import { DailyPricing } from './dailyPricing.js';

const hourlyStrategy = new HourlyPricing();
const dailyStrategy = new DailyPricing();

export function getPricingStrategy(unit: PricingUnit): PricingStrategy {
  switch (unit) {
    case 'HOUR':
      return hourlyStrategy;
    case 'DAY':
      return dailyStrategy;
    default:
      throw new ValidationError(`Unidad de cobro no soportada: ${String(unit)}`);
  }
}

export interface TariffLike {
  pricePesos: number;
  unit: PricingUnit;
}

export function calculateRentalPrice(params: {
  startsAt: Date;
  endsAt: Date;
  tariff: TariffLike | null | undefined;
}): PricingCalculationResult {
  if (!params.tariff) {
    throw new NotFoundError(
      'No existe tarifa aplicable para el espacio y propósito seleccionados en las fechas indicadas',
    );
  }

  const strategy = getPricingStrategy(params.tariff.unit);
  return strategy.calculate(params.startsAt, params.endsAt, params.tariff.pricePesos);
}
