const BOGOTA_TZ = 'America/Bogota';

/**
 * Formats a Date or ISO string to a human-readable date and time in America/Bogota timezone.
 * Example: "14 de octubre de 2026, 10:30"
 */
export function formatBogotaDateTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const dateFormatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${dateFormatter.format(d)}, ${timeFormatter.format(d)}`;
}

/**
 * Formats a Date or ISO string to a compact date and time in America/Bogota timezone.
 * Example: "14/10/2026, 10:30"
 */
export function formatBogotaDateTimeCompact(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Formats a Date or ISO string to a date in America/Bogota timezone.
 * Example: "14 de octubre de 2026"
 */
export function formatBogotaDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Formats a Date or ISO string to a time in America/Bogota timezone.
 * Example: "10:30"
 */
export function formatBogotaTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Formats a number of Colombian pesos.
 * Example: 1500000 -> "$ 1.500.000"
 */
export function formatPesos(pesos: number | null | undefined): string {
  if (pesos === null || pesos === undefined || isNaN(pesos)) return '$ 0';
  return `$ ${pesos.toLocaleString('es-CO')}`;
}
