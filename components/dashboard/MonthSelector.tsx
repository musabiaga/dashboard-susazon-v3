"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Calendar, ChevronDown, Check } from "lucide-react";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Props {
  /** Año actualmente seleccionado (1-año actual) */
  currentYear: number;
  /** Mes actualmente seleccionado (1-12) */
  currentMonth: number;
  /** Año "hoy" CDMX — para resaltar el mes actual */
  todayYear: number;
  /** Mes "hoy" CDMX — para resaltar el mes actual */
  todayMonth: number;
  /** Cuántos meses hacia atrás listar (default 24) */
  monthsBack?: number;
}

/**
 * Selector de mes/año para el dashboard. Genera los últimos N meses
 * (default 24) en orden descendente. Click en un item navega a
 * /dashboard?year=Y&month=M (sin params si es el mes actual).
 *
 * Persiste su estado en URL — al recargar mantiene el mes seleccionado.
 */
export function MonthSelector({
  currentYear,
  currentMonth,
  todayYear,
  todayMonth,
  monthsBack = 24,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
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

  // Generar lista de meses descendente desde "hoy"
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < monthsBack; i++) {
    let m = todayMonth - i;
    let y = todayYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push({
      year: y,
      month: m,
      label: `${MONTH_NAMES_ES[m - 1]} ${y}`,
    });
  }

  const isCurrentMonth = currentYear === todayYear && currentMonth === todayMonth;
  const currentLabel = `${MONTH_NAMES_ES[currentMonth - 1]} ${currentYear}`;

  function selectMonth(year: number, month: number) {
    setOpen(false);
    if (year === todayYear && month === todayMonth) {
      // Volver al mes actual: URL limpia (sin searchParams)
      router.push(pathname);
    } else {
      router.push(`${pathname}?year=${year}&month=${month}`);
    }
    router.refresh();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cambiar mes"
        className="flex items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-muted)]"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <Calendar size={14} style={{ color: "var(--text-secondary)" }} />
        <span>{currentLabel}</span>
        {!isCurrentMonth && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: "var(--warning-soft)",
              color: "var(--warning)",
            }}
          >
            Histórico
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
          className="absolute right-0 top-full z-50 mt-1 max-h-80 w-56 overflow-y-auto rounded-[var(--radius-lg)] border py-1 shadow-lg"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {months.map((m) => {
            const isSelected =
              m.year === currentYear && m.month === currentMonth;
            const isCurrent = m.year === todayYear && m.month === todayMonth;
            return (
              <button
                key={`${m.year}-${m.month}`}
                type="button"
                onClick={() => selectMonth(m.year, m.month)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-surface-muted)]"
                style={{
                  color: isSelected
                    ? "var(--accent)"
                    : "var(--text-primary)",
                  fontWeight: isSelected ? 600 : 400,
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span className="flex items-center gap-2">
                  <span>{m.label}</span>
                  {isCurrent && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                      style={{
                        background: "var(--success-soft)",
                        color: "var(--success)",
                      }}
                    >
                      Actual
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
