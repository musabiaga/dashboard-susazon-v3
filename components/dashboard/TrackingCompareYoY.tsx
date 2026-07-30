"use client";

/**
 * TrackingCompareYoY — TABLA comparativa on-demand "vs año anterior (al día)"
 * del tab Tracking Diario. La GRÁFICA vive en el propio tab (se le agregan las
 * barras de 2025); este componente aporta solo la tabla de columnas pareadas.
 *
 * Se renderiza SOLO cuando el toggle está activo. Todo se calcula client-side a
 * partir de la serie diaria que YA viene en el snapshot (kpi.daily) — 0 queries.
 *
 * Muestra el mes COMPLETO con el año anterior como referencia: los días que el
 * año en curso aún no alcanza aparecen con el dato del año anterior y el actual
 * en blanco. La fila TOTAL usa el comparativo AL DÍA (mismo tramo de días
 * hábiles), consistente con los KPI cards del tab.
 */

import { Fragment, useMemo, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";
import type { DailyPoint } from "@/components/dashboard/Sidebar";

const DOW_ES = ["D", "L", "M", "Mi", "J", "V", "S"];

type ViewMode = "pesos" | "kg";

/** Una fila del comparativo de clientes de un día (2026 vs 2025), cruzada por nombre. */
export interface CompareClientRow {
  name: string;
  curV: number;
  prevV: number;
  curK: number;
  prevK: number;
  curM: number;
  prevM: number;
  /** "nuevo" = solo 2026 · "perdido" = solo 2025 · "ambos" = compró en los dos años. */
  status: "nuevo" | "perdido" | "ambos";
}

export interface TrackingCompareYoYProps {
  daily: { current: DailyPoint[]; prevYear: DailyPoint[] };
  mode: ViewMode;
  year: number;
  month: number; // 1-12
  /** Totales AL DÍA (mismo tramo de días hábiles) para la fila TOTAL. */
  alDia: {
    curV: number;
    prevV: number;
    curK: number;
    prevK: number;
    curM: number;
    prevM: number;
  };
  /**
   * Carga el comparativo de clientes de un día (2026 vs 2025, mismo día del mes),
   * ya cruzado por nombre. Lo inyecta el tab (2 fetches a clientes-dia + merge).
   * Si no se pasa, las filas no son expandibles.
   */
  loadDayClients?: (day: number) => Promise<CompareClientRow[]>;
}

/** Δ% con signo. null = no comparable (sin base). */
function pct(cur: number, prev: number): number | null {
  if (prev > 0) return ((cur - prev) / prev) * 100;
  if (cur > 0) return null; // "Nuevo" (sin base año anterior)
  return null;
}

function toneColor(delta: number | null): string {
  if (delta === null) return "var(--text-muted)";
  return delta >= 0 ? "var(--success)" : "var(--danger)";
}

function fmtPct(delta: number | null, cur: number, prev: number): string {
  if (delta === null) {
    if (cur > 0 && prev <= 0) return "Nuevo";
    return "—";
  }
  const s = delta >= 0 ? "+" : "";
  return `${s}${delta.toFixed(1)}%`;
}

/** Δ en puntos porcentuales (para margen %). */
function fmtPP(cur: number, prev: number, hasCur: boolean, hasPrev: boolean): string {
  if (!hasCur || !hasPrev) return "—";
  const d = cur - prev;
  const s = d >= 0 ? "+" : "";
  return `${s}${d.toFixed(1)} pp`;
}

export function TrackingCompareYoY({
  daily,
  mode,
  year,
  month,
  alDia,
  loadDayClients,
}: TrackingCompareYoYProps) {
  const isKg = mode === "kg";
  const prevYY = `'${String((year - 1) % 100).padStart(2, "0")}`;
  const curYY = `'${String(year % 100).padStart(2, "0")}`;
  const expandable = typeof loadDayClients === "function";

  // ---- Expandible: clientes del día 2026 vs 2025 (cruce por nombre) ----
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [clientCache, setClientCache] = useState<Map<number, CompareClientRow[]>>(new Map());
  const [loadingDays, setLoadingDays] = useState<Set<number>>(new Set());
  const [errorDays, setErrorDays] = useState<Map<number, string>>(new Map());

  async function toggleDay(day: number) {
    if (!loadDayClients) return;
    if (expandedDays.has(day)) {
      setExpandedDays((p) => {
        const n = new Set(p);
        n.delete(day);
        return n;
      });
      return;
    }
    setExpandedDays((p) => new Set(p).add(day));
    if (clientCache.has(day) || loadingDays.has(day)) return;
    setLoadingDays((p) => new Set(p).add(day));
    setErrorDays((p) => {
      const n = new Map(p);
      n.delete(day);
      return n;
    });
    try {
      const data = await loadDayClients(day);
      setClientCache((p) => new Map(p).set(day, data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setErrorDays((p) => new Map(p).set(day, msg));
    } finally {
      setLoadingDays((p) => {
        const n = new Set(p);
        n.delete(day);
        return n;
      });
    }
  }

  // ---- Filas por día (unión de días de ambos años = mes completo) ----
  const rows = useMemo(() => {
    const curByDay = new Map(daily.current.map((p) => [p.d, p]));
    const prevByDay = new Map(daily.prevYear.map((p) => [p.d, p]));
    const allDays = Array.from(
      new Set([...curByDay.keys(), ...prevByDay.keys()])
    ).sort((a, b) => a - b);

    let cumCurV = 0,
      cumPrevV = 0,
      cumCurK = 0,
      cumPrevK = 0;

    return allDays.map((d) => {
      const c = curByDay.get(d);
      const p = prevByDay.get(d);
      const cv = c?.v ?? 0;
      const pv = p?.v ?? 0;
      const ck = c?.k ?? 0;
      const pk = p?.k ?? 0;
      const cm = c?.m ?? 0;
      const pm = p?.m ?? 0;
      cumCurV += cv;
      cumPrevV += pv;
      cumCurK += ck;
      cumPrevK += pk;
      const date = new Date(year, month - 1, d);
      return {
        d,
        dow: DOW_ES[date.getDay()],
        hasCur: !!c,
        hasPrev: !!p,
        // diarios
        cv,
        pv,
        ck,
        pk,
        cm,
        pm,
        curMPct: cv > 0 ? (cm / cv) * 100 : 0,
        prevMPct: pv > 0 ? (pm / pv) * 100 : 0,
        // acumulados
        cumCurV,
        cumPrevV,
        cumCurK,
        cumPrevK,
      };
    });
  }, [daily, year, month]);

  const unitFmt = isKg ? formatKilos : formatMoney;
  const metricLabel = isKg ? "KG" : "Venta";

  // ---- Totales al día (fila TOTAL) ----
  const totCur = isKg ? alDia.curK : alDia.curV;
  const totPrev = isKg ? alDia.prevK : alDia.prevV;
  const totDelta = pct(totCur, totPrev);
  const totMCur = alDia.curM;
  const totMPrev = alDia.prevM;
  const totMDelta = pct(totMCur, totMPrev);
  const totMPctCur = alDia.curV > 0 ? (alDia.curM / alDia.curV) * 100 : 0;
  const totMPctPrev = alDia.prevV > 0 ? (alDia.prevM / alDia.prevV) * 100 : 0;

  if (rows.length === 0) {
    return (
      <p
        className="py-12 text-center text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Sin data del mes para comparar.
      </p>
    );
  }

  const num = (v: number, has = true) =>
    has ? unitFmt(v) : <span style={{ color: "var(--text-muted)" }}>—</span>;

  // Columnas totales de la tabla (para el colSpan de la fila expandida).
  const totalCols = isKg ? 11 : 14;

  // Render del comparativo de clientes de un día (estados: cargando / error / datos).
  function renderClientes(day: number) {
    if (loadingDays.has(day)) {
      return (
        <div className="flex items-center gap-2 px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Cargando clientes del día {day}…
        </div>
      );
    }
    if (errorDays.has(day)) {
      return (
        <div className="px-4 py-3 text-xs" style={{ color: "var(--danger)" }}>
          Error: {errorDays.get(day)}
        </div>
      );
    }
    const data = clientCache.get(day);
    if (!data) return null;
    if (data.length === 0) {
      return (
        <div className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
          Sin clientes facturados el día {day} (en ninguno de los dos años).
        </div>
      );
    }
    // Orden: primero por venta actual desc, luego perdidos.
    const sorted = [...data].sort((a, b) => (isKg ? b.curK - a.curK : b.curV - a.curV) || b.prevV - a.prevV);
    const badge = (status: CompareClientRow["status"]) => {
      if (status === "nuevo")
        return <span style={{ color: "var(--success)", fontWeight: 600 }}>🟢 Nuevo</span>;
      if (status === "perdido")
        return <span style={{ color: "var(--danger)", fontWeight: 600 }}>🔴 Perdido</span>;
      return null;
    };
    return (
      <div className="px-3 py-2">
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr style={{ color: "var(--text-secondary)" }}>
              <th className="px-2 py-1 text-left font-medium">Cliente ({day})</th>
              <th className="px-2 py-1 text-right font-medium">{metricLabel} {curYY}</th>
              <th className="px-2 py-1 text-right font-medium">{metricLabel} {prevYY}</th>
              <th className="px-2 py-1 text-right font-medium">Δ%</th>
              {!isKg && (
                <>
                  <th className="px-2 py-1 text-right font-medium">Margen $ {curYY}</th>
                  <th className="px-2 py-1 text-right font-medium">Margen $ {prevYY}</th>
                </>
              )}
              <th className="px-2 py-1 text-right font-medium">Margen % {curYY}</th>
              <th className="px-2 py-1 text-right font-medium">Margen % {prevYY}</th>
              <th className="px-2 py-1 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => {
              const cv = isKg ? c.curK : c.curV;
              const pv = isKg ? c.prevK : c.prevV;
              const dv = pct(cv, pv);
              const hasCur = c.status !== "perdido";
              const hasPrev = c.status !== "nuevo";
              const cMPct = c.curV > 0 ? (c.curM / c.curV) * 100 : 0;
              const pMPct = c.prevV > 0 ? (c.prevM / c.prevV) * 100 : 0;
              return (
                <tr key={`${c.name}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-2 py-1 text-left">{c.name}</td>
                  <td className="px-2 py-1 text-right">{hasCur ? unitFmt(cv) : <span style={{ color: "var(--text-muted)" }}>$0</span>}</td>
                  <td className="px-2 py-1 text-right" style={{ color: "var(--text-secondary)" }}>{hasPrev ? unitFmt(pv) : <span style={{ color: "var(--text-muted)" }}>$0</span>}</td>
                  <td className="px-2 py-1 text-right font-medium" style={{ color: toneColor(dv) }}>{fmtPct(dv, cv, pv)}</td>
                  {!isKg && (
                    <>
                      <td className="px-2 py-1 text-right">{hasCur ? formatMoney(c.curM) : <span style={{ color: "var(--text-muted)" }}>$0</span>}</td>
                      <td className="px-2 py-1 text-right" style={{ color: "var(--text-secondary)" }}>{hasPrev ? formatMoney(c.prevM) : <span style={{ color: "var(--text-muted)" }}>$0</span>}</td>
                    </>
                  )}
                  <td className="px-2 py-1 text-right">{hasCur ? `${cMPct.toFixed(1)}%` : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="px-2 py-1 text-right" style={{ color: "var(--text-secondary)" }}>{hasPrev ? `${pMPct.toFixed(1)}%` : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="px-2 py-1 text-center">{badge(c.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ============ Tabla comparativa (columnas pareadas) ============ */}
      <div
        className="overflow-x-auto rounded-[var(--radius-lg)] border"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <table className="w-full text-xs tabular-nums" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ background: "var(--bg-surface-muted)" }}>
              <th rowSpan={2} className="px-2 py-2 text-center font-semibold">Día</th>
              <th rowSpan={2} className="px-2 py-2 text-center font-semibold">Sem</th>
              <th colSpan={3} className="px-2 py-1.5 text-center font-semibold" style={{ borderLeft: "1px solid var(--border)" }}>{metricLabel} del día</th>
              <th colSpan={3} className="px-2 py-1.5 text-center font-semibold" style={{ borderLeft: "1px solid var(--border)" }}>{metricLabel} acumulada</th>
              {!isKg && (
                <th colSpan={3} className="px-2 py-1.5 text-center font-semibold" style={{ borderLeft: "1px solid var(--border)" }}>Margen $ del día</th>
              )}
              <th colSpan={3} className="px-2 py-1.5 text-center font-semibold" style={{ borderLeft: "1px solid var(--border)" }}>Margen % del día</th>
            </tr>
            <tr
              style={{ background: "var(--bg-surface-muted)", color: "var(--text-secondary)" }}
            >
              {/* del día */}
              <th className="px-2 py-1 text-right font-medium" style={{ borderLeft: "1px solid var(--border)" }}>{curYY}</th>
              <th className="px-2 py-1 text-right font-medium">{prevYY}</th>
              <th className="px-2 py-1 text-right font-medium">Δ%</th>
              {/* acumulada */}
              <th className="px-2 py-1 text-right font-medium" style={{ borderLeft: "1px solid var(--border)" }}>{curYY}</th>
              <th className="px-2 py-1 text-right font-medium">{prevYY}</th>
              <th className="px-2 py-1 text-right font-medium">Δ%</th>
              {/* margen $ */}
              {!isKg && (
                <>
                  <th className="px-2 py-1 text-right font-medium" style={{ borderLeft: "1px solid var(--border)" }}>{curYY}</th>
                  <th className="px-2 py-1 text-right font-medium">{prevYY}</th>
                  <th className="px-2 py-1 text-right font-medium">Δ%</th>
                </>
              )}
              {/* margen % */}
              <th className="px-2 py-1 text-right font-medium" style={{ borderLeft: "1px solid var(--border)" }}>{curYY}</th>
              <th className="px-2 py-1 text-right font-medium">{prevYY}</th>
              <th className="px-2 py-1 text-right font-medium">Δpp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const curD = isKg ? r.ck : r.cv;
              const prevD = isKg ? r.pk : r.pv;
              const dD = pct(curD, prevD);
              const curA = isKg ? r.cumCurK : r.cumCurV;
              const prevA = isKg ? r.cumPrevK : r.cumPrevV;
              const dA = pct(curA, prevA);
              const dM = pct(r.cm, r.pm);
              const isOpen = expandedDays.has(r.d);
              return (
                <Fragment key={r.d}>
                <tr
                  onClick={expandable ? () => toggleDay(r.d) : undefined}
                  style={{
                    borderTop: "1px solid var(--border)",
                    opacity: r.hasCur ? 1 : 0.6,
                    cursor: expandable ? "pointer" : "default",
                  }}
                >
                  <td className="px-2 py-1.5 text-center font-medium">
                    <span className="inline-flex items-center gap-1">
                      {expandable && (
                        <ChevronRight
                          size={12}
                          style={{
                            transform: isOpen ? "rotate(90deg)" : "none",
                            transition: "transform .15s",
                            color: "var(--text-muted)",
                          }}
                        />
                      )}
                      {r.d}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center" style={{ color: "var(--text-muted)" }}>{r.dow}</td>
                  {/* del día */}
                  <td className="px-2 py-1.5 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{num(curD, r.hasCur)}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{num(prevD, r.hasPrev)}</td>
                  <td className="px-2 py-1.5 text-right font-medium" style={{ color: toneColor(dD) }}>{fmtPct(dD, curD, prevD)}</td>
                  {/* acumulada */}
                  <td className="px-2 py-1.5 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{num(curA, r.hasCur)}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{num(prevA, r.hasPrev)}</td>
                  <td className="px-2 py-1.5 text-right font-medium" style={{ color: toneColor(dA) }}>{fmtPct(dA, curA, prevA)}</td>
                  {/* margen $ */}
                  {!isKg && (
                    <>
                      <td className="px-2 py-1.5 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{r.hasCur ? formatMoney(r.cm) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                      <td className="px-2 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{r.hasPrev ? formatMoney(r.pm) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                      <td className="px-2 py-1.5 text-right font-medium" style={{ color: toneColor(dM) }}>{fmtPct(dM, r.cm, r.pm)}</td>
                    </>
                  )}
                  {/* margen % */}
                  <td className="px-2 py-1.5 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{r.hasCur ? `${r.curMPct.toFixed(1)}%` : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{r.hasPrev ? `${r.prevMPct.toFixed(1)}%` : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="px-2 py-1.5 text-right font-medium" style={{ color: r.hasCur && r.hasPrev ? toneColor(r.curMPct - r.prevMPct) : "var(--text-muted)" }}>{fmtPP(r.curMPct, r.prevMPct, r.hasCur, r.hasPrev)}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={totalCols} style={{ padding: 0, background: "var(--bg-surface-muted)" }}>
                      {renderClientes(r.d)}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {/* ---- Fila TOTAL (al día) ---- */}
            <tr
              style={{
                borderTop: "2px solid var(--border-strong)",
                background: "var(--bg-surface-muted)",
                fontWeight: 600,
              }}
            >
              <td className="px-2 py-2 text-center" colSpan={2}>TOTAL al día</td>
              {/* del día → mostramos el acumulado al día en ambas columnas de "del día" no aplica; dejamos el total al-día */}
              <td className="px-2 py-2 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{unitFmt(totCur)}</td>
              <td className="px-2 py-2 text-right" style={{ color: "var(--text-secondary)" }}>{unitFmt(totPrev)}</td>
              <td className="px-2 py-2 text-right" style={{ color: toneColor(totDelta) }}>{fmtPct(totDelta, totCur, totPrev)}</td>
              {/* acumulada = mismo total al día */}
              <td className="px-2 py-2 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{unitFmt(totCur)}</td>
              <td className="px-2 py-2 text-right" style={{ color: "var(--text-secondary)" }}>{unitFmt(totPrev)}</td>
              <td className="px-2 py-2 text-right" style={{ color: toneColor(totDelta) }}>{fmtPct(totDelta, totCur, totPrev)}</td>
              {/* margen $ */}
              {!isKg && (
                <>
                  <td className="px-2 py-2 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{formatMoney(totMCur)}</td>
                  <td className="px-2 py-2 text-right" style={{ color: "var(--text-secondary)" }}>{formatMoney(totMPrev)}</td>
                  <td className="px-2 py-2 text-right" style={{ color: toneColor(totMDelta) }}>{fmtPct(totMDelta, totMCur, totMPrev)}</td>
                </>
              )}
              {/* margen % */}
              <td className="px-2 py-2 text-right" style={{ borderLeft: "1px solid var(--border)" }}>{`${totMPctCur.toFixed(1)}%`}</td>
              <td className="px-2 py-2 text-right" style={{ color: "var(--text-secondary)" }}>{`${totMPctPrev.toFixed(1)}%`}</td>
              <td className="px-2 py-2 text-right" style={{ color: toneColor(totMPctCur - totMPctPrev) }}>{fmtPP(totMPctCur, totMPctPrev, true, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
