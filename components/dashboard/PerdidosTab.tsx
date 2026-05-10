"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  TrendingDown,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

export type PerdidoStatus = "perdido" | "declive" | "nuevo" | "estable";
export type PerdidoDim = "mes" | "ytd";
export type PerdidoMetric = "pesos" | "kilos";

const PERDIDOS_METRIC_KEY = "perdidos-metric-mode";

export interface PerdidoRow {
  no_cliente: string;
  cliente: string;
  vendedor: string;
  // Mes actual cierre completo (mes_2025 = todo el mes 2025; mes_2026 = lo que llevamos)
  mes_venta_2025: number;
  mes_venta_2026: number;
  mes_kg_2025: number;
  mes_kg_2026: number;
  // YTD cierre completo (ytd_2025 = Ene-mes_actual 2025 todo cerrado;
  //                     ytd_2026 = Ene-hoy 2026 parcial)
  ytd_venta_2025: number;
  ytd_venta_2026: number;
  ytd_kg_2025: number;
  ytd_kg_2026: number;
  // ===== Al MISMO DÍA LABORAL del mes 2026 actual (Mejora 2 Commit C) =====
  // Para 2025: acumulado del mes hasta el día calendario equivalente al
  // día hábil que llevamos en 2026. Permite comparativos día-vs-día.
  // Para 2026: igual que mes_venta_2026 (lo que llevamos hoy).
  mes_venta_alDia_2025?: number;
  mes_venta_alDia_2026?: number;
  mes_kg_alDia_2025?: number;
  mes_kg_alDia_2026?: number;
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
  // Perdido: tenía venta en 2025 pero CERO en 2026
  if (v25 > 0 && v26 === 0) return { status: "perdido", declinePct: 100 };
  // Declive: tenía venta en 2025 y BAJO en 2026 (sin llegar a cero)
  if (v25 > 0 && v26 < v25) {
    return { status: "declive", declinePct: ((v25 - v26) / v25) * 100 };
  }
  // Nuevo: NO tenía venta en 2025 pero AHORA sí en 2026
  if (v25 === 0 && v26 > 0) {
    return { status: "nuevo", declinePct: 0 };
  }
  // Estable o creciendo: v26 >= v25 (cubre v25 == v26 o creció)
  if (v26 >= v25 && (v25 > 0 || v26 > 0)) {
    return { status: "estable", declinePct: 0 };
  }
  // Sin venta en ambos años → no incluir
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
  // Buscador: filtra por substring en cliente y/o vendedor (case-insensitive).
  // Vacío = comportamiento default (Top 100 perdidos+declive).
  // Con texto = muestra TODOS los clientes que matchean (incluye estables y
  // nuevos, no solo perdidos/declive).
  const [search, setSearch] = useState("");

