"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/format";
import type { TerritoryKpi } from "@/components/dashboard/Sidebar";
import { ChartLegend } from "@/components/dashboard/ChartLegend";

const MONTHS_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTHS_LONG_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Props {
  kpi: TerritoryKpi;
  // Hasta qué (anio, mes) hay data real. Después de esto las celdas son null.
  // Uso: en abril 2026, May-Dic 2026 son null (mes futuro).
  cutoffYear: number;
  cutoffMonth: number; // 1-12
}

/**
 * Tab Ventas — replica V2.2:
 *   - Bar chart vertical con 12 meses (Ene-Dic) en eje X
 *   - 3 series de barras: Venta 2024 (gris), Venta 2025 (azul), Venta 2026 (verde)
 *   - 3 series de líneas: Margen% 2024/2025/2026 sobre eje Y derecho (0-50%)
 *   - Meses futuros (después de cutoff) quedan vacíos (no fuerzan a 0).
 */
export function VentasTab({ kpi, cutoffYear, cutoffMonth }: Props) {
  const chartData = useMemo(() => {
    // Index por (anio, mes) → MonthlyPoint
    const byKey = new Map<string, { v: number; m: number }>();
    for (const p of kpi.monthly) {
      byKey.set(`${p.anio}-${p.mes}`, { v: p.venta, m: p.margen });
    }

    // 12 filas, una por mes. Cada fila tiene venta y margen% por año.
    // Mejora 2 Commit B: el slot del mes actual usa barras apiladas
    // (al-día sólido + resto translúcido). Los demás meses se ven igual.
    const ald = kpi.currentMonthAlDia;
    return MONTHS_SHORT_ES.map((label, i) => {
      const mes = i + 1;
      const get = (anio: number) => byKey.get(`${anio}-${mes}`);
      const future = (anio: number) =>
        anio > cutoffYear || (anio === cutoffYear && mes > cutoffMonth);
      const isCurrentSlot = mes === cutoffMonth; // mes actual

      const v24 = get(2024);
      const v25 = get(2025);
      const v26 = get(2026);

      // null en futuro para que la barra/línea no aparezca
      const venta24 = future(2024) ? null : v24?.v ?? 0;
      const venta25 = future(2025) ? null : v25?.v ?? 0;
      const venta26 = future(2026) ? null : v26?.v ?? 0;

      // Para el slot del mes actual, calculamos al-día y resto.
      // Para los demás meses, al-día = cierre y resto = 0 (las barras
      // se ven idénticas a una barra simple porque el segmento translúcido
      // tiene altura 0).
      const v24AlDia = isCurrentSlot && ald
        ? Math.min(venta24 ?? 0, ald.v24)
        : (venta24 ?? 0);
      const v25AlDia = isCurrentSlot && ald
        ? Math.min(venta25 ?? 0, ald.v25)
        : (venta25 ?? 0);
      const v26AlDia = isCurrentSlot && ald
        ? Math.min(venta26 ?? 0, ald.v26)
        : (venta26 ?? 0);
      const v24Rest = isCurrentSlot && ald
        ? Math.max(0, (venta24 ?? 0) - v24AlDia)
        : 0;
      const v25Rest = isCurrentSlot && ald
        ? Math.max(0, (venta25 ?? 0) - v25AlDia)
        : 0;
      const v26Rest = isCurrentSlot && ald
        ? Math.max(0, (venta26 ?? 0) - v26AlDia)
        : 0;

      const margenPct = (
        agg: { v: number; m: number } | undefined
      ): number | null =>
        agg && agg.v > 0 ? (agg.m / agg.v) * 100 : null;

      return {
        month: label,
        venta24,
        venta25,
        venta26,
        // Segmentos apilados (Mejora 2 Commit B)
        venta24_alDia: future(2024) ? null : v24AlDia,
        venta25_alDia: future(2025) ? null : v25AlDia,
        venta26_alDia: future(2026) ? null : v26AlDia,
        __rest_v24: future(2024) ? null : v24Rest,
        __rest_v25: future(2025) ? null : v25Rest,
        __rest_v26: future(2026) ? null : v26Rest,
        // Flag para que el tooltip sepa si mostrar info de día-vs-día
        __isCurrentSlot: isCurrentSlot,
        margenPct24: future(2024) ? null : margenPct(v24),
        margenPct25: future(2025) ? null : margenPct(v25),
        margenPct26: future(2026) ? null : margenPct(v26),
      };
    });
  }, [kpi.monthly, kpi.currentMonthAlDia, cutoffYear, cutoffMonth]);

  return (
    <div
      className="rounded-[var(--radius-lg)] border p-4"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <ResponsiveContainer width="100%" height={460}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 60, bottom: 5, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => formatMoney(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 50]}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={<VentasTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Legend
            verticalAlign="top"
            align="center"
            height={32}
            wrapperStyle={{ paddingBottom: 4 }}
            content={() => (
              <ChartLegend
                sections={[
                  {
                    title: "Venta",
                    visualKind: "barras",
                    items: [
                      { label: "2024", color: "rgba(148, 163, 184, 0.85)", type: "bar" },
                      { label: "2025", color: "rgba(59, 130, 246, 0.85)", type: "bar" },
                      { label: "2026", color: "rgba(16, 185, 129, 0.85)", type: "bar" },
                    ],
                  },
                  {
                    title: "Margen %",
                    visualKind: "líneas",
                    items: [
                      { label: "2024", color: "#94a3b8", type: "line-dashed" },
                      { label: "2025", color: "#3b82f6", type: "line-dashed" },
                      { label: "2026", color: "#10b981", type: "line-dashed" },
                    ],
                  },
                ]}
              />
            )}
          />
          {/* Barras de venta APILADAS (Mejora 2 Commit B):
              - Slot del mes actual: segmento sólido (al-día) + segmento
                translúcido (resto hasta cierre)
              - Demás slots: __rest = 0 → solo se ve segmento sólido
                (que es el cierre completo). Visualmente idéntico a barra
                simple. */}
          <Bar
            yAxisId="left"
            dataKey="venta24_alDia"
            stackId="stack-v24"
            name="Venta 2024"
            fill="rgba(148, 163, 184, 0.85)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="__rest_v24"
            stackId="stack-v24"
            name="Venta 2024"
            legendType="none"
            fill="rgba(148, 163, 184, 0.28)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="venta25_alDia"
            stackId="stack-v25"
            name="Venta 2025"
            fill="rgba(59, 130, 246, 0.85)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="__rest_v25"
            stackId="stack-v25"
            name="Venta 2025"
            legendType="none"
            fill="rgba(59, 130, 246, 0.28)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="venta26_alDia"
            stackId="stack-v26"
            name="Venta 2026"
            fill="rgba(16, 185, 129, 0.85)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="__rest_v26"
            stackId="stack-v26"
            name="Venta 2026"
            legendType="none"
            fill="rgba(16, 185, 129, 0.28)"
            radius={[2, 2, 0, 0]}
          />
          {/* Líneas de margen % (eje derecho) */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margenPct24"
            name="Margen% 2024"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={{ r: 2.5, strokeWidth: 1, fill: "white" }}
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margenPct25"
            name="Margen% 2025"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1, fill: "white" }}
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margenPct26"
            name="Margen% 2026"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 1, fill: "white" }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Custom Tooltip — separates Venta vs Margen% en 2 secciones
