import { describe, it, expect } from 'vitest';
import { CustomerType, EventPurpose, PricingUnit } from '@prisma/client';
import {
  formatDateLong,
  formatDateTime,
  formatTime,
  formatWeekdayAndDate,
  formatDateRange,
  formatCurrency,
  formatAmountWords,
  formatCustomerType,
  formatPurpose,
  formatPricingUnit,
} from '../../src/modules/documents/formatters.js';

describe('Document Formatters', () => {
  it('formats dates in America/Bogota locale', () => {
    // 2026-10-14 13:00 UTC is 08:00 in America/Bogota (UTC-5)
    const date = new Date('2026-10-14T13:00:00Z');

    expect(formatDateLong(date)).toBe('14 de octubre de 2026');
    expect(formatTime(date)).toBe('08:00');
    expect(formatDateTime(date)).toBe('14 de octubre de 2026, 08:00');
    expect(formatWeekdayAndDate(date)).toContain('octubre de 2026');
  });

  it('formats same-day date range in America/Bogota', () => {
    const startsAt = new Date('2026-10-14T13:00:00Z'); // 08:00 COT
    const endsAt = new Date('2026-10-14T19:00:00Z'); // 14:00 COT

    const range = formatDateRange(startsAt, endsAt);
    expect(range).toContain('14 de octubre de 2026');
    expect(range).toContain('08:00 a 14:00');
  });

  it('formats multi-day date range in America/Bogota', () => {
    const startsAt = new Date('2026-10-14T13:00:00Z'); // 14 Oct 08:00 COT
    const endsAt = new Date('2026-10-16T22:00:00Z'); // 16 Oct 17:00 COT

    const range = formatDateRange(startsAt, endsAt);
    expect(range).toContain('del ');
    expect(range).toContain('al ');
    expect(range).toContain('14 de octubre de 2026 a las 08:00');
    expect(range).toContain('16 de octubre de 2026 a las 17:00');
  });

  it('formats currency in COP format', () => {
    expect(formatCurrency(450000)).toMatch(/\$\s?450\.000/);
    expect(formatCurrency(3200000)).toMatch(/\$\s?3\.200\.000/);
  });

  it('converts amount to words in legal Spanish', () => {
    expect(formatAmountWords(450000)).toBe('Cuatrocientos cincuenta mil pesos M/CTE');
    expect(formatAmountWords(1000000)).toBe('Un millón de pesos M/CTE');
  });

  it('formats customer types, purposes and pricing units', () => {
    expect(formatCustomerType(CustomerType.NATURAL)).toBe('Persona Natural');
    expect(formatCustomerType(CustomerType.LEGAL)).toBe('Persona Jurídica');

    expect(formatPurpose(EventPurpose.LUCRATIVE)).toBe('Evento con fines de lucro');
    expect(formatPurpose(EventPurpose.NON_LUCRATIVE)).toBe('Evento sin ánimo de lucro');

    expect(formatPricingUnit(PricingUnit.HOUR)).toBe('Hora');
    expect(formatPricingUnit(PricingUnit.DAY)).toBe('Día');
  });
});