  // Toggle Pesos / Kilos (Mejora 2 Commit C). Persistencia localStorage.
  const [metric, setMetric] = useState<PerdidoMetric>("pesos");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PERDIDOS_METRIC_KEY);
      if (saved === "kilos" || saved === "pesos") setMetric(saved);
    } catch {
      // ignore
    }
  }, []);
  const switchMetric = (next: PerdidoMetric) => {
    setMetric(next);
    try {
      window.localStorage.setItem(PERDIDOS_METRIC_KEY, next);
    } catch {
      // ignore
    }
  };

  // Compute TODOS los clientes con status (incluye estables y nuevos).
  //
  // Mejora 2 Commit C: comparativo DÍA-VS-DÍA equitativo.
  //   - Modo Mes: usar acumulado al mismo día laboral (mes_venta_alDia_*)
  //   - Modo YTD: ytd_2025_alDia ≈ ytd_2025_cierre - mes_2025_cierre + mes_2025_alDia
  //     (al ytd cerrado le restamos el mes 2025 cerrado y le sumamos el
  //      mes 2025 al-día — quedamos con Ene-(mismo día actual) de 2025)
  //   - Para 2026: mes_alDia_2026 ≈ mes_2026 (ambos parciales hasta hoy)
  //                ytd_alDia_2026 = ytd_2026 (ya es Ene-hoy)
  const computed: Computed[] = useMemo(() => {
    const out: Computed[] = [];
    for (const r of rows) {
      const mesAlDia25 = r.mes_venta_alDia_2025 ?? 0;
      const mesAlDia26 = r.mes_venta_alDia_2026 ?? r.mes_venta_2026;
      const mesKgAlDia25 = r.mes_kg_alDia_2025 ?? 0;
      const mesKgAlDia26 = r.mes_kg_alDia_2026 ?? r.mes_kg_2026;

      // YTD al-día (ajuste con la fórmula explicada arriba)
      const ytdAlDia25 = Math.max(
        0,
        r.ytd_venta_2025 - r.mes_venta_2025 + mesAlDia25
      );
      const ytdAlDia26 = r.ytd_venta_2026; // ya es Ene-hoy
      const ytdKgAlDia25 = Math.max(
        0,
        r.ytd_kg_2025 - r.mes_kg_2025 + mesKgAlDia25
      );
      const ytdKgAlDia26 = r.ytd_kg_2026;

      const v25 = dim === "mes" ? mesAlDia25 : ytdAlDia25;
      const v26 = dim === "mes" ? mesAlDia26 : ytdAlDia26;
      const k25 = dim === "mes" ? mesKgAlDia25 : ytdKgAlDia25;
      const k26 = dim === "mes" ? mesKgAlDia26 : ytdKgAlDia26;

      // Status calculado en la métrica activa (pesos o kilos)
      const baseRef = metric === "pesos" ? v25 : k25;
      const baseCur = metric === "pesos" ? v26 : k26;
      const { status, declinePct } = computeStatus(baseRef, baseCur);
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
    // Ordenar por la métrica activa (pesos o kilos) para que el "Top" sea coherente
    return out.sort((a, b) =>
      metric === "pesos" ? b.v25 - a.v25 : b.k25 - a.k25
    );
  }, [rows, dim, metric]);

  // Búsqueda activa = al menos 2 caracteres (evita re-renders de cada letra
  // sin propósito y match accidental con strings de 1 char muy comunes).
  const searchActive = search.trim().length >= 2;

  const tableRows = useMemo(() => {
    if (searchActive) {
      // Modo búsqueda: filtrar TODOS los clientes (incluyendo estables y
      // nuevos) por substring match en cliente o vendedor.
      const q = search.trim().toLowerCase();
      return computed.filter(
        (r) =>
          r.cliente.toLowerCase().includes(q) ||
          r.vendedor.toLowerCase().includes(q)
      );
    }
    // Modo default: solo perdidos+declive (sin estables ni nuevos), top 100
    return computed
      .filter((r) => r.status === "perdido" || r.status === "declive")
      .slice(0, topNTable);
  }, [computed, search, searchActive, topNTable]);

  // Stats SIEMPRE basadas en perdidos+declive (no se afectan por el buscador).
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
      {/* Toggles */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <MetricToggle value={metric} onChange={switchMetric} />
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

      {/* Buscador */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border p-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="flex flex-1 items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5"
          style={{
            background: "var(--bg-surface-muted)",
            borderColor: "var(--border)",
            minWidth: 280,
          }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente o vendedor (incluye estables y nuevos)…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {search.length > 0 && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              className="rounded p-0.5 transition-colors hover:bg-[var(--bg-surface)]"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <span
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {searchActive
            ? `${tableRows.length} resultado${tableRows.length === 1 ? "" : "s"} · incluye estables y nuevos`
            : `Top ${Math.min(topNTable, tableRows.length)} perdidos / declive · escribe ≥2 letras para buscar TODOS los clientes`}
        </span>
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
          Sin data para esta dimensión.
        </div>
      ) : tableRows.length === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] border p-12 text-center text-sm"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Sin resultados para <strong>&quot;{search}&quot;</strong>. Verifica
          la ortografía o búscalo por nombre del vendedor.
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
                  {metric === "pesos" ? (
                    <>
                      <Th align="right">{labelPrev} $</Th>
                      <Th align="right">{labelCurr} $</Th>
                      <Th align="right">Var $ %</Th>
                    </>
                  ) : (
                    <>
                      <Th align="right">{labelPrev} kg</Th>
                      <Th align="right">{labelCurr} kg</Th>
                      <Th align="right">Var kg %</Th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  // Var % en la métrica activa
                  const refV = metric === "pesos" ? r.v25 : r.k25;
                  const curV = metric === "pesos" ? r.v26 : r.k26;
                  const varPct =
                    refV > 0 ? ((curV - refV) / refV) * 100 : null;
                  const varColor =
                    varPct == null
                      ? "var(--text-muted)"
                      : varPct <= -100
                        ? "var(--danger)"
                        : varPct < -30
                          ? "var(--danger)"
                          : varPct < 0
                            ? "var(--warning)"
                            : "var(--success)";
                  const fmt = metric === "pesos" ? formatMoney : formatKilos;
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
                      <Td align="right">{fmt(refV)}</Td>
                      <Td align="right">{fmt(curV)}</Td>
                      <Td align="right" bold color={varColor}>
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
function MetricToggle({
  value,
  onChange,
}: {
  value: PerdidoMetric;
  onChange: (v: PerdidoMetric) => void;
}) {
  const opts: Array<{ v: PerdidoMetric; label: string }> = [
    { v: "pesos", label: "Pesos" },
    { v: "kilos", label: "Kilos" },
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
    nuevo: {
      label: "Nuevo",
      bg: "rgba(59, 130, 246, 0.15)",
      color: "#3b82f6",
    },
    estable: {
      label: "Estable",
      bg: "var(--success-soft)",
      color: "var(--success)",
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
