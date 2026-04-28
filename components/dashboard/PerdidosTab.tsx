"use client";

import { useMemo, useState } from "react";
import {
  AlertOctagon,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

export type PerdidoStatus = "perdido" | "declive";
export type PerdidoDim = "mes" | "ytd";

export interface PerdidoRow {
  no_cliente: string;
  cliente: string;
  vendedor: string;
  // Mes actual
  mes_venta_2025: number;
  mes_venta_2026: number;
  mes_kg_2025: number;
  mes_kg_2026: number;
  // YTD (Ene a mes actual)
  ytd_venta_2025: number;
  ytd_venta_2026: number;
  ytd_kg_2025: number;
  ytd_kg_2026: number;
}

interface Props {
  rows: PerdidoRow[];
  monthShortYY: string; // "Abr 26"
  prevMonthShortYY: string; // "Abr 25"
  topNTable?: number; // default 100
}

interface Computed {
  cliente: string;
  vendedor: string;
  no_cliente: string;
  status: PerdidoStatus;
  v25: number;
  v26: number;
  k25: number;
  k26: number;
  declinePct: number;
}

function computeStatus(v25: number, v26: number): {
  status: PerdidoStatus | null;
  declinePct: number;
} {
  if (v25 > 0 && v26 === 0) return { status: "perdido", declinePct: 100 };
  if (v25 > 0 && v26 < v25) {
    return { status: "declive", declinePct: ((v25 - v26) / v25) * 100 };
  }
  return { status: null, declinePct: 0 };
}

/**
 * Tab Perdidos con toggle "Mes Actual" / "YTD":
 *  - Toggle decide qué dimensión analizar (mes corriente o year-to-date).
 *  - 3 stats cards basadas en dimensión activa.
 *  - Tabla con columnas: Cliente · Vendedor · Status · $ 25 · $ 26 · Var $ %
 *    · Kg 25 · Kg 26 · Var Kg %.
 *  - Status (perdido/declive) computado server-side basado en venta $:
 *      perdido = v25 > 0 AND v26 = 0
 *      declive = v26 < v25 (strict, excluye perdidos)
 */
export function PerdidosTab({
  rows,
  monthShortYY,
  prevMonthShortYY,
  topNTable = 100,
}: Props) {
  const [dim, setDim] = useState<PerdidoDim>("mes");

  // Compute por dimensión activa
  const computed: Computed[] = useMemo(() => {
    const out: Computed[] = [];
    for (const r of rows) {
      const v25 = dim === "mes" ? r.mes_venta_2025 : r.ytd_venta_2025;
      const v26 = dim === "mes" ? r.mes_venta_2026 : r.ytd_venta_2026;
      const k25 = dim === "mes" ? r.mes_kg_2025 : r.ytd_kg_2025;
      const k26 = dim === "mes" ? r.mes_kg_2026 : r.ytd_kg_2026;
      const { status, declinePct } = computeStatus(v25, v26);
      if (!status) continue;
      out.push({
        no_cliente: r.no_cliente,
        cliente: r.cliente,
        vendedor: r.vendedor,
        status,
        v25,
        v26,
        k25,
        k26,
        declinePct,
      });
    }
    return out.sort((a, b) => b.v25 - a.v25);
  }, [rows, dim]);

  const tableRows = useMemo(
    () => computed.slice(0, topNTable),
    [computed, topNTable]
  );

  const stats = useMemo(() => {
    const perdidos = computed.filter((r) => r.status === "perdido").length;
    const declives = computed.filter((r) => r.status === "declive");
    const declive30 = declives.filter((r) => r.declinePct > 30).length;
    return { perdidos, declive30, totalDeclive: declives.length };
  }, [computed]);

  const dimLabel =
    dim === "mes"
      ? `Mes ${monthShortYY}`
      : `YTD (Ene–${monthShortYY.split(" ")[0]} ${monthShortYY.split(" ")[1]})`;
  const labelPrev = dim === "mes" ? prevMonthShortYY : "Ene–Abr 25";
  const labelCurr = dim === "mes" ? monthShortYY : "Ene–Abr 26";

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-end">
        <DimToggle value={dim} onChange={setDim} monthShortYY={monthShortYY} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<AlertOctagon size={18} />}
          label={`Perdidos · ${dimLabel}`}
          value={stats.perdidos.toLocaleString("es-MX")}
          tone="danger"
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Declive >30%"
          value={stats.declive30.toLocaleString("es-MX")}
          tone="warning"
        />
        <StatCard
          icon={<TrendingDown size={18} />}
          label="Total Declive"
          value={stats.totalDeclive.toLocaleString("es-MX")}
          tone="muted"
        />
      </div>

      {/* Tabla */}
      {computed.length === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] border p-12 text-center text-sm"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Sin clientes en estado perdido o declive para esta dimensión 🎉
        </div>
      ) : (
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
                  <Th>Cliente</Th>
                  <Th>Vendedor</Th>
                  <Th align="center">Status</Th>
                  <Th align="right">{labelPrev} $</Th>
                  <Th align="right">{labelCurr} $</Th>
                  <Th align="right">Var $ %</Th>
                  <Th align="right">{labelPrev} kg</Th>
                  <Th align="right">{labelCurr} kg</Th>
                  <Th align="right">Var kg %</Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const varKgPct =
                    r.k25 > 0 ? ((r.k26 - r.k25) / r.k25) * 100 : null;
                  const varKgColor =
                    varKgPct == null
                      ? "var(--text-muted)"
                      : varKgPct <= -100
                        ? "var(--danger)"
                        : varKgPct < -30
                          ? "var(--danger)"
                          : varKgPct < 0
                            ? "var(--warning)"
                            : "var(--success)";
                  const var$Color =
                    r.declinePct >= 100
                      ? "var(--danger)"
                      : r.declinePct > 30
                        ? "var(--danger)"
                        : "var(--warning)";
                  return (
                    <tr
                      key={r.no_cliente}
                      style={{
                        background:
                          i % 2 === 0
                            ? "var(--bg-surface)"
                            : "var(--bg-surface-muted)",
                      }}
                    >
                      <Td>{r.cliente}</Td>
                      <Td>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {r.vendedor}
                        </span>
                      </Td>
                      <Td align="center">
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td align="right">{formatMoney(r.v25)}</Td>
                      <Td align="right">{formatMoney(r.v26)}</Td>
                      <Td align="right" bold color={var$Color}>
                        -{r.declinePct.toFixed(1)}%
                      </Td>
                      <Td align="right">{formatKilos(r.k25)}</Td>
                      <Td align="right">{formatKilos(r.k26)}</Td>
                      <Td align="right" bold color={varKgColor}>
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
          {computed.length > tableRows.length && (
            <div
              className="border-t px-3 py-2 text-center text-[11px]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Mostrando top {tableRows.length} de {computed.length} clientes
              (ordenados por venta {labelPrev})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function DimToggle({
  value,
  onChange,
  monthShortYY,
}: {
  value: PerdidoDim;
  onChange: (v: PerdidoDim) => void;
  monthShortYY: string;
}) {
  const opts: Array<{ v: PerdidoDim; label: string }> = [
    { v: "mes", label: `Mes ${monthShortYY}` },
    { v: "ytd", label: "YTD" },
  ];
  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      {opts.map((opt) => {
        const active = opt.v === value;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "danger" | "warning" | "muted";
}) {
  const accentVar =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--text-secondary)";
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
      <div
        className="mt-3 text-3xl font-bold tabular-nums"
        style={{ color: accentVar }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PerdidoStatus }) {
  const config = {
    perdido: {
      label: "Perdido",
      bg: "var(--danger-soft)",
      color: "var(--danger)",
    },
    declive: {
      label: "Declive",
      bg: "var(--warning-soft)",
      color: "var(--warning)",
    },
  }[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
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
