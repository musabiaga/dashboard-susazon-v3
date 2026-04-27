"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/format";

export interface GroupedBarSeries {
  key: string;   // dataKey en cada item
  label: string; // nombre en legend/tooltip
  color: string; // hex
}

export interface GroupedBarRow {
  name: string; // label del eje X
  [key: string]: string | number;
}

interface Props {
  data: GroupedBarRow[];
  series: GroupedBarSeries[];
  height?: number;
  /** Formato del valor en eje Y. Default: formatMoney */
  yFormatter?: (value: number) => string;
  /** Rotación del label del eje X. Default: -30 (legible para nombres largos) */
  xAngle?: number;
  /** Altura de la zona donde caben los labels rotados del eje X. Default 90. */
  xLabelHeight?: number;
  /** Posición de la leyenda. Default "top" para no robarle plot area al chart. */
  legendVerticalAlign?: "top" | "bottom";
}

/**
 * Bar chart agrupado reusable. Cada item de `data` tiene `name` (eje X)
 * + N campos correspondientes a las series (Abr 24, Abr 25, Abr 26, etc.).
 *
 * Soluciona el bug del V2.2 donde el eje X mostraba "$0, $1, $2..." porque
 * Chart.js no recibia labels — Recharts usa `dataKey="name"` explicitamente.
 */
export function GroupedBarChart({
  data,
  series,
  height = 480,
  yFormatter = formatMoney,
  xAngle = -30,
  xLabelHeight = 90,
  legendVerticalAlign = "top",
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        // top mas grande si legend esta arriba para no traslapar
        margin={{
          top: legendVerticalAlign === "top" ? 8 : 20,
          right: 30,
          bottom: 0,
          left: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="name"
          angle={xAngle}
          textAnchor={xAngle < 0 ? "end" : "start"}
          interval={0}
          height={xLabelHeight}
          tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
          stroke="var(--border-strong)"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          stroke="var(--border-strong)"
          tickFormatter={yFormatter}
        />
        <Tooltip
          content={(props) => (
            <GroupedBarTooltip {...props} yFormatter={yFormatter} />
          )}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Legend
          verticalAlign={legendVerticalAlign}
          align="center"
          height={28}
          wrapperStyle={{ fontSize: 12, paddingBottom: legendVerticalAlign === "top" ? 8 : 0 }}
          iconType="rect"
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// Custom tooltip — dot, label, value tabular right-aligned
// ============================================================
interface TooltipItem {
  name?: string;
  value?: number | string;
  color?: string;
}

function GroupedBarTooltip({
  active,
  payload,
  label,
  yFormatter,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  yFormatter: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Ordenar series con valor numerico, dejando ceros al final
  const sorted = [...payload].sort((a, b) => {
    const av = typeof a.value === "number" ? a.value : 0;
    const bv = typeof b.value === "number" ? b.value : 0;
    return bv - av;
  });

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 240,
        maxWidth: 360,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="px-3 py-2"
        style={{
          background: "var(--bg-surface-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </div>
      </div>
      <div className="px-3 py-2">
        {sorted.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between gap-4 py-0.5"
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: p.color ?? "var(--text-muted)" }}
              />
              <span style={{ color: "var(--text-secondary)" }}>{p.name}</span>
            </span>
            <span
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {typeof p.value === "number" ? yFormatter(p.value) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