// ============================================================
interface TooltipPayloadItem {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string;
}

function VentasTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const monthIdx = MONTHS_SHORT_ES.indexOf(label ?? "");
  const monthLong = monthIdx >= 0 ? MONTHS_LONG_ES[monthIdx] : (label ?? "");

  // Recharts inyecta el row completo en payload[0].payload — usamos eso
  // para leer al-día / cierre / margen sin duplicados (las 6 series de
  // venta apiladas darían 6 entries al filtrar por name).
  const row = (payload[0] as TooltipPayloadItem & {
    payload?: Record<string, number | string | boolean | null>;
  })?.payload;
  const num = (key: string): number | null => {
    if (!row) return null;
    const v = row[key];
    return typeof v === "number" ? v : null;
  };
  const isCurrentSlot = !!(row && row["__isCurrentSlot"]);

  // Margen items se mantienen del payload (líneas, no apiladas)
  const margenItems = payload.filter((p) => p.name?.startsWith("Margen%"));

  // Cierres por año (suma de al-día + resto) — para YoY del header
  const v25 = num("venta25");
  const v26 = num("venta26");
  const yoyDelta =
    v25 != null && v25 > 0 && v26 != null
      ? ((v26 - v25) / v25) * 100
      : null;

  // Series de Venta para mostrar en sección — usamos al-día como principal
  // y cierre como referencia (solo cuando es el mes actual).
  const ventaShow = [
    { label: "2024", colorBar: "rgba(148, 163, 184, 0.85)", cierreKey: "venta24", alDiaKey: "venta24_alDia" },
    { label: "2025", colorBar: "rgba(59, 130, 246, 0.85)",  cierreKey: "venta25", alDiaKey: "venta25_alDia" },
    { label: "2026", colorBar: "rgba(16, 185, 129, 0.85)",  cierreKey: "venta26", alDiaKey: "venta26_alDia" },
  ];

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 220,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-baseline justify-between gap-3 px-3 py-2"
        style={{
          background: "var(--bg-surface-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          {monthLong}
        </span>
        {yoyDelta != null && (
          <span
            className="text-[10px] font-semibold"
            style={{
              color: yoyDelta >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta).toFixed(1)}% vs '25
          </span>
        )}
      </div>

      {/* Sección Venta — al día N (oscuro) + cierre (referencia) si mes actual */}
      <div className="px-3 py-2">
        <div
          className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Venta {isCurrentSlot ? "· al mismo día laboral" : ""}
        </div>
        {ventaShow.map((s) => {
          const cierre = num(s.cierreKey);
          const alDia = num(s.alDiaKey);
          if (cierre == null && alDia == null) return null;
          // Si NO es slot actual, al-día = cierre; mostramos solo el cierre.
          // Si SÍ es slot actual, al-día puede ser distinto del cierre →
          // mostramos al-día como principal + "cierre $X" como referencia.
          const showSecondary =
            isCurrentSlot &&
            alDia != null &&
            cierre != null &&
            cierre > 0 &&
            cierre !== alDia;
          return (
            <Row
              key={s.label}
              color={s.colorBar}
              label={s.label}
              value={
                isCurrentSlot && alDia != null
                  ? formatMoney(alDia)
                  : cierre != null
                    ? formatMoney(cierre)
                    : "—"
              }
              valueSecondary={
                showSecondary ? `cierre ${formatMoney(cierre)}` : undefined
              }
            />
          );
        })}
      </div>
      {/* Sección Margen% */}
      {margenItems.length > 0 && (
        <div
          className="px-3 py-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div
            className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Margen %
          </div>
          {margenItems.map((p) => (
            <Row
              key={p.name}
              color={p.color}
              label={p.name?.replace("Margen% ", "") ?? ""}
              value={
                typeof p.value === "number" ? `${p.value.toFixed(1)}%` : "—"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  label,
  value,
  valueSecondary,
}: {
  color: string | undefined;
  label: string;
  value: string;
  /** Texto secundario en gris (ej: "cierre $X" como referencia) */
  valueSecondary?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color ?? "var(--text-muted)" }}
        />
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
        {valueSecondary && (
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            {valueSecondary}
          </span>
        )}
      </span>
    </div>
  );
}
