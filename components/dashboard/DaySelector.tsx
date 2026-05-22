"use client";

/**
 * DaySelector — dropdown de días del mes seleccionado, estilo MonthSelector.
 *
 * Permite ver el dashboard "al cierre" de cualquier día del mes en curso (o de
 * un mes histórico), mostrando la venta acumulada hasta ese día. Complementa al
 * MonthSelector (mes) y al CutoffToggle (atajo Cierre/Hoy de 1 clic).
 *
 * - Lista los días 1..maxDay del mes (tope: hoy CDMX si es mes actual, fin de
 *   mes si es histórico).
 * - Resalta en verde los días con venta y en gris los días sin venta.
 * - Click navega a /dashboard?...&asOf=YYYY-MM-DD (preserva year/month).
 * - "Hoy / Último día" (default) quita el param asOf.
 *
 * Persiste su estado en la URL vía ?asOf= — al recargar mantiene el día.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, Check } from "lucide-react";

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const WEEKDAY_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

interface Props {
  /** Año del mes mostrado. */
  currentYear: number;
  /** Mes mostrado (1-12). */
  currentMonth: number;
  /** Día actualmente seleccionado vía ?asOf=. null = default (hoy/cierre). */
  asOfDay: number | null;
  /** Día máximo seleccionable: hoy CDMX (mes actual) o fin de mes (histórico). */
  maxAsOfDay: number;
  /** Días del mes con venta > 0, para resaltarlos en la lista. */
  daysWithSale: number[];
  /** ¿El mes mostrado es histórico? Cambia la etiqueta del default. */
  isHistorical: boolean;
  /** Último día con venta del mes en curso (para marcar "Cierre" cuando hay
   *  desfase data-vs-calendario). null = no aplica / histórico. */
  lastDayWithSale: number | null;
}

export function DaySelector({
  currentYear,
  currentMonth,
  asOfDay,
  maxAsOfDay,
  daysWithSale,
  isHistorical,
  lastDayWithSale,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Cerrar dropdown al click afuera
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const saleSet = new Set(daysWithSale);
  const monthShort = MONTH_SHORT_ES[currentMonth - 1];
  // Hay desfase si el último día con venta es anterior a hoy (solo mes actual).
  const hasDesfase =
    !isHistorical &&
    lastDayWithSale !== null &&
    lastDayWithSale < maxAsOfDay;

  // Lista de días descendente (más reciente arriba): maxAsOfDay .. 1
  const days: number[] = [];
  for (let d = maxAsOfDay; d >= 1; d--) days.push(d);

  // Etiqueta del trigger
  const defaultLabel = isHistorical ? "Cierre de mes" : "Hoy";
  const triggerLabel =
    asOfDay !== null ? `${asOfDay}-${monthShort}` : defaultLabel;
  const isDefault = asOfDay === null;

  function navigateToDay(day: number | null) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (day === null || day === maxAsOfDay) {
      // null o el día tope = default → quitar asOf (queda "Hoy"/"cierre")
      params.delete("asOf");
    } else {
      const yyyy = String(currentYear);
      const mm = String(currentMonth).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      params.set("asOf", `${yyyy}-${mm}-${dd}`);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cambiar día de corte"
        className="flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-muted)]"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
        title="Ver el dashboard al cierre de un día específico (venta acumulada hasta ese día)"
      >
        <CalendarDays size={14} style={{ color: "var(--text-secondary)" }} />
        <span>{triggerLabel}</span>
        {!isDefault && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            Al cierre
          </span>
        )}
        <ChevronDown
          size={14}
          style={{
            color: "var(--text-secondary)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 max-h-80 w-52 overflow-y-auto rounded-[var(--radius-lg)] border py-1 shadow-lg"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Opción default (Hoy / Cierre de mes) */}
          <button
            type="button"
            onClick={() => navigateToDay(null)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-surface-muted)]"
            style={{
              color: isDefault ? "var(--accent)" : "var(--text-primary)",
              fontWeight: isDefault ? 600 : 400,
              background: isDefault ? "var(--accent-soft)" : "transparent",
            }}
          >
            <span>{isHistorical ? "Cierre de mes (último día)" : "Hoy (en curso)"}</span>
            {isDefault && <Check size={14} style={{ color: "var(--accent)" }} />}
          </button>

          <div
            className="my-1 border-t"
            style={{ borderColor: "var(--border)" }}
          />

          {days.map((d) => {
            const isSelected = asOfDay === d;
            const hasSale = saleSet.has(d);
            const dow = new Date(currentYear, currentMonth - 1, d).getDay();
            // Marcas contextuales (solo mes actual):
            const isToday = !isHistorical && d === maxAsOfDay;
            const isCierre = hasDesfase && d === lastDayWithSale;
            return (
              <button
                key={d}
                type="button"
                onClick={() => navigateToDay(d)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-surface-muted)]"
                style={{
                  color: isSelected
                    ? "var(--accent)"
                    : hasSale
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      background: hasSale
                        ? "var(--success)"
                        : "var(--border)",
                    }}
                    title={hasSale ? "Con venta" : "Sin venta"}
                  />
                  <span>
                    {d}-{monthShort}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {WEEKDAY_SHORT_ES[dow]}
                  </span>
                  {isToday && (
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      style={{
                        background: "var(--bg-surface-muted)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Hoy
                    </span>
                  )}
                  {isCierre && (
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      style={{
                        background: "var(--success-soft)",
                        color: "var(--success)",
                      }}
                    >
                      Cierre
                    </span>
                  )}
                </span>
                {isSelected && (
                  <Check size={14} style={{ color: "var(--accent)" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
