import { CustomerType, EventPurpose, PricingUnit } from '@prisma/client';
import { amountToWords } from '../../shared/utils/amountToWords.js';
import {
  formatBogotaDate,
  formatBogotaDateTime,
  formatBogotaTime,
  formatPesos,
} from '../../shared/utils/formatters.js';

const BOGOTA_TZ = 'America/Bogota';

export function formatDateLong(date: Date): string {
  return formatBogotaDate(date);
}

export function formatDateTime(date: Date): string {
  return formatBogotaDateTime(date);
}

export function formatTime(date: Date): string {
  return formatBogotaTime(date);
}

export function formatWeekdayAndDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return formatter.format(date);
}

export function formatDateRange(startsAt: Date, endsAt: Date): string {
  const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const startDay = dayKeyFormatter.format(startsAt);
  const endDay = dayKeyFormatter.format(endsAt);

  if (startDay === endDay) {
    const fullDate = formatWeekdayAndDate(startsAt);
    return `${fullDate}, de ${formatTime(startsAt)} a ${formatTime(endsAt)}`;
  }

  const startFormatted = `${formatWeekdayAndDate(startsAt)} a las ${formatTime(startsAt)}`;
  const endFormatted = `${formatWeekdayAndDate(endsAt)} a las ${formatTime(endsAt)}`;
  return `del ${startFormatted} al ${endFormatted}`;
}

export function formatCurrency(pesos: number): string {
  return formatPesos(pesos);
}

export function formatAmountWords(pesos: number): string {
  return amountToWords(pesos);
}

export function formatCustomerType(type: CustomerType): string {
  switch (type) {
    case CustomerType.NATURAL:
      return 'Persona Natural';
    case CustomerType.LEGAL:
      return 'Persona Jurídica';
    default:
      return type;
  }
}

export function formatPurpose(purpose: EventPurpose): string {
  switch (purpose) {
    case EventPurpose.LUCRATIVE:
      return 'Evento con fines de lucro';
    case EventPurpose.NON_LUCRATIVE:
      return 'Evento sin ánimo de lucro';
    default:
      return purpose;
  }
}

export function formatPricingUnit(unit: PricingUnit): string {
  switch (unit) {
    case PricingUnit.HOUR:
      return 'Hora';
    case PricingUnit.DAY:
      return 'Día';
    default:
      return unit;
  }
}
