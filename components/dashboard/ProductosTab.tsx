"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { DimensionRow } from "@/components/dashboard/DimensionTab";
import { MultiSelectChips } from "@/components/dashboard/MultiSelectChips";

const PRODUCTOS_SELECTED_KEY = "productos-selected-skus";
const MAX_CUSTOM_SELECTION = 15;

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

  // Selección custom de SKUs (multi-select). Si vacía → comportamiento default
  // (Top N). Si tiene items → override y se muestran SOLO esos. Persiste en
  // localStorage para que la elección sobreviva entre sesiones.
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRODUCTOS_SELECTED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedSkus(parsed.filter((s) => typeof s === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, []);
  const updateSelected = (next: string[]) => {
    // Lock estricto a MAX_CUSTOM_SELECTION (el componente ya lo maneja, pero
    // por defensa cortamos aquí también)
    const trimmed = next.slice(0, MAX_CUSTOM_SELECTION);
    setSelectedSkus(trimmed);
    try {
      window.localStorage.setItem(
        PRODUCTOS_SELECTED_KEY,
        JSON.stringify(trimmed)
      );
    } catch {
      // ignore
    }
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.v26 - a.v26),
    [rows]
  );

  // SKUs disponibles para el selector (todos los nombres únicos de los rows)
  const availableSkus = useMemo(
    () => sorted.map((r) => r.name),
    [sorted]
  );

  // ¿Modo "personalizado" (selección custom) o "default" (Top N)?
  const isCustomMode = selectedSkus.length > 0;

  // Items del chart:
  //  - Custom: respetar el orden de selección del usuario, mapeando rows reales
  //  - Default: top N por venta del mes actual
  const top = useMemo(() => {
    if (isCustomMode) {
      const byName = new Map(rows.map((r) => [r.name, r]));
      return selectedSkus
        .map((name) => byName.get(name))
        .filter((r): r is DimensionRow => r != null);
    }
    return sorted.slice(0, topNChart);
  }, [isCustomMode, selectedSkus, rows, sorted, topNChart]);

  // Tabla:
  //  - Custom mode (con selección): solo los items seleccionados, mismo
  //    orden que el chart (coherente para análisis)
  //  - Default: top N por venta del mes actual
  const tableRows = useMemo(() => {
    if (isCustomMode) {
      return top;
    }
    return sorted.slice(0, topNTable);
  }, [isCustomMode, top, sorted, topNTable]);

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
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {isCustomMode
                    ? `${top.length} SKU${top.length === 1 ? "" : "s"} seleccionado${top.length === 1 ? "" : "s"} · ${monthLabel26} · Pesos & Kilos`
                    : `Top ${top.length} SKUs · ${monthLabel26} · Pesos & Kilos`}
                </h3>
                {isCustomMode && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Modo personalizado · Top {topNChart} desactivado mientras haya selección
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-3">
                <MultiSelectChips
                  options={availableSkus}
                  selected={selectedSkus}
                  onChange={updateSelected}
                  maxItems={MAX_CUSTOM_SELECTION}
                  placeholder="Buscar SKU…"
                  emptyLabel="Top default"
                />
                <TopToggle
                  value={topNChart}
                  onChange={setTopNChart}
                  disabled={isCustomMode}
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={560}>
              <ComposedChart
                data={top.map((r) => {
                  // margen $ y margen % por año (solo para tooltip — Productos
                  // no grafica margen por la decisión 2.a aprobada por Mauricio:
                  // mantener chart limpio con Pesos+Kilos y poner margen sólo
                  // en el tooltip para no agregar 3er eje Y).
                  const m24 = r.m24 ?? 0;
                  const m25 = r.m25 ?? 0;
                  const m26 = r.m26 ?? 0;
                  return {
                    name: r.name,
                    venta24: r.v24,
                    venta25: r.v25,
                    venta26: r.v26,
                    kg24: r.k24 ?? 0,
                    kg25: r.k25 ?? 0,
                    kg26: r.k26 ?? 0,
                    margen24: m24,
                    margen25: m25,
                    margen26: m26,
                    margenPct24: r.v24 > 0 ? (m24 / r.v24) * 100 : 0,
                    margenPct25: r.v25 > 0 ? (m25 / r.v25) * 100 : 0,
                    margenPct26: r.v26 > 0 ? (m26 / r.v26) * 100 : 0,
                  };
                })}
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
                  {/* Pesos */}
                  <Th align="right">{monthLabel24}</Th>
                  <Th align="right">{monthLabel25}</Th>
                  <Th align="right">{monthLabel26}</Th>
                  <Th align="right">Var %</Th>
                  {/* KG */}
                  <Th align="right" subtle>{`KG ${monthLabel24}`}</Th>
                  <Th align="right" subtle>{`KG ${monthLabel25}`}</Th>
                  <Th align="right" subtle>{`KG ${monthLabel26}`}</Th>
                  <Th align="right" subtle>Var % KG</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const varPct =
                    r.v25 > 0 ? ((r.v26 - r.v25) / r.v25) * 100 : null;
                  const k24 = r.k24 ?? 0;
                  const k25 = r.k25 ?? 0;
                  const k26 = r.k26 ?? 0;
                  const varKgPct =
                    k25 > 0 ? ((k26 - k25) / k25) * 100 : null;
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
                      {/* KG */}
                      <Td align="right" subtle>{formatKilos(k24)}</Td>
                      <Td align="right" subtle>{formatKilos(k25)}</Td>
                      <Td align="right" subtle>{formatKilos(k26)}</Td>
                      <Td
                        align="right"
                        bold
                        color={
                          varKgPct == null
                            ? "var(--text-muted)"
                            : varKgPct >= 0
                              ? "var(--success)"
                              : "var(--danger)"
                        }
                      >
                        {varKgPct == null
                          ? "—"
                          : `${varKgPct >= 0 ? "+" : ""}${varKgPct.toFixed(1)}%`}
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

  // Recharts inyecta el row completo en payload[0].payload — usamos eso para
  // sacar margen $ y margen % aunque NO estén graficados (decisión 2.a).
  const row = (payload[0] as TooltipPayloadItem & {
    payload?: Record<string, number | string>;
  })?.payload;
  const num = (key: string): number | null => {
    if (!row) return null;
    const v = row[key];
    return typeof v === "number" ? v : null;
  };

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

  // Margen $ y margen % por año (NO graficados, sólo tooltip)
  const margenItems = [
    { key: "margen24", label: "24", color: "rgba(148, 163, 184, 0.7)" },
    { key: "margen25", label: "25", color: "#3b82f6" },
    { key: "margen26", label: "26", color: "#10b981" },
  ];
  const margenPctItems = [
    { key: "margenPct24", label: "24", color: "rgba(148, 163, 184, 0.7)" },
    { key: "margenPct25", label: "25", color: "#3b82f6" },
    { key: "margenPct26", label: "26", color: "#10b981" },
  ];
  const hasMargenData = margenItems.some((m) => num(m.key) != null);

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

      {/* Sección Margen $ (NO graficado, solo en tooltip) */}
      {hasMargenData && (
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
          {margenItems.map((m) => {
            const v = num(m.key);
            return (
              <Row
                key={m.key}
                color={m.color}
                label={m.label}
                value={v != null ? formatMoney(v) : "—"}
              />
            );
          })}
        </div>
      )}

      {/* Sección Margen % (NO graficado, solo en tooltip) */}
      {hasMargenData && (
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
          {margenPctItems.map((m) => {
            const v = num(m.key);
            return (
              <Row
                key={m.key}
                color={m.color}
                label={m.label}
                value={v != null ? `${v.toFixed(1)}%` : "—"}
              />
            );
          })}
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
  disabled = false,
}: {
  value: 10 | 15;
  onChange: (v: 10 | 15) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5 transition-opacity"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
      title={disabled ? "Limpia la selección personalizada para usar Top N" : undefined}
    >
      {([10, 15] as const).map((n) => {
        const active = n === value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            disabled={disabled}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed"
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
  subtle = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  /** Si true, color más tenue + borde izquierdo sutil para separar grupo de columnas. */
  subtle?: boolean;
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: subtle ? "var(--text-muted)" : "var(--text-secondary)",
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
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
  subtle = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  color?: string;
  bold?: boolean;
  /** Si true, color más tenue + borde izquierdo sutil. */
  subtle?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-${align}`}
      style={{
        color: color ?? (subtle ? "var(--text-secondary)" : "var(--text-primary)"),
        fontWeight: bold ? 600 : 400,
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
      }}
    >
      {children}
    </td>
  );
}
