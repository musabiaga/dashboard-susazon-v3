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

import { Fragment, useEffect, useState, useMemo } from "react";
import { Loader2, ChevronRight } from "lucide-react";
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
  /** Nombres de las entidades de la tabla (clientes o SKUs, en orden). */
  clientes: string[];
  context: TableViewsContext;
  mode: "pesos" | "kg";
  dimensionLabel: string;
  /** Dimensión: "cliente" (default) | "sku". */
  dim?: "cliente" | "sku";
}

export function ClientesTableViews({
  view,
  clientes,
  context,
  mode,
  dimensionLabel,
  dim = "cliente",
}: Props) {
  const isKg = mode === "kg";
  const fmt = isKg ? formatKilos : formatMoney;

  // ===== Expand mensual (Feature 1): al picar una fila, cruce por mes de la
  // dimensión opuesta (SKU→clientes / cliente→SKUs). Datos de la función SQL
  // insights_cliente_sku_mensual vía /api/dashboard/cliente-sku-mensual. =====
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [subData, setSubData] = useState<Map<string, EvolutionResponse>>(new Map());
  const [subLoading, setSubLoading] = useState<Set<string>>(new Set());
  const [subError, setSubError] = useState<Map<string, string>>(new Map());

  async function toggleExpand(name: string) {
    if (expandedRows.has(name)) {
      setExpandedRows((p) => {
        const n = new Set(p);
        n.delete(name);
        return n;
      });
      return;
    }
    setExpandedRows((p) => new Set(p).add(name));
    if (subData.has(name) || subLoading.has(name)) return;
    setSubLoading((p) => new Set(p).add(name));
    setSubError((p) => {
      const n = new Map(p);
      n.delete(name);
      return n;
    });
    try {
      const params = new URLSearchParams();
      params.set("year", String(context.year));
      params.set("anchorDim", dim === "sku" ? "sku" : "cliente");
      params.set("anchorValue", name);
      if (context.territorios !== null) {
        params.set("territorios", context.territorios.join(","));
      }
      const r = await fetch(`/api/dashboard/cliente-sku-mensual?${params.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as EvolutionResponse;
      setSubData((p) => new Map(p).set(name, json));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setSubError((p) => new Map(p).set(name, msg));
    } finally {
      setSubLoading((p) => {
        const n = new Set(p);
        n.delete(name);
        return n;
      });
    }
  }

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
    baseParams.set("dim", dim);
    baseParams.set("items", clientes.join(","));
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
  }, [view, context.year, context.month, context.daysCurrent, territoriosKey, clientesKey, dim]);

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
    const nMonths = evolution.meses.length;
    const subEmpty = dim === "sku" ? "Sin clientes." : "Sin productos.";
    const subLoadingLabel = dim === "sku" ? "clientes" : "productos";
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
            {mesesRows.map((r) => {
              const isOpen = expandedRows.has(r.name);
              const sub = subData.get(r.name);
              return (
                <Fragment key={r.name}>
                  <tr
                    className="border-t"
                    style={{ borderColor: "var(--border)", cursor: "pointer" }}
                    onClick={() => toggleExpand(r.name)}
                  >
                    <Td>
                      <span className="inline-flex items-center gap-1">
                        <ChevronRight
                          size={12}
                          style={{
                            transform: isOpen ? "rotate(90deg)" : "none",
                            transition: "transform .15s",
                            color: "var(--text-muted)",
                          }}
                        />
                        {r.name}
                      </span>
                    </Td>
                    {r.cells.map((v, i) => (
                      <Td key={i} align="right">
                        {v > 0 ? fmt(v) : "—"}
                      </Td>
                    ))}
                    <Td align="right" bold>
                      {fmt(r.total)}
                    </Td>
                  </tr>
                  {isOpen &&
                    (subLoading.has(r.name) ? (
                      <tr style={{ background: "var(--bg-surface-muted)" }}>
                        <td colSpan={nMonths + 2} className="px-4 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={13} className="animate-spin" /> Cargando {subLoadingLabel}…
                          </span>
                        </td>
                      </tr>
                    ) : subError.has(r.name) ? (
                      <tr style={{ background: "var(--bg-surface-muted)" }}>
                        <td colSpan={nMonths + 2} className="px-4 py-2 text-xs" style={{ color: "var(--danger)" }}>
                          Error: {subError.get(r.name)}
                        </td>
                      </tr>
                    ) : sub && sub.clientes.length > 0 ? (
                      <>
                        {sub.clientes.map((c) => {
                          const cells = c.monthly.slice(0, nMonths).map((m) => (isKg ? m.kg : m.venta));
                          const total = cells.reduce((a, b) => a + b, 0);
                          const lastIdx = cells.reduce((acc, v, i) => (v > 0 ? i : acc), -1);
                          const stopped = lastIdx >= 0 && lastIdx < nMonths - 1;
                          return (
                            <tr key={c.name} style={{ background: "var(--bg-surface-muted)" }}>
                              <td className="py-1 pl-8 pr-2 text-xs">
                                <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                                {stopped && (
                                  <span className="ml-2 text-[10px] font-medium" style={{ color: "var(--danger)" }}>
                                    · sin comprar desde {evolution.meses[lastIdx + 1]?.label ?? ""}
                                  </span>
                                )}
                              </td>
                              {cells.map((v, i) => (
                                <td
                                  key={i}
                                  className="px-2 py-1 text-right text-xs"
                                  style={
                                    v <= 0
                                      ? { background: "rgba(239,68,68,0.07)", color: "var(--text-muted)" }
                                      : { color: "var(--text-secondary)" }
                                  }
                                >
                                  {v > 0 ? fmt(v) : "—"}
                                </td>
                              ))}
                              <td className="px-2 py-1 text-right text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                {fmt(total)}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    ) : (
                      <tr style={{ background: "var(--bg-surface-muted)" }}>
                        <td colSpan={nMonths + 2} className="px-4 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          {subEmpty}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
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
