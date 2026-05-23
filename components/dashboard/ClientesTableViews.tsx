"use client";

/**
 * ClientesTableViews — vistas alternativas de la tabla inferior del tab
 * Clientes (Mejora 4):
 *   - "meses":  una columna por mes transcurrido del año + Total YTD.
 *   - "prom90": ritmo diario del mes actual vs ritmo de los últimos 90 días
 *               hábiles facturados (detecta quién acelera / desacelera).
 *
 * Carga lazy: cada vista hace su fetch al activarse. Respeta territorios del
 * sidebar (RLS) y el toggle Pesos/Kilos (prop mode).
 */

import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

const MONTH_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

interface MonthlyCell {
  mes: number;
  venta: number;
  kg: number;
  margen: number;
  margen_pct: number;
}
interface ClienteEvolution {
  name: string;
  monthly: MonthlyCell[];
}
interface EvolutionResponse {
  meses: { mes: number; label: string }[];
  clientes: ClienteEvolution[];
}

interface Ritmo90Response {
  clientes: { name: string; venta90d: number; kg90d: number }[];
  bizDays: number;
  fromDate: string;
  toDate: string;
}

export interface TableViewsContext {
  year: number;
  month: number;
  territorios: string[] | null;
  /** Día de corte del mes actual (daysCurrent) — para el al-día del ritmo. */
  daysCurrent: number;
  /** Días hábiles transcurridos del mes (para el ritmo diario actual). */
  elapsedBizDays: number;
  /** Venta/kg del mes actual al-día por cliente (de la tabla), para no re-fetchear. */
  currentByClient: Record<string, { venta: number; kg: number }>;
}

interface Props {
  view: "meses" | "prom90";
  /** Nombres de clientes de la tabla (en orden). */
  clientes: string[];
  context: TableViewsContext;
  mode: "pesos" | "kg";
  dimensionLabel: string;
}

