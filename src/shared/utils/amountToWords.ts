import { ValidationError } from '../errors.js';

const UNITS: readonly string[] = [
  '',
  'un',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiún',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];

const TENS: readonly string[] = [
  '',
  'diez',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];

const HUNDREDS: readonly string[] = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function convertGroup(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  const parts: string[] = [];
  const c = Math.floor(n / 100);
  const r = n % 100;

  if (c > 0) {
    parts.push(HUNDREDS[c]);
  }

  if (r > 0) {
    if (r < 30) {
      parts.push(UNITS[r]);
    } else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      if (u === 0) {
        parts.push(TENS[d]);
      } else {
        parts.push(`${TENS[d]} y ${UNITS[u]}`);
      }
    }
  }

  return parts.filter(Boolean).join(' ');
}

export interface AmountToWordsOptions {
  currency?: string;
  currencyPlural?: string;
  suffix?: string;
}

/**
 * Convierte un monto entero en pesos colombianos (COP) a su representación en letras en español.
 * Cumple con las normas ortográficas de la RAE y la práctica contractual colombiana.
 * Ejemplo: 450000 -> "Cuatrocientos cincuenta mil pesos M/CTE"
 */
export function amountToWords(
  amount: number,
  options: AmountToWordsOptions = {},
): string {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new ValidationError('El monto debe ser un número entero');
  }

  if (amount < 0) {
    throw new ValidationError('El monto no puede ser negativo');
  }

  const currencySingular = options.currency ?? 'peso';
  const currencyPlural = options.currencyPlural ?? 'pesos';
  const suffix = options.suffix ?? 'M/CTE';

  if (amount === 0) {
    const res = `Cero ${currencyPlural}`;
    return suffix ? `${res} ${suffix}` : res;
  }

  if (amount === 1) {
    const res = `Un ${currencySingular}`;
    return suffix ? `${res} ${suffix}` : res;
  }

  // Descomposición en grupos de miles
  // Grupo 0: unidades (0 - 999)
  // Grupo 1: miles (1,000 - 999,999)
  // Grupo 2: millones (1,000,000 - 999,999,999)
  // Grupo 3: miles de millones (1,000,000,000 - 999,999,999,999)

  const billions = Math.floor(amount / 1_000_000_000_000);
  if (billions > 0) {
    throw new ValidationError('Montos superiores a un billón no están soportados');
  }

  const thousandsOfMillions = Math.floor((amount % 1_000_000_000_000) / 1_000_000);
  const remainderAfterMillions = amount % 1_000_000;
  const thousands = Math.floor(remainderAfterMillions / 1000);
  const units = remainderAfterMillions % 1000;

  const parts: string[] = [];

  if (thousandsOfMillions > 0) {
    if (thousandsOfMillions === 1) {
      parts.push('un millón');
    } else {
      const millionsText = convertMillionsGroup(thousandsOfMillions);
      parts.push(`${millionsText} millones`);
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mil');
    } else {
      parts.push(`${convertGroup(thousands)} mil`);
    }
  }

  if (units > 0) {
    parts.push(convertGroup(units));
  }

  const words = parts.join(' ').trim();

  // Regla RAE: si termina exactamente en "millón" o "millones" (sin miles ni unidades),
  // se añade la preposición "de" antes de la moneda (ej. "un millón de pesos").
  const isPureMillions = thousandsOfMillions > 0 && remainderAfterMillions === 0;
  const currencyString = isPureMillions ? `de ${currencyPlural}` : currencyPlural;

  const result = `${words} ${currencyString}`;
  const capitalized = result.charAt(0).toUpperCase() + result.slice(1);

  return suffix ? `${capitalized} ${suffix}` : capitalized;
}

function convertMillionsGroup(n: number): string {
  // Maneja hasta 999,999 millones
  const thousands = Math.floor(n / 1000);
  const units = n % 1000;
  const parts: string[] = [];

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mil');
    } else {
      parts.push(`${convertGroup(thousands)} mil`);
    }
  }

  if (units > 0) {
    parts.push(convertGroup(units));
  }

  return parts.join(' ').trim();
}
