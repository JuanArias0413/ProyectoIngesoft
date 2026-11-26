import { describe, it, expect } from 'vitest';
import {
  HourlyPricing,
  DailyPricing,
  getPricingStrategy,
  calculateRentalPrice,
} from '../../src/modules/rentals/domain/pricing/index.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

describe('Pricing Strategies', () => {
  describe('HourlyPricing', () => {
    const hourly = new HourlyPricing();
    const ratePerHour = 450_000; // Tarifa Auditorio Principal (lucrativo)

    it('calcula horas exactas correctamente', () => {
      const startsAt = new Date('2026-11-10T10:00:00.000Z');
      const endsAt = new Date('2026-11-10T12:00:00.000Z'); // 2 horas

      const result = hourly.calculate(startsAt, endsAt, ratePerHour);

      expect(result.unit).toBe('HOUR');
      expect(result.unitsBilled).toBe(2);
      expect(result.durationHours).toBe(2);
      expect(result.unitPricePesos).toBe(ratePerHour);
      expect(result.amountPesos).toBe(900_000);
    });

    it('redondea hacia arriba fracciones de hora (1 hora y 15 minutos se factura como 2 horas)', () => {
      const startsAt = new Date('2026-11-10T10:00:00.000Z');
      const endsAt = new Date('2026-11-10T11:15:00.000Z'); // 1h 15m = 1.25 horas

      const result = hourly.calculate(startsAt, endsAt, ratePerHour);

      expect(result.unitsBilled).toBe(2);
      expect(result.durationHours).toBe(1.25);
      expect(result.amountPesos).toBe(900_000);
    });

    it('factura mínimo 1 hora para intervalos menores a 60 minutos', () => {
      const startsAt = new Date('2026-11-10T10:00:00.000Z');
      const endsAt = new Date('2026-11-10T10:30:00.000Z'); // 30 minutos

      const result = hourly.calculate(startsAt, endsAt, ratePerHour);

      expect(result.unitsBilled).toBe(1);
      expect(result.durationHours).toBe(0.5);
      expect(result.amountPesos).toBe(450_000);
    });

    it('maneja correctamente cruces de medianoche / cruce de días', () => {
      const startsAt = new Date('2026-11-10T22:00:00.000Z');
      const endsAt = new Date('2026-11-11T03:00:00.000Z'); // 5 horas a través de medianoche

      const result = hourly.calculate(startsAt, endsAt, ratePerHour);

      expect(result.unitsBilled).toBe(5);
      expect(result.durationHours).toBe(5);
      expect(result.amountPesos).toBe(2_250_000);
    });

    it('maneja cruce de días con fracción de hora', () => {
      const startsAt = new Date('2026-11-10T22:00:00.000Z');
      const endsAt = new Date('2026-11-11T02:45:00.000Z'); // 4h 45m = 4.75 horas -> 5 horas

      const result = hourly.calculate(startsAt, endsAt, ratePerHour);

      expect(result.unitsBilled).toBe(5);
      expect(result.amountPesos).toBe(2_250_000);
    });

    it('rechaza rango donde endsAt <= startsAt con ValidationError', () => {
      const d1 = new Date('2026-11-10T10:00:00.000Z');
      const d2 = new Date('2026-11-10T10:00:00.000Z');
      const dPast = new Date('2026-11-10T09:00:00.000Z');

      expect(() => hourly.calculate(d1, d2, ratePerHour)).toThrow(ValidationError);
      expect(() => hourly.calculate(d1, dPast, ratePerHour)).toThrow(ValidationError);
    });

    it('rechaza precios unitarios negativos o fechas inválidas', () => {
      const d1 = new Date('2026-11-10T10:00:00.000Z');
      const d2 = new Date('2026-11-10T12:00:00.000Z');

      expect(() => hourly.calculate(d1, d2, -500)).toThrow(ValidationError);
      expect(() => hourly.calculate(new Date('invalid'), d2, ratePerHour)).toThrow(
        ValidationError,
      );
      expect(() => hourly.calculate(d1, new Date('invalid'), ratePerHour)).toThrow(
        ValidationError,
      );
    });
  });

  describe('DailyPricing', () => {
    const daily = new DailyPricing();
    const ratePerDay = 3_200_000; // Tarifa Teatro Santiago Londoño (lucrativo)

    it('calcula 1 día para eventos dentro de las 24 horas', () => {
      const startsAt = new Date('2026-11-10T08:00:00.000Z');
      const endsAt = new Date('2026-11-10T18:00:00.000Z'); // 10 horas

      const result = daily.calculate(startsAt, endsAt, ratePerDay);

      expect(result.unit).toBe('DAY');
      expect(result.unitsBilled).toBe(1);
      expect(result.durationHours).toBe(10);
      expect(result.amountPesos).toBe(3_200_000);
    });

    it('factura exactamente 1 día para un bloque completo de 24 horas', () => {
      const startsAt = new Date('2026-11-10T10:00:00.000Z');
      const endsAt = new Date('2026-11-11T10:00:00.000Z'); // 24 horas exactas

      const result = daily.calculate(startsAt, endsAt, ratePerDay);

      expect(result.unitsBilled).toBe(1);
      expect(result.durationHours).toBe(24);
      expect(result.amountPesos).toBe(3_200_000);
    });

    it('factura 2 días al superar 24 horas (cruce de días con fracción)', () => {
      const startsAt = new Date('2026-11-10T10:00:00.000Z');
      const endsAt = new Date('2026-11-11T11:00:00.000Z'); // 25 horas

      const result = daily.calculate(startsAt, endsAt, ratePerDay);

      expect(result.unitsBilled).toBe(2);
      expect(result.durationHours).toBe(25);
      expect(result.amountPesos).toBe(6_400_000);
    });

    it('factura múltiples días completos y fracciones (ej. 60 horas = 3 días)', () => {
      const startsAt = new Date('2026-11-10T08:00:00.000Z');
      const endsAt = new Date('2026-11-12T20:00:00.000Z'); // 60 horas -> 2.5 días -> 3 días

      const result = daily.calculate(startsAt, endsAt, ratePerDay);

      expect(result.unitsBilled).toBe(3);
      expect(result.amountPesos).toBe(9_600_000);
    });

    it('rechaza rango donde endsAt <= startsAt con ValidationError', () => {
      const d1 = new Date('2026-11-10T10:00:00.000Z');
      const d2 = new Date('2026-11-10T10:00:00.000Z');

      expect(() => daily.calculate(d1, d2, ratePerDay)).toThrow(ValidationError);
    });
  });

  describe('calculateRentalPrice & Strategy Selector', () => {
    it('selecciona la estrategia correcta según la unidad', () => {
      const hourlyStrategy = getPricingStrategy('HOUR');
      expect(hourlyStrategy).toBeInstanceOf(HourlyPricing);

      const dailyStrategy = getPricingStrategy('DAY');
      expect(dailyStrategy).toBeInstanceOf(DailyPricing);
    });

    it('lanza ValidationError para unidades desconocidas', () => {
      expect(() => getPricingStrategy('MONTH' as unknown as 'HOUR')).toThrow(ValidationError);
    });

    it('calcula el precio utilizando la tarifa proporcionada', () => {
      const startsAt = new Date('2026-11-10T08:00:00.000Z');
      const endsAt = new Date('2026-11-10T12:00:00.000Z'); // 4h

      const result = calculateRentalPrice({
        startsAt,
        endsAt,
        tariff: { pricePesos: 250_000, unit: 'HOUR' },
      });

      expect(result.unitsBilled).toBe(4);
      expect(result.amountPesos).toBe(1_000_000);
    });

    it('lanza NotFoundError si no se proporciona tarifa (sin tarifa)', () => {
      const startsAt = new Date('2026-11-10T08:00:00.000Z');
      const endsAt = new Date('2026-11-10T12:00:00.000Z');

      expect(() => calculateRentalPrice({ startsAt, endsAt, tariff: null })).toThrow(
        NotFoundError,
      );
      expect(() => calculateRentalPrice({ startsAt, endsAt, tariff: undefined })).toThrow(
        NotFoundError,
      );
    });
  });
});
