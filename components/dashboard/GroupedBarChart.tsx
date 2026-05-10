"use client";

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
  /** Series de margen % opcionales. Si se pasan, se renderizan como líneas en
   *  un eje Y secundario derecho. Mismo color que sus barras de venta para
   *  facilitar la lectura visual. */
  marginPctSeries?: GroupedBarSeries[];
  /** Series de margen $ opcionales (NO se grafican, solo van al tooltip).
   *  Permiten enriquecer el tooltip con margen absoluto sin cargar más al
   *  chart. */
  marginAmountSeries?: GroupedBarSeries[];
}

/**
 * Bar chart agrupado reusable. Cada item de `data` tiene `name` (eje X)
 * + N campos correspondientes a las series (Abr 24, Abr 25, Abr 26, etc.).
 *
 * Cuando se pasan `marginPctSeries`, agrega líneas de margen % en eje Y
 * secundario derecho. El tooltip muestra venta + margen $ + margen %.
 */
export function GroupedBarChart({
  data,
  series,
  height = 480,
  yFormatter = formatMoney,
  xAngle = -30,
  xLabelHeight = 90,
  legendVerticalAlign = "top",
  marginPctSeries,
  marginAmountSeries,
}: Props) {
  const hasMargin = (marginPctSeries?.length ?? 0) > 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{
          top: legendVerticalAlign === "top" ? 8 : 20,
          right: hasMargin ? 50 : 30,
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
          yAxisId="left"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          stroke="var(--border-strong)"
          tickFormatter={yFormatter}
        />
        {hasMargin && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            domain={[0, "auto"]}
            label={{
              value: "Margen %",
              angle: 90,
              position: "insideRight",
              style: { fill: "var(--text-muted)", fontSize: 10 },
            }}
          />
        )}
        <Tooltip
          content={(props) => (
            <GroupedBarTooltip
              {...props}
              yFormatter={yFormatter}
              ventaSeries={series}
              marginAmountSeries={marginAmountSeries}
              marginPctSeries={marginPctSeries}
            />
          )}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Legend
          verticalAlign={legendVerticalAlign}
          align="center"
          height={28}
          wrapperStyle={{
            fontSize: 12,
            paddingBottom: legendVerticalAlign === "top" ? 8 : 0,
          }}
          iconType="rect"
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            yAxisId="left"
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[2, 2, 0, 0]}
          />
        ))}
        {hasMargin &&
          marginPctSeries!.map((s) => (
            <Line
              key={s.key}
              yAxisId="right"
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={{ r: 3, strokeWidth: 1, fill: "white" }}
              connectNulls
            />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// Custom tooltip — secciones Venta, Margen $, Margen %
// ============================================================
interface TooltipItem {
  name?: string | number;
  value?: number | string | readonly (string | number)[];
  color?: string;
  // Recharts permite dataKey como función (objeto → valor); aceptamos pero
  // sólo leemos el `payload` directamente para sacar valores por key.
  dataKey?: string | number | ((obj: unknown) => unknown);
}

function GroupedBarTooltip({
  active,
  payload,
  label,
  yFormatter,
  ventaSeries,
  marginAmountSeries,
  marginPctSeries,
}: {
  active?: boolean;
  payload?: readonly TooltipItem[];
  label?: string | number;
  yFormatter: (value: number) => string;
  ventaSeries: GroupedBarSeries[];
  marginAmountSeries?: GroupedBarSeries[];
  marginPctSeries?: GroupedBarSeries[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Recharts inyecta el row completo en cada item del payload (.payload).
  // Lo usamos para sacar margen $ aunque no esté graficado.
  const row = (payload[0] as TooltipItem & {
    payload?: Record<string, number | string>;
  })?.payload;

  // Helper: número desde row
  const num = (key: string): number | null => {
    if (!row) return null;
    const v = row[key];
    return typeof v === "number" ? v : null;
  };

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 260,
        maxWidth: 380,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2"
        style={{
          background: "var(--bg-surface-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="truncate text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
          title={String(label)}
        >
          {label}
        </div>
      </div>

      {/* Sección Venta */}
      <div className="px-3 py-2">
        <div
          className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Venta
        </div>
        {ventaSeries.map((s) => {
          const v = num(s.key);
          return (
            <Row
              key={s.key}
              color={s.color}
              label={s.label}
              value={v != null ? yFormatter(v) : "—"}
            />
          );
        })}
      </div>

      {/* Sección Margen $ */}
      {marginAmountSeries && marginAmountSeries.length > 0 && (
        <div
          className="px-3 py-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div
            className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Margen $
          </div>
          {marginAmountSeries.map((s) => {
            const v = num(s.key);
            return (
              <Row
                key={s.key}
                color={s.color}
                label={s.label}
                value={v != null ? yFormatter(v) : "—"}
              />
            );
          })}
        </div>
      )}

      {/* Sección Margen % */}
      {marginPctSeries && marginPctSeries.length > 0 && (
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
          {marginPctSeries.map((s) => {
            const v = num(s.key);
            return (
              <Row
                key={s.key}
                color={s.color}
                label={s.label}
                value={v != null ? `${v.toFixed(1)}%` : "—"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: color }}
        />
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </span>
      <span
        className="font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
