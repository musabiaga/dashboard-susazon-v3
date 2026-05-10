"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney, formatKilos } from "@/lib/format";
import {
  GroupedBarChart,
  type GroupedBarSeries,
} from "@/components/dashboard/GroupedBarChart";
import { MultiSelectChips } from "@/components/dashboard/MultiSelectChips";

export interface DimensionRow {
  name: string;
  v24: number;
  v25: number;
  v26: number;
  // Opcionales — Productos los popula con kg y margen.
  k24?: number;
  k25?: number;
  k26?: number;
  m24?: number;
  m25?: number;
  m26?: number;
  // Tab Vendedores y Clientes pueden traer info extra
  empresa?: string; // "Sus" | "Suve" para Vendedores
}

interface Props {
  rows: DimensionRow[];
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
  /** Header/columna: "Grupo" / "Cliente" / "Vendedor" */
  dimensionLabel: string;
  /** Plural usado en titulo del chart: "Grupos" / "Clientes" / "Vendedores" */
  dimensionLabelPlural: string;
  /** Cuantos en chart (resto en tabla). Si null, muestra TODOS en chart. Default 10. */
  topNChart?: number | null;
  /** Cuantos en tabla. Si null, muestra TODOS. Default null (todos). */
  topNTable?: number | null;
  /** Si true, agrega 4 columnas extra de KG en la tabla (kg24, kg25, kg26, var % kg).
   *  Solo se activa cuando los rows traen k24/k25/k26 poblados. Default false. */
  showKg?: boolean;
  /** Si true, agrega un buscador con multi-select arriba del chart. La selección
   *  override el Top N (sólo afecta el chart, la tabla mantiene Top N). */
  enableMultiSelect?: boolean;
  /** Key de localStorage para persistir la selección entre sesiones. Requerido
   *  cuando enableMultiSelect=true. */
  selectionStorageKey?: string;
  /** Máximo de items seleccionables en el multi-select. Default 15. */
  multiSelectMaxItems?: number;
  /** Placeholder del buscador (ej. "Buscar cliente…"). */
  multiSelectPlaceholder?: string;
}

/**
 * Componente generico para tabs basados en una dimension (grupo, cliente,
 * vendedor) con la misma estructura: bar chart top N + tabla con
 * comparacion 3 anos + Var %.
 *
 * Usado por:
 *  - Tab Grupo Producto (cambio funcional #1 + #2)
 *  - Tab Clientes (cambio #3)
 *  - Tab Vendedores
 *
 * El bug del V2.2 ("$0, $1, $2..." en eje X) se resuelve usando Recharts
 * con XAxis dataKey="name" en GroupedBarChart.
 */
