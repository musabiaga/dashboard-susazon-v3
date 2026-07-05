"use client";

/**
 * KpiHistogramPopover — envuelve una pastilla KPI (Venta / Margen / KG) y, al
 * pasar el cursor (desktop) o dar tap (touch), abre un popover con el histograma
 * mensual de ESA métrica: barras por mes + línea de tendencia, con toggle
 * Timeline ↔ Comparativo por año. Al pasar el cursor por un mes, el tooltip
 * muestra el valor + Δ vs el mismo mes del año anterior.
 *
 * Reusa la serie mensual ya cargada (activeKpi.monthly) → cero llamadas extra;
 * respeta la selección del sidebar (territorio / Todos) y el modo agrupador,
 * igual que el número que muestra la pastilla.
 */

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

type Metric = "venta" | "margen" | "kg";
type Accent = "accent" | "success" | "warning";

/** Un punto de la serie mensual (shape de MonthlyPoint, tipado inline). */
interface MonthPoint {
  anio: number;
  mes: number;
  venta: number;
  margen: number;
  kg: number;
}

const MES_ABBR = [
  "",
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const ACCENT_VAR: Record<Accent, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
};
/** Años que se muestran (como acordado: 2024→2026). */
const YEARS = [2024, 2025, 2026];

interface Props {
  monthly: MonthPoint[] | undefined;
  metric: Metric;
  accent: Accent;
  metricLabel: string;
  /** Alineación del popover para no desbordar el viewport (KG = derecha). */
  align?: "left" | "right";
  children: React.ReactNode;
}

