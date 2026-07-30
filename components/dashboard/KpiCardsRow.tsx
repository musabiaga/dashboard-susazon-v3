"use client";

import { DollarSign, TrendingUp, Package, Zap, Gauge, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { listBizDays } from "@/lib/business-days";
import { KpiHistogramPopover } from "@/components/dashboard/KpiHistogramPopover";

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
  // Promedio de Venta Diario = venta al día ÷ días hábiles transcurridos.
  ventaAlDia?: number; // venta al día del mes actual (al mismo día hábil)
  prevYearVentaAlDia?: number; // venta al día del mismo tramo del año anterior
  elapsedBizDays?: number; // días hábiles transcurridos
  totalBizDays?: number; // días hábiles totales del mes
}

interface KpiCardsRowProps {
  data: KpiData | null;
  loading?: boolean;
  /** Serie mensual (venta/margen/kg) de la selección activa para el histograma
   *  de las pastillas. Ya viene scoped por territorio/agrupador. */
  monthly?: { anio: number; mes: number; venta: number; margen: number; kg: number }[];
}

/**
 * Fila de 3 KPI cards: Venta, Margen, Kilos del mes actual.
 * Si data=null, muestra placeholders. Cuando se conecte a /api/data/snapshot
 * en 2c-ii, recibirá data real.
 */
function formatKg(value: number): string {
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })} kg`;
}

/**
 * Delta KG corto con signo. Ej: 101455 → "+101K", -456000 → "-456K".
 * Útil para mostrar diferencia absoluta junto al % YoY sin alargar la línea.
 */
function formatKgDeltaShort(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${Math.round(abs)}`;
}

/**
 * Delta de dinero corto con signo. Ej: 545000 → "+$0.5M", -200 → "-$200".
 */
