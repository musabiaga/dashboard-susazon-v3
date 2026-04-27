"use client";

import { DollarSign, TrendingUp, Package, Zap } from "lucide-react";
import { formatMoney } from "@/lib/format";

export interface KpiData {
  venta: number;
  margen: number;
  kg: number;
  marginPct: number; // margen / venta * 100
  monthLabel: string; // ej: "Abril 2026"
  // Run-Rate: proyección lineal por días calendario.
  // ventaProyectada = venta * (daysTotal / daysCurrent).
  // Si está null, no se muestra la fila (mes futuro o sin data).
  runRate?: {
    venta: number;
    margen: number;
    kg: number;
    daysCurrent: number;
    daysTotal: number;
  } | null;
}

interface KpiCardsRowProps {
  data: KpiData | null;
  loading?: boolean;
}

/**
 * Fila de 3 KPI cards: Venta, Margen, Kilos del mes actual.
 * Si data=null, muestra placeholders. Cuando se conecte a /api/data/snapshot
 * en 2c-ii, recibirá data real.
 */
function formatKg(value: number): string {
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })} kg`;
}

export function KpiCardsRow({ data, loading = false }: KpiCardsRowProps) {
  const rr = data?.runRate ?? null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Venta"
        value={data ? formatMoney(data.venta) : "—"}
        sublabel={data?.monthLabel ?? "Mes actual"}
        icon={<DollarSign size={18} />}
        accent="accent"
        loading={loading}
        runRate={rr ? { value: formatMoney(rr.venta), days: rr } : null}
      />
      <KpiCard
        label="Margen"
        value={data ? formatMoney(data.margen) : "—"}
        sublabel={
          data
            ? `${data.marginPct.toFixed(1)}% sobre venta`
            : "Mes actual"
        }
        icon={<TrendingUp size={18} />}
        accent="success"
        loading={loading}
        runRate={rr ? { value: formatMoney(rr.margen), days: rr } : null}
      />
      <KpiCard
        label="Kilos"
        value={data ? formatKg(data.kg) : "—"}
        sublabel={data?.monthLabel ?? "Mes actual"}
        icon={<Package size={18} />}
        accent="warning"
        loading={loading}
        runRate={rr ? { value: formatKg(rr.kg), days: rr } : null}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  accent,
  loading,
  runRate,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent: "accent" | "success" | "warning";
  loading: boolean;
  runRate: {
    value: string;
    days: { daysCurrent: number; daysTotal: number };
  } | null;
}) {
  const accentVar =
    accent === "accent"
      ? "var(--accent)"
      : accent === "success"
      ? "var(--success)"
      : "var(--warning)";
  return (
    <div
      className="flex flex-col rounded-[var(--radius-lg)] border p-5"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
        <span style={{ color: accentVar }}>{icon}</span>
      </div>
      <div
        className="mt-3 text-2xl font-semibold tabular-nums"
        style={{
          color: loading ? "var(--text-muted)" : "var(--text-primary)",
        }}
      >
        {loading ? "Cargando…" : value}
      </div>
      <div
        className="mt-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {sublabel}
      </div>
      {runRate && (
        <div
          className="mt-3 flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            <Zap size={10} />
            Run-Rate
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: accentVar }}
          >
            {runRate.value}
          </span>
        </div>
      )}
      {runRate && (
        <div
          className="mt-1 text-right text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          día {runRate.days.daysCurrent}/{runRate.days.daysTotal}
        </div>
      )}
    </div>
  );
}