export function KpiHistogramPopover({
  monthly,
  metric,
  accent,
  metricLabel,
  align = "left",
  children,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const pts = useMemo(
    () => (monthly ?? []).filter((p) => YEARS.includes(p.anio)),
    [monthly]
  );
  const hasData = pts.length > 0;
  const show = hasData && (hovered || pinned);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={hasData ? "cursor-pointer" : ""}
        onClick={hasData ? () => setPinned((p) => !p) : undefined}
      >
        {children}
      </div>

      {/* Afordancia: mini-ícono que aparece al hover para indicar interactividad */}
      {hasData && (
        <div
          className="pointer-events-none absolute right-2.5 top-2.5 opacity-0 transition-opacity group-hover:opacity-70"
          style={{ color: ACCENT_VAR[accent] }}
          aria-hidden
        >
          <BarChart3 size={13} />
        </div>
      )}

      {show && (
        <div
          className={`absolute top-full z-40 pt-2 ${align === "right" ? "right-0" : "left-0"}`}
          style={{ width: 460, maxWidth: "88vw" }}
        >
          <HistogramPanel
            pts={pts}
            metric={metric}
            accent={accent}
            label={metricLabel}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Panel del histograma
// ============================================================
function HistogramPanel({
  pts,
  metric,
  accent,
  label,
}: {
  pts: MonthPoint[];
  metric: Metric;
  accent: Accent;
  label: string;
}) {
  const [mode, setMode] = useState<"timeline" | "comparativo">("timeline");
  const color = ACCENT_VAR[accent];
  const fmt = metric === "kg" ? formatKilos : formatMoney;
  const valOf = (p: MonthPoint) =>
    metric === "venta" ? p.venta : metric === "margen" ? p.margen : p.kg;

  const byKey = useMemo(() => {
    const m = new Map<string, MonthPoint>();
    for (const p of pts) m.set(`${p.anio}-${p.mes}`, p);
    return m;
  }, [pts]);

  // Mes más reciente con dato = "actual" (para resaltar).
  const latest = useMemo(
    () =>
      pts.reduce(
        (a, p) =>
          p.anio > a.anio || (p.anio === a.anio && p.mes > a.mes) ? p : a,
        pts[0]
      ),
    [pts]
  );

  // ---- Timeline: meses seguidos + media móvil 3 meses ----
  const timeline = useMemo(() => {
    const sorted = [...pts].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
    return sorted.map((p, i) => {
      const win = sorted.slice(Math.max(0, i - 2), i + 1);
      const ma = win.reduce((s, x) => s + valOf(x), 0) / win.length;
      const prev = byKey.get(`${p.anio - 1}-${p.mes}`);
      return {
        label: MES_ABBR[p.mes] + (p.mes === 1 ? ` '${String(p.anio).slice(2)}` : ""),
        anio: p.anio,
        mes: p.mes,
        value: valOf(p),
        ma,
        venta: p.venta,
        prevValue: prev ? valOf(prev) : null,
        isCurrent: p.anio === latest.anio && p.mes === latest.mes,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, byKey, metric, latest]);

  // ---- Comparativo: Ene–Dic, una barra por año + línea promedio estacional ----
  const comparativo = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const mes = idx + 1;
      const row: Record<string, number | string | null> = {
        mes,
        label: MES_ABBR[mes],
      };
      let sum = 0;
      let cnt = 0;
      for (const y of YEARS) {
        const p = byKey.get(`${y}-${mes}`);
        const v = p ? valOf(p) : null;
        row[`y${y}`] = v;
        row[`venta${y}`] = p ? p.venta : null;
        if (v != null) {
          sum += v;
          cnt++;
        }
      }
      row.prom = cnt ? sum / cnt : null;
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byKey, metric]);

  return (
    <div
      className="rounded-[var(--radius-lg)] border p-3"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header: título + toggle */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          {label} · histórico mensual
        </div>
        <div
          className="inline-flex items-center rounded-[var(--radius-sm)] border p-0.5"
          style={{
            background: "var(--bg-surface-muted)",
            borderColor: "var(--border)",
          }}
        >
          {(["timeline", "comparativo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: mode === m ? "var(--bg-surface)" : "transparent",
                color: mode === m ? color : "var(--text-muted)",
                boxShadow: mode === m ? "var(--shadow-card)" : "none",
              }}
            >
              {m === "timeline" ? "Timeline" : "Comparativo"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: "100%", height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          {mode === "timeline" ? (
            <ComposedChart
              data={timeline}
              margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                interval={2}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "var(--bg-surface-muted)", opacity: 0.4 }}
                content={
                  <TimelineTooltip metric={metric} fmt={fmt} color={color} />
                }
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={22}>
                {timeline.map((d, i) => (
                  <Cell
                    key={i}
                    fill={color}
                    fillOpacity={d.isCurrent ? 1 : 0.5}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="ma"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={comparativo}
              margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "var(--bg-surface-muted)", opacity: 0.4 }}
                content={<ComparativoTooltip fmt={fmt} color={color} />}
              />
              <Bar dataKey="y2024" fill={color} fillOpacity={0.3} radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Bar dataKey="y2025" fill={color} fillOpacity={0.58} radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Bar dataKey="y2026" fill={color} fillOpacity={1} radius={[2, 2, 0, 0]} maxBarSize={10} />
              <Line
                type="monotone"
                dataKey="prom"
                stroke="var(--text-muted)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div
        className="mt-1.5 flex items-center justify-center gap-3 text-[9px]"
        style={{ color: "var(--text-muted)" }}
      >
        {mode === "timeline" ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} /> mes
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-[2px] w-3" style={{ background: color }} /> tendencia (3m)
            </span>
          </>
        ) : (
          <>
            <span>2024 · 2025 · 2026 (más sólido = más reciente)</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-[2px] w-3" style={{ background: "var(--text-muted)" }} /> prom.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tooltips
// ============================================================
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Record<string, number | string | null> }>;
  metric?: Metric;
  fmt: (n: number) => string;
  color: string;
}

function deltaLine(
  cur: number,
  prev: number | null | undefined,
  fmt: (n: number) => string,
  vsLabel: string
) {
  if (prev == null || prev === 0) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const up = pct >= 0;
  const abs = cur - prev;
  return (
    <div className="text-[10px]" style={{ color: up ? "var(--success)" : "var(--danger)" }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {pct.toFixed(1)}% ({up ? "+" : ""}
      {fmt(abs)}) vs {vsLabel}
    </div>
  );
}

function TimelineTooltip({ active, payload, metric, fmt, color }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const anio = Number(d.anio);
  const mes = Number(d.mes);
  const value = Number(d.value);
  const prev = d.prevValue == null ? null : Number(d.prevValue);
  const venta = Number(d.venta);
  return (
    <div
      className="rounded-[var(--radius)] border px-2.5 py-1.5"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {MES_ABBR[mes]} {anio}
      </div>
      <div className="text-sm font-bold tabular-nums" style={{ color }}>
        {fmt(value)}
        {metric === "margen" && venta > 0 && (
          <span className="ml-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
            {((value / venta) * 100).toFixed(1)}%
          </span>
        )}
      </div>
      {deltaLine(value, prev, fmt, `${MES_ABBR[mes]} ${anio - 1}`)}
    </div>
  );
}

function ComparativoTooltip({ active, payload, fmt, color }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const mes = Number(d.mes);
  const rows = YEARS.map((y) => ({ y, v: d[`y${y}`] == null ? null : Number(d[`y${y}`]) }));
  const y26 = d.y2026 == null ? null : Number(d.y2026);
  const y25 = d.y2025 == null ? null : Number(d.y2025);
  return (
    <div
      className="rounded-[var(--radius)] border px-2.5 py-1.5"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {MES_ABBR[mes]}
      </div>
      {rows.map(({ y, v }) => (
        <div key={y} className="flex items-center justify-between gap-3 text-[11px] tabular-nums">
          <span style={{ color: "var(--text-secondary)" }}>{y}</span>
          <span className="font-semibold" style={{ color: v == null ? "var(--text-muted)" : color }}>
            {v == null ? "—" : fmt(v)}
          </span>
        </div>
      ))}
      {y26 != null && deltaLine(y26, y25, fmt, `${MES_ABBR[mes]} 2025`)}
    </div>
  );
}