export function DimensionTab({
  rows,
  monthLabel24,
  monthLabel25,
  monthLabel26,
  dimensionLabel,
  dimensionLabelPlural,
  topNChart = 10,
  topNTable = null,
  showKg = false,
  enableMultiSelect = false,
  selectionStorageKey,
  multiSelectMaxItems = 15,
  multiSelectPlaceholder = "Buscar…",
}: Props) {
  // Selección custom (multi-select). Vacía = comportamiento default Top N.
  // Persistencia en localStorage si selectionStorageKey está definido.
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  useEffect(() => {
    if (!enableMultiSelect || !selectionStorageKey) return;
    try {
      const raw = window.localStorage.getItem(selectionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedItems(parsed.filter((s) => typeof s === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, [enableMultiSelect, selectionStorageKey]);
  const updateSelected = (next: string[]) => {
    const trimmed = next.slice(0, multiSelectMaxItems);
    setSelectedItems(trimmed);
    if (!selectionStorageKey) return;
    try {
      window.localStorage.setItem(
        selectionStorageKey,
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

  // Items disponibles para el multi-select (todos los nombres únicos)
  const availableItems = useMemo(
    () => sorted.map((r) => r.name),
    [sorted]
  );

  const isCustomMode = enableMultiSelect && selectedItems.length > 0;

  // Items del chart:
  //  - Custom: respeta orden de selección del usuario, mapea a rows reales
  //  - Default: top N por venta del mes actual
  const top = useMemo(() => {
    if (isCustomMode) {
      const byName = new Map(rows.map((r) => [r.name, r]));
      return selectedItems
        .map((name) => byName.get(name))
        .filter((r): r is DimensionRow => r != null);
    }
    return topNChart == null ? sorted : sorted.slice(0, topNChart);
  }, [isCustomMode, selectedItems, rows, sorted, topNChart]);

  // Tabla:
  //  - Si está en modo personalizado (con selección custom) → tabla muestra
  //    SOLO los items seleccionados (mismo orden que el chart, coherente).
  //  - Si modo default → topNTable como antes.
  const tableRows = useMemo(() => {
    if (isCustomMode) {
      return top;
    }
    return topNTable == null ? sorted : sorted.slice(0, topNTable);
  }, [isCustomMode, top, sorted, topNTable]);

  const series: GroupedBarSeries[] = [
    { key: "v24", label: monthLabel24, color: "#94a3b8" },
    { key: "v25", label: monthLabel25, color: "#3b82f6" },
    { key: "v26", label: monthLabel26, color: "#10b981" },
  ];

  // Series de margen para chart + tooltip. Las labels añaden "Margen" para
  // distinguir de las barras de venta en la leyenda.
  const marginAmountSeries: GroupedBarSeries[] = [
    { key: "m24", label: `Margen ${monthLabel24}`, color: "#94a3b8" },
    { key: "m25", label: `Margen ${monthLabel25}`, color: "#3b82f6" },
    { key: "m26", label: `Margen ${monthLabel26}`, color: "#10b981" },
  ];
  const marginPctSeries: GroupedBarSeries[] = [
    { key: "mp24", label: `Margen % ${monthLabel24}`, color: "#94a3b8" },
    { key: "mp25", label: `Margen % ${monthLabel25}`, color: "#3b82f6" },
    { key: "mp26", label: `Margen % ${monthLabel26}`, color: "#10b981" },
  ];

  return (
    <div className="space-y-4">
      {/* Chart top N */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {top.length === 0 && !enableMultiSelect ? (
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
                    ? `${top.length} ${dimensionLabelPlural} seleccionado${top.length === 1 ? "" : "s"} · ${monthLabel26}`
                    : topNChart == null
                      ? `${dimensionLabelPlural} · ${monthLabel26}`
                      : `Top ${top.length} ${dimensionLabelPlural} · ${monthLabel26}`}
                </h3>
                {isCustomMode && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Modo personalizado · selección custom override Top default
                  </span>
                )}
              </div>
              {enableMultiSelect && (
                <MultiSelectChips
                  options={availableItems}
                  selected={selectedItems}
                  onChange={updateSelected}
                  maxItems={multiSelectMaxItems}
                  placeholder={multiSelectPlaceholder}
                  emptyLabel="Top default"
                />
              )}
            </div>
            {top.length === 0 ? (
              <p
                className="py-12 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {isCustomMode
                  ? "Sin data para los items seleccionados en este mes."
                  : "Sin data del mes actual."}
              </p>
            ) : (
              <GroupedBarChart
                data={top.map((r) => {
                  const m24 = r.m24 ?? 0;
                  const m25 = r.m25 ?? 0;
                  const m26 = r.m26 ?? 0;
                  return {
                    name: r.name,
                    v24: r.v24,
                    v25: r.v25,
                    v26: r.v26,
                    m24,
                    m25,
                    m26,
                    // Margen % por año (margen / venta * 100). Si venta = 0, null.
                    mp24: r.v24 > 0 ? (m24 / r.v24) * 100 : 0,
                    mp25: r.v25 > 0 ? (m25 / r.v25) * 100 : 0,
                    mp26: r.v26 > 0 ? (m26 / r.v26) * 100 : 0,
                  };
                })}
                series={series}
                marginAmountSeries={marginAmountSeries}
                marginPctSeries={marginPctSeries}
                height={520}
                xAngle={-30}
                xLabelHeight={130}
              />
            )}
          </>
        )}
      </div>

      {/* Tabla */}
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
                  <Th>{dimensionLabel}</Th>
                  {/* Pesos */}
                  <Th align="right">{monthLabel24}</Th>
                  <Th align="right">{monthLabel25}</Th>
                  <Th align="right">{monthLabel26}</Th>
                  <Th align="right">Var %</Th>
                  {/* KG (opcional) */}
                  {showKg && (
                    <>
                      <Th align="right" subtle>{`KG ${monthLabel24}`}</Th>
                      <Th align="right" subtle>{`KG ${monthLabel25}`}</Th>
                      <Th align="right" subtle>{`KG ${monthLabel26}`}</Th>
                      <Th align="right" subtle>Var % KG</Th>
                    </>
                  )}
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
                      key={r.name + i}
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
                      {showKg && (
                        <>
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
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {topNTable != null && sorted.length > tableRows.length && (
            <div
              className="border-t px-3 py-2 text-center text-[11px]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Mostrando top {tableRows.length} de {sorted.length}{" "}
              {dimensionLabelPlural.toLowerCase()}
            </div>
          )}
        </div>
      )}
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
