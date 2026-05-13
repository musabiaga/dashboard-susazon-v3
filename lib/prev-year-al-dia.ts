/**
 * lib/prev-year-al-dia.ts — comparativo "al día hábil equivalente" del año
 * anterior.
 *
 * Cuando se muestra "vs Mayo 2025" en mayo 2026, el comparativo justo NO es
 * el cierre completo del mes (Mayo 2025 = 25 días hábiles cerrados = $X total)
 * sino el ACUMULADO HASTA EL MISMO DÍA HÁBIL transcurrido del 2026.
 *
 * Ejemplo: hoy 13-may-26 (día hábil 10 de 25 de Mayo).
 *   - "Mayo 2025 cierre" = sum(daily.prevYear[].v)
 *   - "Mayo 2025 al-día"  = sum(daily.prevYear[].v WHERE d <= díaCalendarioEqui)
 *     donde díaCalendarioEqui = el día calendario de Mayo 2025 que tuvo
 *     exactamente 10 días hábiles transcurridos (puede ser el 14 si hay
 *     1 feriado o 2 domingos).
 *
 * Este helper es 100% client-side: usa daily.prevYear[] que ya viene del
 * snapshot del backend. No requiere queries adicionales.
 */

import { findCalendarDayForBizDays } from "./business-days";
import type { DailyPoint } from "@/components/dashboard/Sidebar";

/**
 * Devuelve {v, k, m} acumulados del año anterior hasta el día calendario
 * equivalente al día hábil que llevamos en el año actual.
 *
 * @param dailyPrev - kpi.daily.prevYear (array de DailyPoint del año anterior)
 * @param prevYear  - año anterior (ej. 2025)
 * @param month     - 1-12 (mismo mes en ambos años)
 * @param elapsedBizDaysCurrent - días hábiles transcurridos en el año actual
 *
 * Si elapsedBizDays >= total bizDays del año anterior, devuelve el cierre
 * completo (suma de todo daily.prevYear).
 */
export function computePrevYearAlDia(
  dailyPrev: DailyPoint[],
  prevYear: number,
  month: number,
  elapsedBizDaysCurrent: number
): { v: number; k: number; m: number } {
  if (elapsedBizDaysCurrent <= 0) {
    return { v: 0, k: 0, m: 0 };
  }
  const calendarDay = findCalendarDayForBizDays(
    prevYear,
    month,
    elapsedBizDaysCurrent
  );
  // calendarDay === 0 si targetBizDays <= 0 (manejado arriba); puede ser
  // lastDay si no se alcanza el objetivo (el año anterior tiene menos días
  // hábiles en ese mes). En ese caso sumamos todo.
  let v = 0;
  let k = 0;
  let m = 0;
  for (const p of dailyPrev) {
    if (p.d <= calendarDay) {
      v += p.v;
      k += p.k;
      m += p.m;
    }
  }
  return { v, k, m };
}
