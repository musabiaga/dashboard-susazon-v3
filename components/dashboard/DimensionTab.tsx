"use client";

import { useMemo } from "react";
import { formatMoney, formatKilos } from "@/lib/format";
import {
  GroupedBarChart,
  type GroupedBarSeries,
} from "@/components/dashboard/GroupedBarChart";

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
}: Props) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.v26 - a.v26),
    [rows]
  );
  const top = useMemo(
    () => (topNChart == null ? sorted : sorted.slice(0, topNChart)),
    [sorted, topNChart]
  );
  const tableRows = useMemo(
    () => (topNTable == null ? sorted : sorted.slice(0, topNTable)),
    [sorted, topNTable]
  );

  const series: GroupedBarSeries[] = [
    { key: "v24", label: monthLabel24, color: "#94a3b8" },
    { key: "v25", label: monthLabel25, color: "#3b82f6" },
    { key: "v26", label: monthLabel26, color: "#10b981" },
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
        {top.length === 0 ? (
          <p
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin data del mes actual.
          </p>
        ) : (
          <>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {topNChart == null
                ? `${dimensionLabelPlural} · ${monthLabel26}`
                : `Top ${top.length} ${dimensionLabelPlural} · ${monthLabel26}`}
            </h3>
            <GroupedBarChart
              data={top.map((r) => ({
                name: r.name,
                v24: r.v24,
                v25: r.v25,
                v26: r.v26,
              }))}
              series={series}
              height={520}
              xAngle={-30}
              xLabelHeight={130}
            />
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
