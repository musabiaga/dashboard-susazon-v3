"use client";

import { useMemo, useState } from "react";
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
import { formatMoney, formatKilos } from "@/lib/format";
import type { DimensionRow } from "@/components/dashboard/GrupoProductoTab";

interface Props {
  rows: DimensionRow[];
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
  /** Default inicial del toggle del chart. Default 15. */
  topNChartDefault?: 10 | 15;
  /** Cuántos SKUs en tabla. Default 50. */
  topNTable?: number;
}

/**
 * Tab Productos:
 *  - V2.2 solo tenía tabla. Cambio funcional #4: agregar chart ARRIBA.
 *  - Chart: top N SKUs del mes actual con bars=Venta + line=Kilos
 *    (similar al estilo del tab Ventas pero por SKU en lugar de mes).
 *  - Tabla: top N SKUs sorted por venta del mes actual, con columnas
 *    Abr 24/25/26 + Var %.
 */
export function ProductosTab({
  rows,
  monthLabel24,
  monthLabel25,
  monthLabel26,
  topNChartDefault = 15,
  topNTable = 50,
}: Props) {
  const [topNChart, setTopNChart] = useState<10 | 15>(topNChartDefault);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.v26 - a.v26),
    [rows]
  );
  const top = useMemo(() => sorted.slice(0, topNChart), [sorted, topNChart]);
  const tableRows = useMemo(
    () => sorted.slice(0, topNTable),
    [sorted, topNTable]
  );

  return (
    <div className="space-y-4">
      {/* ============ Chart top N — venta + kilos ============ */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {top.length === 0 ? (
          <p
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin data del mes actual.
          </p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Top {top.length} SKUs · {monthLabel26} · Pesos & Kilos
              </h3>
              <TopToggle value={topNChart} onChange={setTopNChart} />
            </div>
            <ResponsiveContainer width="100%" height={560}>
              <ComposedChart
                data={top.map((r) => ({
                  name: r.name,
                  venta24: r.v24,
                  venta25: r.v25,
                  venta26: r.v26,
                  kg24: r.k24 ?? 0,
                  kg25: r.k25 ?? 0,
                  kg26: r.k26 ?? 0,
                }))}
                margin={{ top: 8, right: 30, bottom: 0, left: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={130}
                  tick={{ fontSize: 9, fill: "var(--text-secondary)" }}
                  stroke="var(--border-strong)"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  stroke="var(--border-strong)"
                  tickFormatter={(v) => formatKilos(v)}
                  label={{
                    value: "Kilos",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "var(--text-muted)", fontSize: 10 },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  stroke="var(--border-strong)"
                  tickFormatter={(v) => formatMoney(v)}
                  label={{
                    value: "Pesos ($)",
                    angle: 90,
                    position: "insideRight",
                    style: { fill: "var(--text-muted)", fontSize: 10 },
                  }}
                />
                <Tooltip
                  content={<ProductosTooltip />}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Legend
                  verticalAlign="top"
                  align="center"
                  height={28}
                  wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                  iconType="rect"
                />
                {/* 3 series de barras Kilos (eje izquierdo) */}
                <Bar
                  yAxisId="left"
                  dataKey="kg24"
                  name={`Kilos ${monthLabel24}`}
                  fill="rgba(148, 163, 184, 0.7)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="kg25"
                  name={`Kilos ${monthLabel25}`}
                  fill="rgba(59, 130, 246, 0.85)"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="kg26"
                  name={`Kilos ${monthLabel26}`}
                  fill="rgba(16, 185, 129, 0.85)"
                  radius={[2, 2, 0, 0]}
                />
                {/* 3 series de lineas Venta/Pesos (eje derecho) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="venta24"
                  name={`Venta ${monthLabel24}`}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={{ r: 2.5, strokeWidth: 1, fill: "white" }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="venta25"
                  name={`Venta ${monthLabel25}`}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="venta26"
                  name={`Venta ${monthLabel26}`}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, strokeWidth: 1, fill: "white" }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ============ Tabla top N SKUs ============ */}
      {tableRows.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th>SKU</Th>
                  <Th align="right">{monthLabel24}</Th>
                  <Th align="right">{monthLabel25}</Th>
                  <Th align="right">{monthLabel26}</Th>
                  <Th align="right">Var %</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const varPct =
                    r.v25 > 0 ? ((r.v26 - r.v25) / r.v25) * 100 : null;
                  return (
                    <tr
                      key={r.name}
                      style={{
                        background:
                          i % 2 === 0
                            ? "var(--bg-surface)"
                            : "var(--bg-surface-muted)",
                      }}
                    >
                      <Td>{r.name}</Td>
                      <Td align="right">{formatMoney(r.v24)}</Td>
                      <Td align="right">{formatMoney(r.v25)}</Td>
                      <Td align="right">{formatMoney(r.v26)}</Td>
                      <Td
                        align="right"
                        bold
                        color={
                          varPct == null
                            ? "var(--text-muted)"
                            : varPct >= 0
                              ? "var(--success)"
                              : "var(--danger)"
                        }
                      >
                        {varPct == null
                          ? "—"
                          : `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > tableRows.length && (
            <div
              className="border-t px-3 py-2 text-center text-[11px]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Mostrando top {tableRows.length} de {sorted.length} SKUs
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tooltip — venta + kilos en card limpia
// ============================================================
interface TooltipPayloadItem {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string;
}

function ProductosTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const ventaItems = payload.filter((p) => p.name?.startsWith("Venta"));
  const kgItems = payload.filter((p) => p.name?.startsWith("Kilos"));

  // YoY delta para Venta 26 vs 25
  const v25 = ventaItems.find((p) => p.dataKey === "venta25")?.value;
  const v26 = ventaItems.find((p) => p.dataKey === "venta26")?.value;
  const yoyDelta =
    typeof v25 === "number" && v25 > 0 && typeof v26 === "number"
      ? ((v26 - v25) / v25) * 100
      : null;

  // Precio/kg del año actual (26)
  const k26 = kgItems.find((p) => p.dataKey === "kg26")?.value;
  const pricePerKg =
    typeof v26 === "number" && typeof k26 === "number" && k26 > 0
      ? v26 / k26
      : null;

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 260,
        maxWidth: 360,
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
          className="truncate text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </span>
        {yoyDelta != null && (
          <span
            className="shrink-0 text-[10px] font-semibold"
            style={{
              color: yoyDelta >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta).toFixed(1)}% vs '25
          </span>
        )}
      </div>

      {/* Sección Pesos */}
      {ventaItems.length > 0 && (
        <div className="px-3 py-2">
          <div
            className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Pesos ($)
          </div>
          {ventaItems.map((p) => (
            <Row
              key={p.name}
              color={p.color ?? "var(--text-muted)"}
              label={p.name?.replace("Venta ", "") ?? ""}
              value={
                typeof p.value === "number" ? formatMoney(p.value) : "—"
              }
            />
          ))}
        </div>
      )}

      {/* Sección Kilos */}
      {kgItems.length > 0 && (
        <div
          className="px-3 py-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div
            className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Kilos
          </div>
          {kgItems.map((p) => (
            <Row
              key={p.name}
              color={p.color ?? "var(--text-muted)"}
              label={p.name?.replace("Kilos ", "") ?? ""}
              value={
                typeof p.value === "number" ? formatKilos(p.value) : "—"
              }
            />
          ))}
        </div>
      )}

      {/* Footer: precio/kg */}
      {pricePerKg != null && (
        <div
          className="px-3 py-1.5 text-[10px]"
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg-surface-muted)",
            color: "var(--text-muted)",
          }}
        >
          Precio/kg: <strong style={{ color: "var(--text-primary)" }}>
            {formatMoney(pricePerKg)}
          </strong>
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

function TopToggle({
  value,
  onChange,
}: {
  value: 10 | 15;
  onChange: (v: 10 | 15) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      {([10, 15] as const).map((n) => {
        const active = n === value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active
                ? "0 1px 2px rgba(0,0,0,0.05)"
                : "none",
            }}
          >
            Top {n}
          </button>
        );
      })}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  color,
  bold = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  color?: string;
  bold?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-${align}`}
      style={{
        color: color ?? "var(--text-primary)",
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}
