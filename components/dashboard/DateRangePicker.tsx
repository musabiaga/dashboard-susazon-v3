"use client";

/**
 * DateRangePicker — selector de rango de fechas con atajos rápidos.
 *
 * Trabaja con strings ISO `YYYY-MM-DD` para evitar lío de timezones.
 * Atajos: Este mes, Mes anterior, Últimos 90 días, YTD, 12 meses.
 *
 * No persiste su estado — el componente padre decide qué hacer con el
 * onChange. El padre típicamente lo guarda en localStorage si quiere
 * "recordar la última selección".
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { Calendar } from "lucide-react";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Año mínimo seleccionable. Default 2024. */
  minYear?: number;
  /** Día/mes/año "hoy" en CDMX, para no permitir fechas futuras. */
  today: { year: number; month: number; day: number };
}

const MONTHS_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Formatea YYYY-MM-DD como "13-may-26" para mostrar al usuario. */
function formatDateLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [yy, mm, dd] = iso.split("-").map((s) => parseInt(s, 10));
  const monthIdx = mm - 1;
  if (monthIdx < 0 || monthIdx > 11) return iso;
  return `${dd}-${MONTHS_SHORT_ES[monthIdx]}-${yy % 100}`;
}

/** Crea YYYY-MM-DD a partir de year/month/day, todos sin offset de tz. */
function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Restar días a una fecha CDMX (todo local sin tz). */
function subtractDays(y: number, m: number, d: number, days: number): {
  year: number; month: number; day: number;
} {
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

interface ShortcutDef {
  label: string;
  compute: (today: Props["today"]) => DateRange;
}

const SHORTCUTS: ShortcutDef[] = [
  {
    label: "Este mes",
    compute: ({ year, month, day }) => ({
      from: toIso(year, month, 1),
      to: toIso(year, month, day),
    }),
  },
  {
    label: "Mes anterior",
    compute: ({ year, month }) => {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      return {
        from: toIso(prevYear, prevMonth, 1),
        to: toIso(prevYear, prevMonth, lastDay),
      };
    },
  },
  {
    label: "Últimos 30d",
    compute: (t) => {
      const from = subtractDays(t.year, t.month, t.day, 29);
      return {
        from: toIso(from.year, from.month, from.day),
        to: toIso(t.year, t.month, t.day),
      };
    },
  },
  {
    label: "Últimos 90d",
    compute: (t) => {
      const from = subtractDays(t.year, t.month, t.day, 89);
      return {
        from: toIso(from.year, from.month, from.day),
        to: toIso(t.year, t.month, t.day),
      };
    },
  },
  {
    label: "YTD",
    compute: (t) => ({
      from: toIso(t.year, 1, 1),
      to: toIso(t.year, t.month, t.day),
    }),
  },
  {
    label: "12 meses",
    compute: (t) => {
      const from = subtractDays(t.year, t.month, t.day, 365);
      return {
        from: toIso(from.year, from.month, from.day),
        to: toIso(t.year, t.month, t.day),
      };
    },
  },
];

export function DateRangePicker({
  value,
  onChange,
  minYear = 2024,
  today,
}: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [draftFrom, setDraftFrom] = useState(value.from);
  const [draftTo, setDraftTo] = useState(value.to);

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

  // Sincronizar drafts con value cuando cambia desde afuera
  useEffect(() => {
    setDraftFrom(value.from);
    setDraftTo(value.to);
  }, [value.from, value.to]);

  const todayIso = toIso(today.year, today.month, today.day);
  const minIso = toIso(minYear, 1, 1);

  // ¿Coincide el rango actual con algún atajo? Para resaltarlo
  const activeShortcut = useMemo(() => {
    for (const sc of SHORTCUTS) {
      const r = sc.compute(today);
      if (r.from === value.from && r.to === value.to) return sc.label;
    }
    return null;
  }, [value.from, value.to, today]);

  function applyShortcut(sc: ShortcutDef) {
    const r = sc.compute(today);
    onChange(r);
    setOpen(false);
  }

  function applyCustom() {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(draftFrom) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(draftTo)
    )
      return;
    if (draftFrom > draftTo) return;
    onChange({ from: draftFrom, to: draftTo });
    setOpen(false);
  }

  const buttonLabel = `${formatDateLabel(value.from)} → ${formatDateLabel(value.to)}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-muted)]"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <Calendar size={14} style={{ color: "var(--text-secondary)" }} />
        <span>{buttonLabel}</span>
        {activeShortcut && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            {activeShortcut}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-[var(--radius-lg)] border p-3 shadow-lg"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Atajos rápidos */}
          <div className="mb-3">
            <div
              className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Atajos
            </div>
            <div className="flex flex-wrap gap-1">
              {SHORTCUTS.map((sc) => {
                const isActive = activeShortcut === sc.label;
                return (
                  <button
                    key={sc.label}
                    type="button"
                    onClick={() => applyShortcut(sc)}
                    className="rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium transition-colors"
                    style={{
                      background: isActive
                        ? "var(--accent-soft)"
                        : "var(--bg-surface-muted)",
                      borderColor: isActive ? "var(--accent)" : "var(--border)",
                      color: isActive
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rango custom */}
          <div className="space-y-2">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Rango personalizado
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span
                  className="mb-0.5 block text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Desde
                </span>
                <input
                  type="date"
                  value={draftFrom}
                  min={minIso}
                  max={todayIso}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border px-2 py-1 text-xs"
                  style={{
                    background: "var(--bg-surface-muted)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
              <label className="block">
                <span
                  className="mb-0.5 block text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Hasta
                </span>
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || minIso}
                  max={todayIso}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border px-2 py-1 text-xs"
                  style={{
                    background: "var(--bg-surface-muted)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={applyCustom}
              disabled={draftFrom > draftTo}
              className="w-full rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
