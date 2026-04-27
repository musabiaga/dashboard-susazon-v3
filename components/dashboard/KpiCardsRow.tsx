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
  // PTTO de venta del mes (0 = no configurado, no se muestra %).
  // Solo aplica al card de Venta hoy. Margen y KG quedan preparados para
  // cuando el editor exponga esos campos.
  ventaBudget?: number;
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

function ptToneFromPct(pct: number): "success" | "warning" | "danger" {
  if (pct >= 100) return "success";
  if (pct >= 70) return "warning";
  return "danger";
}

export function KpiCardsRow({ data, loading = false }: KpiCardsRowProps) {
  const rr = data?.runRate ?? null;
  const ventaBudget = data?.ventaBudget ?? 0;
  const vsPttoVenta =
    data && ventaBudget > 0
      ? {
          pct: (data.venta / ventaBudget) * 100,
          tone: ptToneFromPct((data.venta / ventaBudget) * 100),
          budget: ventaBudget,
        }
      : null;
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
        vsPtto={vsPttoVenta}
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
  vsPtto,
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
  vsPtto?: {
    pct: number;
    tone: "success" | "warning" | "danger";
    budget: number;
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
      {vsPtto && (
        <div
          className="mt-3 flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            vs PTTO
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: `var(--${vsPtto.tone})` }}
          >
            {vsPtto.pct.toFixed(0)}%
          </span>
        </div>
      )}
      {vsPtto && (
        <div
          className="mt-1 text-right text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          objetivo {formatMoney(vsPtto.budget)}
        </div>
      )}
    </div>
  );
}