function formatMoneyDeltaShort(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
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

export function KpiCardsRow({ data, loading = false, monthly }: KpiCardsRowProps) {
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
  const yoyM = data ? yoyDelta(data.margen, data.prevYear.margen) : null;
  const yoyK = data ? yoyDelta(data.kg, data.prevYear.kg) : null;

  // ===== Promedio de Venta Diario (venta al día ÷ días hábiles transcurridos) =====
  const elapsedBiz = data?.elapsedBizDays ?? rr?.daysCurrent ?? 0;
  const totalBiz = data?.totalBizDays ?? rr?.daysTotal ?? 0;
  const ventaAlDia = data?.ventaAlDia ?? data?.venta ?? 0;
  const prevVentaAlDia = data?.prevYearVentaAlDia ?? 0;
  const promedioDiario = elapsedBiz > 0 ? ventaAlDia / elapsedBiz : 0;
  // Prom. del año anterior: mismo tramo (misma cantidad de días hábiles transcurridos).
  const promedioDiarioPrev = elapsedBiz > 0 ? prevVentaAlDia / elapsedBiz : 0;
  const yoyProm =
    data && promedioDiarioPrev > 0 ? yoyDelta(promedioDiario, promedioDiarioPrev) : null;
  // Objetivo diario = PTTO del mes ÷ días hábiles TOTALES.
  const objetivoDiario = totalBiz > 0 ? ventaBudget / totalBiz : 0;
  const vsPttoPromedio =
    data && objetivoDiario > 0
      ? {
          pct: (promedioDiario / objetivoDiario) * 100,
          tone: ptToneFromPct((promedioDiario / objetivoDiario) * 100),
          budget: objetivoDiario,
        }
      : null;
  // Serie mensual del promedio diario: cada mes = su venta ÷ sus días hábiles.
  // Reusa el histograma (formato $) pasando `venta` = promedio del mes.
  const monthlyPromedio = (monthly ?? []).map((p) => {
    const dias = listBizDays(p.anio, p.mes).length;
    return { ...p, venta: dias > 0 ? p.venta / dias : 0 };
  });
  const prevLabel = data?.prevMonthShortYY ?? "año anterior";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-9">
      {/* 4 Main cards del mes (col-span-2 → 8 cols) + 1 ACUM consolidada (1 col) = 9.
          La ACUM ocupa la mitad del ancho de un KPI; los KPIs crecen. */}
      <div className="lg:col-span-2">
        <KpiHistogramPopover monthly={monthly} metric="venta" accent="accent" metricLabel="Venta" align="left">
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
        </KpiHistogramPopover>
      </div>
      <div className="lg:col-span-2">
        <KpiHistogramPopover monthly={monthly} metric="margen" accent="success" metricLabel="Margen" align="left">
        <KpiCard
          label={`Margen ${data?.monthShortYY ?? ""}`.trim()}
          value={data ? formatMoney(data.margen) : "—"}
          // Opción A (aprobada): subInline al lado del valor con el margen %
          // de venta en gris. Sublabel pasa a ser el YoY (igual que KG card).
          // Si no hay data del año anterior, mantenemos el formato clásico
          // "X% de venta" en el sublabel para no perder la información.
          valueInline={data ? `${data.marginPct.toFixed(1)}%` : undefined}
          sublabel={
            yoyM && data
              ? {
                  text: `${yoyM.pct >= 0 ? "+" : ""}${yoyM.pct.toFixed(1)}% (${formatMoneyDeltaShort(data.margen - data.prevYear.margen)}) vs ${prevLabel}`,
                  tone: yoyM.tone,
                }
              : {
                  text: data ? `${data.marginPct.toFixed(1)}% de venta` : "Mes actual",
                  tone: "neutral",
                }
          }
          icon={<TrendingUp size={18} />}
          accent="success"
          loading={loading}
          runRate={rr ? { value: formatMoney(rr.margen), days: rr } : null}
        />
        </KpiHistogramPopover>
      </div>
      <div className="lg:col-span-2">
        <KpiHistogramPopover monthly={monthly} metric="kg" accent="warning" metricLabel="KG" align="right">
        <KpiCard
          label={`KG ${data?.monthShortYY ?? ""}`.trim()}
          value={data ? formatKg(data.kg) : "—"}
          sublabel={
            yoyK && data
              ? {
                  // Formato A (aprobado): "↘ -17.7% (-101K) vs Abr 25"
                  // El delta absoluto va en paréntesis entre el % y "vs ..."
                  text: `${yoyK.pct >= 0 ? "+" : ""}${yoyK.pct.toFixed(1)}% (${formatKgDeltaShort(data.kg - data.prevYear.kg)}) vs ${prevLabel}`,
                  tone: yoyK.tone,
                }
              : { text: data?.monthLabel ?? "Mes actual", tone: "neutral" }
          }
          icon={<Package size={18} />}
          accent="warning"
          loading={loading}
          runRate={rr ? { value: formatKg(rr.kg), days: rr } : null}
        />
        </KpiHistogramPopover>
      </div>
      <div className="lg:col-span-2">
        <KpiHistogramPopover monthly={monthlyPromedio} metric="venta" accent="accent" metricLabel="Prom. Diario" align="right">
        <KpiCard
          label={`Prom. Diario ${data?.monthShortYY ?? ""}`.trim()}
          value={data ? formatMoney(promedioDiario) : "—"}
          sublabel={
            yoyProm
              ? { text: `${yoyProm.pct >= 0 ? "+" : ""}${yoyProm.pct.toFixed(1)}% vs ${prevLabel}`, tone: yoyProm.tone }
              : { text: "venta ÷ días hábiles", tone: "neutral" }
          }
          icon={<Gauge size={18} />}
          accent="accent"
          loading={loading}
          runRate={null}
          vsPtto={vsPttoPromedio}
        />
        </KpiHistogramPopover>
      </div>

      {/* ACUM 2024/2025/2026 consolidados en 1 sola pastilla (años en vertical) */}
      <div className="lg:col-span-1">
        <AcumCardStacked
          years={data?.acumYears ?? []}
          acumByYear={data?.acumByYear ?? {}}
          loading={loading}
        />
      </div>
    </div>
  );
}

function AcumCardStacked({
  years,
  acumByYear,
  loading,
}: {
  years: number[];
  acumByYear: Record<number, number>;
  loading: boolean;
}) {
  return (
    <div
      className="flex h-full flex-col justify-center gap-2 rounded-[var(--radius-lg)] border p-4"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      {years.map((year, i) => {
        const value = acumByYear[year] ?? 0;
        const hasData = value > 0;
        return (
          <div
            key={year}
            style={
              i > 0
                ? { borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }
                : undefined
            }
          >
            <div
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              Acum {year}
            </div>
            <div
              className="text-sm font-semibold tabular-nums"
              style={{
                color: hasData ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {loading ? "…" : hasData ? formatMoney(value) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueInline,
  sublabel,
  icon,
  accent,
  loading,
  runRate,
  vsPtto,
}: {
  label: string;
  value: string;
  /** Texto secundario en gris al lado del valor principal (opción B / subInline) */
  valueInline?: string;
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
      <div className="mt-3 flex items-baseline gap-2 tabular-nums">
        <span
          className="text-2xl font-semibold"
          style={{
            color: loading ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {loading ? "Cargando…" : value}
        </span>
        {!loading && valueInline && (
          <span
            className="text-base"
            style={{ color: "var(--text-muted)", opacity: 0.85 }}
          >
            {valueInline}
          </span>
        )}
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
          día hábil {runRate.days.daysCurrent}/{runRate.days.daysTotal}
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
