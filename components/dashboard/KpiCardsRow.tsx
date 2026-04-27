"use client";

import { DollarSign, TrendingUp, Package, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatMoney } from "@/lib/format";

export interface KpiData {
  venta: number;
  margen: number;
  kg: number;
  marginPct: number; // margen / venta * 100
  monthLabel: string; // ej: "Abril 2026"
  monthShortYY: string; // ej: "Abr 26"
  prevMonthShortYY: string; // ej: "Abr 25"
  // Mismo mes año anterior — para YoY. Si prev=0, YoY se oculta.
  prevYear: { venta: number; margen: number; kg: number };
  // Acumulado por año (3 cards a la derecha)
  acumByYear: Record<number, number>;
  acumYears: number[]; // años a mostrar en orden (ej: [2024, 2025, 2026])
  // Run-Rate: proyección lineal por días calendario.
  runRate?: {
    venta: number;
    margen: number;
    kg: number;
    daysCurrent: number;
    daysTotal: number;
  } | null;
  // PTTO de venta del mes (0 = no configurado, no se muestra %).
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

function yoyDelta(current: number, prev: number): { pct: number; tone: "success" | "danger" } | null {
  if (prev <= 0) return null;
  const pct = ((current - prev) / prev) * 100;
  return { pct, tone: pct >= 0 ? "success" : "danger" };
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

  const yoyV = data ? yoyDelta(data.venta, data.prevYear.venta) : null;
  const yoyK = data ? yoyDelta(data.kg, data.prevYear.kg) : null;
  const prevLabel = data?.prevMonthShortYY ?? "año anterior";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-9">
      {/* 3 Main cards (col-span-2 on lg → 6 cols total) */}
      <div className="lg:col-span-2">
        <KpiCard
          label={`Venta ${data?.monthShortYY ?? ""}`.trim()}
          value={data ? formatMoney(data.venta) : "—"}
          sublabel={
            yoyV
              ? { text: `${yoyV.pct >= 0 ? "+" : ""}${yoyV.pct.toFixed(1)}% vs ${prevLabel}`, tone: yoyV.tone }
              : { text: data?.monthLabel ?? "Mes actual", tone: "neutral" }
          }
          icon={<DollarSign size={18} />}
          accent="accent"
          loading={loading}
          runRate={rr ? { value: formatMoney(rr.venta), days: rr } : null}
          vsPtto={vsPttoVenta}
        />
      </div>
      <div className="lg:col-span-2">
        <KpiCard
          label={`Margen ${data?.monthShortYY ?? ""}`.trim()}
          value={data ? formatMoney(data.margen) : "—"}
          sublabel={{
            text: data ? `${data.marginPct.toFixed(1)}% de venta` : "Mes actual",
            tone: "neutral",
          }}
          icon={<TrendingUp size={18} />}
          accent="success"
          loading={loading}
          runRate={rr ? { value: formatMoney(rr.margen), days: rr } : null}
        />
      </div>
      <div className="lg:col-span-2">
        <KpiCard
          label={`KG ${data?.monthShortYY ?? ""}`.trim()}
          value={data ? formatKg(data.kg) : "—"}
          sublabel={
            yoyK
              ? { text: `${yoyK.pct >= 0 ? "+" : ""}${yoyK.pct.toFixed(1)}% vs ${prevLabel}`, tone: yoyK.tone }
              : { text: data?.monthLabel ?? "Mes actual", tone: "neutral" }
          }
          icon={<Package size={18} />}
          accent="warning"
          loading={loading}
          runRate={rr ? { value: formatKg(rr.kg), days: rr } : null}
        />
      </div>

      {/* 3 Acum cards (col-span-1 on lg → 3 cols total) */}
      {(data?.acumYears ?? []).map((year) => (
        <div key={year} className="lg:col-span-1">
          <AcumCard
            year={year}
            value={data?.acumByYear[year] ?? 0}
            loading={loading}
          />
        </div>
      ))}
    </div>
  );
}

function AcumCard({
  year,
  value,
  loading,
}: {
  year: number;
  value: number;
  loading: boolean;
}) {
  const hasData = value > 0;
  return (
    <div
      className="flex h-full flex-col justify-center rounded-[var(--radius-lg)] border p-4"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        Acum {year}
      </div>
      <div
        className="mt-1 text-base font-semibold tabular-nums"
        style={{
          color: hasData
            ? "var(--text-primary)"
            : "var(--text-muted)",
        }}
      >
        {loading ? "…" : hasData ? formatMoney(value) : "—"}
      </div>
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
  sublabel: { text: string; tone: "neutral" | "success" | "danger" };
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
  const sublabelColor =
    sublabel.tone === "success"
      ? "var(--success)"
      : sublabel.tone === "danger"
      ? "var(--danger)"
      : "var(--text-muted)";
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
        className="mt-1 flex items-center gap-1 text-xs font-medium"
        style={{ color: sublabelColor }}
      >
        {sublabel.tone === "success" && <ArrowUpRight size={12} />}
        {sublabel.tone === "danger" && <ArrowDownRight size={12} />}
        <span>{sublabel.text}</span>
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
