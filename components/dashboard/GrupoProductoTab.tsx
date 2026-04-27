"use client";

import { useMemo } from "react";
import { formatMoney } from "@/lib/format";
import {
  GroupedBarChart,
  type GroupedBarSeries,
} from "@/components/dashboard/GroupedBarChart";

export interface DimensionRow {
  name: string;
  v24: number;
  v25: number;
  v26: number;
  // Opcionales — solo Productos los popula (kg) por ahora.
  // Otros tabs los ignoran.
  k24?: number;
  k25?: number;
  k26?: number;
  m24?: number;
  m25?: number;
  m26?: number;
}

interface Props {
  rows: DimensionRow[];
  monthLabel24: string; // "Abr 24"
  monthLabel25: string; // "Abr 25"
  monthLabel26: string; // "Abr 26"
  topN?: number; // cuantos en chart (resto en tabla). Default 10.
}

const SERIES_ABR_24_25_26: (
  monthLabel24: string,
  monthLabel25: string,
  monthLabel26: string
) => GroupedBarSeries[] = (l24, l25, l26) => [
  { key: "v24", label: l24, color: "#94a3b8" }, // gris
  { key: "v25", label: l25, color: "#3b82f6" }, // azul
  { key: "v26", label: l26, color: "#10b981" }, // verde
];

/**
 * Tab Grupo Producto:
 *  - Replica del tab Familia del V2.2, pero usando el campo `grupo` (cambio #1).
 *  - Cambio #2: eje X muestra nombres de grupos correctamente (en V2.2 el bug
 *    de Chart.js mostraba "$0, $1, $2..."). Recharts con dataKey="name".
 *
 * Estructura:
 *  - Bar chart vertical con top 10 grupos por venta del mes actual (Abr 26).
 *  - Tabla debajo con TODOS los grupos.
 *  - Var % = (v26 - v25) / v25 × 100, color verde si crece, rojo si baja.
 */
export function GrupoProductoTab({
  rows,
  monthLabel24,
  monthLabel25,
  monthLabel26,
  topN = 10,
}: Props) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.v26 - a.v26),
    [rows]
  );
  const top = useMemo(() => sorted.slice(0, topN), [sorted, topN]);

  const series = SERIES_ABR_24_25_26(
    monthLabel24,
    monthLabel25,
    monthLabel26
  );

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
              Top {top.length} Grupos · {monthLabel26}
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
              xLabelHeight={110}
            />
          </>
        )}
      </div>

      {/* Tabla todos los grupos */}
      {sorted.length > 0 && (
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
                  <Th>Grupo</Th>
                  <Th align="right">{monthLabel24}</Th>
                  <Th align="right">{monthLabel25}</Th>
                  <Th align="right">{monthLabel26}</Th>
                  <Th align="right">Var %</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
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
        </div>
      )}
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
