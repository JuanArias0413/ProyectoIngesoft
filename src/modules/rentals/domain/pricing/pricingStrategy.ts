import { PricingUnit } from '../../../catalog/domain/entities.js';

export interface PricingCalculationResult {
  amountPesos: number;
  unitsBilled: number;
  unit: PricingUnit;
  unitPricePesos: number;
  durationHours: number;
}

export interface PricingStrategy {
  readonly unit: PricingUnit;
  calculate(startsAt: Date, endsAt: Date, unitPricePesos: number): PricingCalculationResult;
}
