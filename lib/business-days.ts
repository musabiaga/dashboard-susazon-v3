/**
 * Días hábiles según convención del Dashboard Comercial Susazón:
 *   - L-S (Lunes a Sábado) son hábiles
 *   - Domingo NO es hábil
 *   - Feriados oficiales LFT (Ley Federal del Trabajo) NO son hábiles
 *
 * Portado del V2.2 (`isBusinessDay`, `getMexicanHolidays`, `countBizDays`).
 */

// Feriados LFT por año. Cada entrada es [mes (1-12), día].
// Los lunes "de cierre" (3er lunes de feb/mar/nov) cambian cada año.
const HOLIDAYS_BY_YEAR: Record<number, Array<[number, number]>> = {
  2024: [[1, 1], [2, 5], [3, 18], [5, 1], [9, 16], [11, 18], [12, 25]],
  2025: [[1, 1], [2, 3], [3, 17], [5, 1], [9, 16], [11, 17], [12, 25]],
  2026: [[1, 1], [2, 2], [3, 16], [5, 1], [9, 16], [11, 16], [12, 25]],
  2027: [[1, 1], [2, 1], [3, 15], [5, 1], [9, 16], [11, 15], [12, 25]],
};

export function getMexicanHolidays(year: number): Array<[number, number]> {
  return HOLIDAYS_BY_YEAR[year] ?? [];
}

/**
 * Verifica si una fecha es día hábil (L-S, no feriado).
 */
export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (dow === 0) return false; // Domingo no es hábil

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const holidays = getMexicanHolidays(year);
  return !holidays.some(([hm, hd]) => hm === month && hd === day);
}

/**
 * Cuenta días hábiles del mes hasta `upToDay` inclusive.
 * Si `upToDay` es null, cuenta todos los días hábiles del mes.
 *
 * - year: 2026
 * - month: 1-12
 * - upToDay: 1-31 o null para mes completo
 */
export function countBizDays(
  year: number,
  month: number,
  upToDay: number | null
): number {
  const lastDay = new Date(year, month, 0).getDate();
  const limit = upToDay != null ? Math.min(upToDay, lastDay) : lastDay;

  let count = 0;
  for (let d = 1; d <= limit; d++) {
    if (isBusinessDay(new Date(year, month - 1, d))) {
      count++;
    }
  }
  return count;
}

/**
 * Devuelve la lista de días hábiles del mes (ej: [1, 2, 3, 5, 6, ...]).
 * Útil para iterar en el chart cuando queremos eje X solo con días hábiles.
 */
export function listBizDays(year: number, month: number): number[] {
  const lastDay = new Date(year, month, 0).getDate();
  const out: number[] = [];
  for (let d = 1; d <= lastDay; d++) {
    if (isBusinessDay(new Date(year, month - 1, d))) {
      out.push(d);
    }
  }
  return out;
}

/**
 * Devuelve año/mes/día actual en zona horaria America/Mexico_City (UTC-6).
 *
 * IMPORTANTE: Vercel corre los Server Components en UTC. Si usamos
 * `new Date().getDate()` directamente, después de las 6pm CDMX el server
 * ya cree que es el día siguiente (porque UTC ya pasó la medianoche).
 * Eso rompía el dashboard mostrando "Día 26/26 · 100%" cuando en realidad
 * todavía falta el último día laboral.
 *
 * Este helper normaliza usando Intl.DateTimeFormat con timeZone explícito,
 * que es resiliente a la TZ del proceso/servidor.
 *
 * @returns {year, month (1-12), day (1-31)} de "hoy" en CDMX.
 */
export function getMexicoCityDateParts(): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return { year, month, day };
}
