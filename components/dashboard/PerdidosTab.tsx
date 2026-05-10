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
const PERDIDOS_STATUS_FILTER_KEY = "perdidos-status-filter";

const STATUS_CONFIG: Record<
  PerdidoStatus,
  { label: string; bg: string; color: string; bgInactive: string; emoji: string }
> = {
  perdido: {
    label: "Perdido",
    bg: "var(--danger-soft)",
    color: "var(--danger)",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🔴",
  },
  declive: {
    label: "Declive",
    bg: "var(--warning-soft)",
    color: "var(--warning)",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🟠",
  },
  estable: {
    label: "Estable",
    bg: "var(--success-soft)",
    color: "var(--success)",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🟢",
  },
  nuevo: {
    label: "Nuevo",
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🔵",
  },
};

const DEFAULT_STATUS_FILTER: PerdidoStatus[] = ["perdido", "declive"];

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

  // Filtro multi-select por status (Mejora). Default: Perdido + Declive
  // (mantiene comportamiento original del tab). Persiste en localStorage.
  const [activeStatuses, setActiveStatuses] = useState<Set<PerdidoStatus>>(
    () => new Set(DEFAULT_STATUS_FILTER)
  );
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PERDIDOS_STATUS_FILTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((s): s is PerdidoStatus =>
            ["perdido", "declive", "estable", "nuevo"].includes(s as string)
          );
          setActiveStatuses(new Set(valid));
        }
      }
    } catch {
      // ignore
    }
  }, []);
  const toggleStatus = (s: PerdidoStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      try {
        window.localStorage.setItem(
          PERDIDOS_STATUS_FILTER_KEY,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // ignore
      }
      return next;
    });
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
    // Primer filtro: status activos (multi-select). Si NO hay status activos,
    // la tabla queda vacía y mostramos un mensaje claro.
    if (activeStatuses.size === 0) return [];

    const byStatus = computed.filter((r) => activeStatuses.has(r.status));

    if (searchActive) {
      // Modo búsqueda: filtra por substring en cliente/vendedor sobre los
      // status activos. SIN límite Top N.
      const q = search.trim().toLowerCase();
      return byStatus.filter(
        (r) =>
          r.cliente.toLowerCase().includes(q) ||
          r.vendedor.toLowerCase().includes(q)
      );
    }
    // Modo default: status activos + Top N (preservar el comportamiento
    // original cuando solo "perdido + declive" están activos).
    return byStatus.slice(0, topNTable);
  }, [computed, search, searchActive, topNTable, activeStatuses]);

  // Counts por status (para mostrar contador en cada chip).
  // Se calcula sobre `computed` SIN filtro de búsqueda — orientativo.
  const countByStatus = useMemo(() => {
    const c: Record<PerdidoStatus, number> = {
      perdido: 0, declive: 0, estable: 0, nuevo: 0,
    };
    for (const r of computed) c[r.status]++;
    return c;
  }, [computed]);

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

      {/* Buscador + chips de filtro por status */}
      <div
        className="rounded-[var(--radius-lg)] border p-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Fila 1: input + sub-label contador */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              placeholder="Buscar cliente o vendedor…"
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
            {activeStatuses.size === 0
              ? "Selecciona al menos un status para ver clientes"
              : searchActive
                ? `${tableRows.length} resultado${tableRows.length === 1 ? "" : "s"}`
                : `Mostrando ${tableRows.length} de ${computed.filter((r) => activeStatuses.has(r.status)).length}${
                    !searchActive && tableRows.length === topNTable ? ` (Top ${topNTable})` : ""
                  }`}
          </span>
        </div>

        {/* Fila 2: chips de filtro por status */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Status:
          </span>
          {(["perdido", "declive", "estable", "nuevo"] as PerdidoStatus[]).map(
            (s) => {
              const cfg = STATUS_CONFIG[s];
              const active = activeStatuses.has(s);
              const count = countByStatus[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all"
                  style={{
                    background: active ? cfg.bg : cfg.bgInactive,
                    borderColor: active ? cfg.color : "var(--border)",
                    color: active ? cfg.color : "var(--text-muted)",
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  <span>{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                  <span
                    className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.3)"
                        : "transparent",
                      color: active ? cfg.color : "var(--text-muted)",
                    }}
                  >
                    {count.toLocaleString("es-MX")}
                  </span>
                </button>
              );
            }
          )}
        </div>
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
      ) : activeStatuses.size === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] border p-12 text-center text-sm"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Selecciona al menos un{" "}
          <strong style={{ color: "var(--text-primary)" }}>status</strong>{" "}
          arriba para ver clientes.
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
          {searchActive ? (
            <>
              Sin resultados para <strong>&quot;{search}&quot;</strong> con
              los status activos. Prueba activar más status o ajustar la
              búsqueda.
            </>
          ) : (
            <>
              Sin clientes en los status seleccionados para esta dimensión.
            </>
          )}
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