export function ClientesTableViews({
  view,
  clientes,
  context,
  mode,
  dimensionLabel,
}: Props) {
  const isKg = mode === "kg";
  const fmt = isKg ? formatKilos : formatMoney;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evolution, setEvolution] = useState<EvolutionResponse | null>(null);
  const [ritmo, setRitmo] = useState<Ritmo90Response | null>(null);

  const territoriosKey =
    context.territorios === null
      ? "__ALL__"
      : context.territorios.slice().sort().join("|");
  const clientesKey = clientes.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    if (clientes.length === 0) return;
    setLoading(true);
    setError(null);

    const baseParams = new URLSearchParams();
    baseParams.set("year", String(context.year));
    baseParams.set("clientes", clientes.join(","));
    if (context.territorios !== null)
      baseParams.set("territorios", context.territorios.join(","));

    let url: string;
    if (view === "meses") {
      baseParams.set("month", String(context.month));
      url = `/api/dashboard/clientes-evolution?${baseParams.toString()}`;
    } else {
      // prom90
      const yyyy = String(context.year);
      const mm = String(context.month).padStart(2, "0");
      const dd = String(context.daysCurrent).padStart(2, "0");
      baseParams.set("asOf", `${yyyy}-${mm}-${dd}`);
      url = `/api/dashboard/clientes-ritmo-90d?${baseParams.toString()}`;
    }

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        if (view === "meses") setEvolution(json as EvolutionResponse);
        else setRitmo(json as Ritmo90Response);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, context.year, context.month, context.daysCurrent, territoriosKey, clientesKey]);

  // ============ Vista MESES ============
  const mesesRows = useMemo(() => {
    if (view !== "meses" || !evolution) return [];
    return evolution.clientes.map((c) => {
      const cells = c.monthly.map((m) => (isKg ? m.kg : m.venta));
      const total = cells.reduce((a, b) => a + b, 0);
      return { name: c.name, cells, total };
    });
  }, [view, evolution, isKg]);

  const mesesTotals = useMemo(() => {
    if (view !== "meses" || !evolution) return { cells: [], total: 0 };
    const n = evolution.meses.length;
    const cells = new Array(n).fill(0);
    let total = 0;
    for (const r of mesesRows) {
      r.cells.forEach((v, i) => (cells[i] += v));
      total += r.total;
    }
    return { cells, total };
  }, [view, evolution, mesesRows]);

  // ============ Vista PROM 90d ============
  const prom90Rows = useMemo(() => {
    if (view !== "prom90" || !ritmo) return [];
    const v90ByName = new Map(
      ritmo.clientes.map((c) => [c.name, isKg ? c.kg90d : c.venta90d])
    );
    const bizDays90 = ritmo.bizDays || 1;
    const bizDaysMes = context.elapsedBizDays || 1;
    return clientes.map((name) => {
      const total90 = v90ByName.get(name) ?? 0;
      const cur = context.currentByClient[name];
      const curVal = cur ? (isKg ? cur.kg : cur.venta) : 0;
      const ritmo90 = total90 / bizDays90;
      const ritmoMes = curVal / bizDaysMes;
      const deltaPct = ritmo90 > 0 ? ((ritmoMes - ritmo90) / ritmo90) * 100 : 0;
      return { name, ritmo90, ritmoMes, deltaPct };
    });
  }, [view, ritmo, clientes, isKg, context.elapsedBizDays, context.currentByClient]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin" size={24} style={{ color: "var(--accent)" }} />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--danger)" }}>
        Error cargando la vista: {error}
      </p>
    );
  }

  // ===================== Render MESES =====================
  if (view === "meses") {
    if (!evolution || evolution.meses.length === 0) {
      return (
        <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Sin data mensual.
        </p>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr style={{ background: "var(--bg-surface-muted)" }}>
              <Th>{dimensionLabel}</Th>
              {evolution.meses.map((m) => (
                <Th key={m.mes} align="right">
                  {m.label}
                </Th>
              ))}
              <Th align="right">Total YTD</Th>
            </tr>
          </thead>
          <tbody>
            {mesesRows.map((r) => (
              <tr
                key={r.name}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <Td>{r.name}</Td>
                {r.cells.map((v, i) => (
                  <Td key={i} align="right">
                    {v > 0 ? fmt(v) : "—"}
                  </Td>
                ))}
                <Td align="right" bold>
                  {fmt(r.total)}
                </Td>
              </tr>
            ))}
            {/* Fila TOTAL */}
            <tr
              className="border-t-2 font-semibold"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface-muted)",
              }}
            >
              <Td bold>TOTAL</Td>
              {mesesTotals.cells.map((v, i) => (
                <Td key={i} align="right" bold>
                  {fmt(v)}
                </Td>
              ))}
              <Td align="right" bold>
                {fmt(mesesTotals.total)}
              </Td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // ===================== Render PROM 90d =====================
  return (
    <div className="overflow-x-auto">
      <div
        className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-surface-muted)",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>
          ⓘ Ritmo diario: mes en curso vs últimos 90 días hábiles facturados
        </span>
        {ritmo && (
          <span className="ml-2">
            (90d: {ritmo.fromDate} → {ritmo.toDate})
          </span>
        )}
      </div>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr style={{ background: "var(--bg-surface-muted)" }}>
            <Th>{dimensionLabel}</Th>
            <Th align="right">{isKg ? "Kg/día 90d" : "$/día 90d"}</Th>
            <Th align="right">{isKg ? "Kg/día mes" : "$/día mes"}</Th>
            <Th align="right">Δ % ritmo</Th>
          </tr>
        </thead>
        <tbody>
          {prom90Rows.map((r) => {
            const up = r.deltaPct >= 0;
            return (
              <tr
                key={r.name}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <Td>{r.name}</Td>
                <Td align="right">{fmt(r.ritmo90)}</Td>
                <Td align="right">{fmt(r.ritmoMes)}</Td>
                <Td align="right">
                  <span
                    style={{
                      color: up ? "var(--success)" : "var(--danger)",
                      fontWeight: 600,
                    }}
                  >
                    {up ? "▲" : "▼"} {Math.abs(r.deltaPct).toFixed(1)}%
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Helpers de celda (mismo estilo que el resto del dashboard).
function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
      style={{
        color: "var(--text-secondary)",
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  align = "left",
  bold = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  bold?: boolean;
}) {
  return (
    <td
      className="px-3 py-1.5"
      style={{
        color: "var(--text-primary)",
        textAlign: align,
        fontWeight: bold ? 600 : 400,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
