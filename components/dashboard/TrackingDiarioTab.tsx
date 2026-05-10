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
import { countBizDays, isBusinessDay } from "@/lib/business-days";
import type { TerritoryKpi } from "@/components/dashboard/Sidebar";
import { ChartLegend } from "@/components/dashboard/ChartLegend";

type ViewMode = "pesos" | "kg";
const VIEW_MODE_KEY = "tracking-diario-mode";

const DOW_ES = ["D", "L", "M", "Mi", "J", "V", "S"];
const MONTH_SHORT_LOWER = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

interface Props {
  kpi: TerritoryKpi;
  ventaBudget: number;
  currentYear: number;
  currentMonth: number; // 1-12
  monthShortYY: string;
  prevMonthShortYY: string;
  elapsedBizDays: number;
  totalBizDays: number;
}

export function TrackingDiarioTab({
  kpi,
  ventaBudget,
  currentYear,
  currentMonth,
  monthShortYY,
  prevMonthShortYY,
  elapsedBizDays,
  totalBizDays,
}: Props) {
  // ============ Toggle de vista: Pesos vs Kilos ============
  // Persiste en localStorage. Default = "pesos".
  const [mode, setMode] = useState<ViewMode>("pesos");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "kg" || saved === "pesos") setMode(saved);
    } catch {
      // ignore
    }
  }, []);
  const switchMode = (next: ViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // ignore
    }
  };
  const isKg = mode === "kg";

  // ============ Cálculos KPI vista PESOS (verbatim del V2.2) ============
  const acum = kpi.venta;
  const marginMoney = kpi.margen;
  const marginPct = kpi.marginPct;
  const prevYearVenta = kpi.prevYear.venta;
  const ptto = ventaBudget;
  const remainingBizDays = Math.max(0, totalBizDays - elapsedBizDays);

  const velOrig = totalBizDays > 0 ? ptto / totalBizDays : 0;
  const velActual = elapsedBizDays > 0 ? acum / elapsedBizDays : 0;
  const velNeces =
    remainingBizDays > 0 ? Math.max(0, (ptto - acum) / remainingBizDays) : 0;
  const runRate = velActual * totalBizDays;
  const runRatePct = ptto > 0 ? (runRate / ptto) * 100 : 0;
  const alcancePct = ptto > 0 ? (acum / ptto) * 100 : 0;
  const faltante = Math.max(0, ptto - acum);
  const yoyCh =
    prevYearVenta > 0 ? ((acum - prevYearVenta) / prevYearVenta) * 100 : 0;
  const tiempoPct =
    totalBizDays > 0 ? (elapsedBizDays / totalBizDays) * 100 : 0;
  const brechaPp = alcancePct - tiempoPct;

  // ============ Cálculos KPI vista KILOS ============
  // No hay kgBudget en el sistema — todas las métricas se construyen
  // a partir de los datos diarios (kpi.daily.current[].k para 2026 y
  // kpi.daily.prevYear[].k para 2025).
  const acumKg = kpi.daily.current.reduce((s, p) => s + p.k, 0);
  const prevYearKg = kpi.daily.prevYear.reduce((s, p) => s + p.k, 0);
  const yoyKgDelta = acumKg - prevYearKg; // diferencia absoluta KG
  const yoyKgPct =
    prevYearKg > 0 ? ((acumKg - prevYearKg) / prevYearKg) * 100 : 0;
  // Pace 2025 = KG/día promedio que tuvo 2025 al cierre del mes (todos los
  // días hábiles del mes). Si no hay data 2025, queda en 0.
  const pace2025 = totalBizDays > 0 ? prevYearKg / totalBizDays : 0;
  const velActualKg = elapsedBizDays > 0 ? acumKg / elapsedBizDays : 0;
  // Estados claros para "comparar vs cierre 2025":
  //   - ySuperaste: ya rebasamos el cierre 2025 (incluso si quedan días)
  //   - mesCerradoSinSuperar: ya no quedan días Y no rebasamos 2025 (= NO se logró)
  //   - quedanDiasParaIgualar: aún se puede pelear, requiere X kg/día
  const ySuperaste = prevYearKg > 0 && acumKg >= prevYearKg;
  const kgGapAbs = Math.max(0, prevYearKg - acumKg); // KG faltantes en absoluto
  const mesCerradoSinSuperar =
    prevYearKg > 0 && remainingBizDays === 0 && !ySuperaste;
  // Solo tiene sentido si quedan días Y no superaste todavía
  const faltaIgualarKg =
    remainingBizDays > 0 && !ySuperaste
      ? kgGapAbs / remainingBizDays
      : 0;
  const runRateKg = velActualKg * totalBizDays;
  // % de cierre 2025: para la progress bar en vista KG.
  const pctVs2025 = prevYearKg > 0 ? (acumKg / prevYearKg) * 100 : 0;

  // Días hábiles con factura (venta > 0)
  const daysWithInvoice = kpi.daily.current.filter((p) =>
    isBusinessDay(new Date(currentYear, currentMonth - 1, p.d))
  ).length;

  // ============ Chart data ============
  // Genera 1 row por día con TODAS las series (pesos + kilos).
  // Render condicional decide cuáles se grafican según `mode`.
  const chartData = useMemo(() => {
    const allDays = new Set<number>();
    for (const p of kpi.daily.current) allDays.add(p.d);
    for (const p of kpi.daily.prevYear) allDays.add(p.d);
    const sorted = Array.from(allDays).sort((a, b) => a - b);

    const currentByDayV = new Map(kpi.daily.current.map((p) => [p.d, p.v]));
    const prevByDayV = new Map(kpi.daily.prevYear.map((p) => [p.d, p.v]));
    const currentByDayK = new Map(kpi.daily.current.map((p) => [p.d, p.k]));
    const prevByDayK = new Map(kpi.daily.prevYear.map((p) => [p.d, p.k]));

    let cumCV = 0;
    let cumPV = 0;
    let cumCK = 0;
    let cumPK = 0;
    return sorted.map((d) => {
      cumCV += currentByDayV.get(d) ?? 0;
      cumPV += prevByDayV.get(d) ?? 0;
      cumCK += currentByDayK.get(d) ?? 0;
      cumPK += prevByDayK.get(d) ?? 0;
      const bizElapsedHere = countBizDays(currentYear, currentMonth, d);
      const pttoLinearHere =
        totalBizDays > 0 ? ptto * (bizElapsedHere / totalBizDays) : 0;
      // Pace 2025 al día d = (kg promedio diario 2025) * días hábiles transcurridos
      const pace2025Here = pace2025 * bizElapsedHere;
      return {
        day: d,
        // Pesos
        ventaDiaria: currentByDayV.get(d) ?? 0,
        acumulado: cumCV,
        pttoLinear: pttoLinearHere,
        anoAnterior: cumPV,
        // Kilos
        kgDiaria: currentByDayK.get(d) ?? 0,
        acumKg: cumCK,
        acumKgPrev: cumPK,
        paceKg: pace2025Here,
      };
    });
  }, [kpi.daily, currentYear, currentMonth, totalBizDays, ptto, pace2025]);

  // ============ Tabla diaria ============
  // Cada row tiene tanto datos pesos como datos KG. Render condicional decide
  // qué columnas mostrar. Para vista KG necesitamos también el acumulado del
  // mismo día año anterior, así que precalculamos un map por día.
  const tableRows = useMemo(() => {
    const sorted = [...kpi.daily.current].sort((a, b) => a.d - b.d);
    // Acumulado KG del año anterior por día (para "Acum 2025" en vista KG)
    const prevSortedK = [...kpi.daily.prevYear].sort((a, b) => a.d - b.d);
    const prevAcumKgByDay = new Map<number, number>();
    let cumPK = 0;
    for (const p of prevSortedK) {
      cumPK += p.k;
      prevAcumKgByDay.set(p.d, cumPK);
    }
    // KG/día de 2025 por día (KG diaria del año anterior)
    const prevDailyKgByDay = new Map(prevSortedK.map((p) => [p.d, p.k]));

    let cumV = 0;
    let cumK = 0;
    return sorted.map((p) => {
      cumV += p.v;
      cumK += p.k;
      const date = new Date(currentYear, currentMonth - 1, p.d);
      const bizElapsedHere = countBizDays(currentYear, currentMonth, p.d);
      const remainingBizHere = Math.max(0, totalBizDays - bizElapsedHere);
      const velNecesHere =
        remainingBizHere > 0
          ? Math.max(0, (ptto - cumV) / remainingBizHere)
          : 0;
      const pctPtto = ptto > 0 ? (cumV / ptto) * 100 : 0;
      const marginPctRow = p.v > 0 ? (p.m / p.v) * 100 : 0;
      const velNecesTone: "success" | "warning" | "danger" =
        velNecesHere <= velOrig
          ? "success"
          : velNecesHere <= velOrig * 1.2
            ? "warning"
            : "danger";
      // KG: comparativos vs 2025 mismo día
      const acumKgPrevHere = prevAcumKgByDay.get(p.d) ?? 0;
      const diffKg = cumK - acumKgPrevHere;
      const pctVs2025Row =
        acumKgPrevHere > 0
          ? ((cumK - acumKgPrevHere) / acumKgPrevHere) * 100
          : 0;
      const kgPrevDaily = prevDailyKgByDay.get(p.d) ?? 0;
      return {
        d: p.d,
        date,
        dow: DOW_ES[date.getDay()],
        venta: p.v,
        acum: cumV,
        pctPtto,
        velNeces: velNecesHere,
        velNecesTone,
        margen: p.m,
        marginPct: marginPctRow,
        kg: p.k,
        // Datos KG para vista kilos
        acumKg: cumK,
        acumKgPrev: acumKgPrevHere,
        diffKg,
        pctVs2025: pctVs2025Row,
        kgPrevDaily,
      };
    });
  }, [kpi.daily, currentYear, currentMonth, totalBizDays, ptto, velOrig]);

  // Totales para el row TOTAL al final de la tabla.
  const tableTotals = useMemo(() => {
    if (tableRows.length === 0) return null;
    const ventaTot = acum;
    const margenTot = marginMoney;
    const marginPctTot = marginPct;
    const kgTot = acumKg;
    const kgPrevTot = prevYearKg;
    const diffKgTot = yoyKgDelta;
    const pctVs2025Tot = yoyKgPct;
    return {
      ventaTot,
      margenTot,
      marginPctTot,
      kgTot,
      kgPrevTot,
      diffKgTot,
      pctVs2025Tot,
    };
  }, [
    tableRows.length,
    acum,
    marginMoney,
    marginPct,
    acumKg,
    prevYearKg,
    yoyKgDelta,
    yoyKgPct,
  ]);

  // ============ Render ============
  const hasPtto = ptto > 0;
  const hasPrev = prevYearVenta > 0;
  const velActualTone =
    elapsedBizDays > 0 && velActual >= velOrig
      ? "var(--success)"
      : "var(--danger)";
  const velNecesTone =
    velNeces <= velOrig
      ? "var(--success)"
      : velNeces <= velOrig * 1.2
        ? "var(--warning)"
        : "var(--danger)";
  const progressTone =
    brechaPp >= 0
      ? "var(--success)"
      : brechaPp >= -5
        ? "var(--warning)"
        : "var(--danger)";
  const brechaLabel = brechaPp >= 0 ? "AVANZADO" : "REZAGADO";

  // ============ Variables auxiliares de presentación KG ============
  const kgSign = yoyKgPct >= 0 ? "+" : "";
  const kgSignDelta = yoyKgDelta >= 0 ? "+" : "";
  const kgArrow = yoyKgPct >= 0 ? "▲" : "▼";

  return (
    <div className="space-y-4">
      {/* ============ Toggle Pesos / Kilos ============ */}
      <div className="flex items-center justify-end">
        <ModeToggle mode={mode} onChange={switchMode} />
      </div>

      {/* ============ 8 stats grid ============ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!isKg ? (
          <>
            <Stat
              label="Venta del Mes"
              value={formatMoney(acum)}
              sub={`Día ${elapsedBizDays} de ${totalBizDays} · ${daysWithInvoice} con factura`}
            />
            <Stat
              label="Alcance Ptto"
              value={hasPtto ? `${alcancePct.toFixed(1)}%` : "—"}
              sub={hasPtto ? `${formatMoney(faltante)} faltante` : "Sin PTTO"}
            />
            <Stat
              label="Margen $"
              value={formatMoney(marginMoney)}
              subInline={`${marginPct.toFixed(1)}%`}
            />
            <Stat
              label="vs Mismo Mes Año Ant."
              value={
                hasPrev
                  ? `${yoyCh >= 0 ? "+" : ""}${yoyCh.toFixed(1)}%`
                  : "—"
              }
              valueTone={
                hasPrev ? (yoyCh >= 0 ? "success" : "danger") : "neutral"
              }
              sub={
                hasPrev ? `vs ${formatMoney(prevYearVenta)}` : "Sin data año ant."
              }
            />
            <Stat
              label="Vel. Original"
              value={hasPtto ? formatMoney(velOrig) : "—"}
              sub="meta/día"
            />
            <Stat
              label="Vel. Actual"
              value={formatMoney(velActual)}
              valueTone={
                hasPtto
                  ? velActual >= velOrig
                    ? "success"
                    : "danger"
                  : "neutral"
              }
              sub="meta/día"
            />
            <Stat
              label="Vel. Necesaria"
              value={hasPtto ? formatMoney(velNeces) : "—"}
              valueTone={
                hasPtto
                  ? velNeces <= velOrig
                    ? "success"
                    : velNeces <= velOrig * 1.2
                      ? "warning"
                      : "danger"
                  : "neutral"
              }
              sub="meta/día"
            />
            <Stat
              label="Run Rate"
              value={formatMoney(runRate)}
              sub={hasPtto ? `${runRatePct.toFixed(0)}% del ptto` : "Sin PTTO"}
            />
          </>
        ) : (
          <>
            <Stat
              label="KG del Mes"
              value={formatKilos(acumKg)}
              sub={`Día ${elapsedBizDays} de ${totalBizDays} · ${daysWithInvoice} con factura`}
            />
            <Stat
              label="vs 2025"
              value={
                hasPrev
                  ? `${kgArrow} ${Math.abs(yoyKgPct).toFixed(1)}%`
                  : "—"
              }
              valueTone={hasPrev ? (yoyKgPct >= 0 ? "success" : "danger") : "neutral"}
              subInline={
                hasPrev
                  ? `${kgSignDelta}${formatKilos(yoyKgDelta)}`
                  : "Sin data año ant."
              }
            />
            <Stat
              label="Margen $"
              value={formatMoney(marginMoney)}
              subInline={`${marginPct.toFixed(1)}%`}
            />
            <Stat
              label="vs Mismo Mes Año Ant."
              value={
                hasPrev
                  ? `${kgSign}${yoyKgPct.toFixed(1)}%`
                  : "—"
              }
              valueTone={hasPrev ? (yoyKgPct >= 0 ? "success" : "danger") : "neutral"}
              sub={
                hasPrev
                  ? `vs ${formatKilos(prevYearKg)}`
                  : "Sin data año ant."
              }
            />
            <Stat
              label="Pace 2025"
              value={hasPrev ? formatKilos(pace2025) : "—"}
              sub="kg/día"
            />
            <Stat
              label="Vel. Actual"
              value={formatKilos(velActualKg)}
              valueTone={
                hasPrev
                  ? velActualKg >= pace2025
                    ? "success"
                    : "danger"
                  : "neutral"
              }
              sub="kg/día"
            />
            <Stat
              label="Falta para igualar 2025"
              value={
                !hasPrev
                  ? "—"
                  : ySuperaste
                    ? "✓ Ya superaste"
                    : mesCerradoSinSuperar
                      ? "✗ No alcanzado"
                      : formatKilos(faltaIgualarKg)
              }
              valueTone={
                !hasPrev
                  ? "neutral"
                  : ySuperaste
                    ? "success"
                    : mesCerradoSinSuperar
                      ? "danger"
                      : faltaIgualarKg <= pace2025
                        ? "warning"
                        : "danger"
              }
              sub={
                !hasPrev
                  ? "Sin data año ant."
                  : mesCerradoSinSuperar
                    ? `-${formatKilos(kgGapAbs)} vs 2025`
                    : "kg/día"
              }
            />
            <Stat
              label="Run Rate KG"
              value={formatKilos(runRateKg)}
              sub={
                hasPrev
                  ? `${pctVs2025.toFixed(0)}% de 2025 (proy.)`
                  : "Sin data año ant."
              }
            />
          </>
        )}
      </div>

      {/* ============ Progress bar (Pesos: vs PTTO | Kilos: vs cierre 2025) ============ */}
      {!isKg && hasPtto && (
        <div
          className="rounded-[var(--radius-lg)] border p-4"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="relative h-9 w-full overflow-hidden rounded-[var(--radius)]"
            style={{ background: "var(--bg-surface-muted)" }}
          >
            {/* Filled */}
            <div
              className="flex h-full items-center justify-center text-xs font-semibold text-white transition-all"
              style={{
                width: `${Math.min(100, alcancePct)}%`,
                background: progressTone,
              }}
            >
              {alcancePct >= 8 && (
                <span>
                  {formatMoney(acum)} ({alcancePct.toFixed(0)}%)
                </span>
              )}
            </div>
            {/* Total label on right */}
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {formatMoney(ptto)}
            </span>
            {/* Día marker */}
            {tiempoPct > 0 && tiempoPct < 100 && (
              <div
                className="absolute top-0 h-full border-l-2 border-dashed"
                style={{
                  left: `${tiempoPct}%`,
                  borderColor: "var(--text-primary)",
                }}
              >
                <span
                  className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: "var(--text-primary)" }}
                >
                  Día {elapsedBizDays}/{totalBizDays}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span
              className="font-semibold"
              style={{ color: progressTone }}
            >
              {brechaLabel} {brechaPp >= 0 ? "+" : ""}
              {brechaPp.toFixed(0)}pp
              <span
                className="ml-2 font-normal"
                style={{ color: "var(--text-secondary)" }}
              >
                — Venta: {alcancePct.toFixed(0)}% · Tiempo: {tiempoPct.toFixed(0)}%
              </span>
            </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {remainingBizDays} día(s) restante(s) · Necesario:{" "}
              <strong style={{ color: velNecesTone }}>
                {formatMoney(velNeces)}/día
              </strong>
            </span>
          </div>
        </div>
      )}

      {isKg && hasPrev && (() => {
        // Vista KG: progress vs cierre 2025. Verde si voy a superar el cierre,
        // rojo/naranja si voy abajo del pace.
        const kgGap = pctVs2025 - tiempoPct;
        const kgTone =
          kgGap >= 0
            ? "var(--success)"
            : kgGap >= -5
              ? "var(--warning)"
              : "var(--danger)";
        const kgLabel = kgGap >= 0 ? "AVANZADO" : "REZAGADO";
        return (
          <div
            className="rounded-[var(--radius-lg)] border p-4"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="relative h-9 w-full overflow-hidden rounded-[var(--radius)]"
              style={{ background: "var(--bg-surface-muted)" }}
            >
              <div
                className="flex h-full items-center justify-center text-xs font-semibold text-white transition-all"
                style={{
                  width: `${Math.min(100, pctVs2025)}%`,
                  background: kgTone,
                }}
              >
                {pctVs2025 >= 8 && (
                  <span>
                    {formatKilos(acumKg)} ({pctVs2025.toFixed(0)}%)
                  </span>
                )}
              </div>
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatKilos(prevYearKg)} (cierre 2025)
              </span>
              {tiempoPct > 0 && tiempoPct < 100 && (
                <div
                  className="absolute top-0 h-full border-l-2 border-dashed"
                  style={{
                    left: `${tiempoPct}%`,
                    borderColor: "var(--text-primary)",
                  }}
                >
                  <span
                    className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: "var(--text-primary)" }}
                  >
                    Día {elapsedBizDays}/{totalBizDays}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold" style={{ color: kgTone }}>
                {kgLabel} {kgGap >= 0 ? "+" : ""}
                {kgGap.toFixed(0)}pp
                <span
                  className="ml-2 font-normal"
                  style={{ color: "var(--text-secondary)" }}
                >
                  — KG: {pctVs2025.toFixed(0)}% · Tiempo: {tiempoPct.toFixed(0)}%
                </span>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {remainingBizDays} día(s) restante(s) · Para igualar:{" "}
                {ySuperaste ? (
                  <strong style={{ color: "var(--success)" }}>
                    ✓ Ya superaste
                  </strong>
                ) : mesCerradoSinSuperar ? (
                  <strong style={{ color: "var(--danger)" }}>
                    ✗ -{formatKilos(kgGapAbs)} vs 2025
                  </strong>
                ) : (
                  <strong
                    style={{
                      color:
                        faltaIgualarKg <= pace2025
                          ? "var(--warning)"
                          : "var(--danger)",
                    }}
                  >
                    {formatKilos(faltaIgualarKg)}/día
                  </strong>
                )}
              </span>
            </div>
          </div>
        );
      })()}

      {/* ============ Chart ============ */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        {chartData.length === 0 ? (
          <p
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin data del mes para graficar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 60, bottom: 5, left: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                stroke="var(--border-strong)"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                stroke="var(--border-strong)"
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}K`
                      : `${v}`
                }
                label={{
                  value: isKg ? "KG Diaria" : "Venta Diaria",
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
                tickFormatter={(v) =>
                  v >= 1_000_000
                    ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}K`
                      : `${v}`
                }
                label={{
                  value: isKg ? "Acumulado KG" : "Acumulado",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "var(--text-muted)", fontSize: 10 },
                }}
              />
              <Tooltip
                content={
                  <TrackingDiarioTooltip
                    currentMonthIdx={currentMonth - 1}
                    prevMonthShortYY={prevMonthShortYY}
                    mode={mode}
                  />
                }
                cursor={{
                  stroke: "var(--text-muted)",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
              />
              <Legend
                verticalAlign="top"
                align="center"
                height={32}
                wrapperStyle={{ paddingBottom: 4 }}
                content={() => (
                  <ChartLegend
                    sections={!isKg
                      ? [
                          {
                            title: "Diario",
                            visualKind: "barras",
                            items: [
                              { label: "Venta Diaria", color: "rgba(59, 130, 246, 0.6)", type: "bar" },
                            ],
                          },
                          {
                            title: "Tendencia",
                            visualKind: "líneas",
                            items: [
                              { label: "Acumulado", color: "#1e3a8a", type: "line-solid" },
                              ...(hasPtto
                                ? [{ label: "Ptto Linear", color: "#a855f7", type: "line-dashed" as const }]
                                : []),
                              ...(hasPrev
                                ? [{ label: `Año Anterior (${prevMonthShortYY})`, color: "#94a3b8", type: "line-dashed" as const }]
                                : []),
                            ],
                          },
                        ]
                      : [
                          {
                            title: "Diario",
                            visualKind: "barras",
                            items: [
                              { label: "KG Diaria", color: "rgba(16, 185, 129, 0.6)", type: "bar" },
                            ],
                          },
                          {
                            title: "Tendencia",
                            visualKind: "líneas",
                            items: [
                              { label: "Acumulado KG 2026", color: "#065f46", type: "line-solid" },
                              ...(hasPrev
                                ? [
                                    { label: `Acumulado KG ${prevMonthShortYY}`, color: "#94a3b8", type: "line-dashed" as const },
                                    { label: "Pace 2025 (lineal)", color: "#a855f7", type: "line-dashed" as const },
                                  ]
                                : []),
                            ],
                          },
                        ]}
                  />
                )}
              />
              {!isKg ? (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="ventaDiaria"
                    name="Venta Diaria"
                    fill="rgba(59, 130, 246, 0.4)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumulado"
                    name="Acumulado"
                    stroke="#1e3a8a"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                  />
                  {hasPtto && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="pttoLinear"
                      name="Ptto Linear"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                    />
                  )}
                  {hasPrev && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="anoAnterior"
                      name={`Año Anterior (${prevMonthShortYY})`}
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                    />
                  )}
                </>
              ) : (
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="kgDiaria"
                    name="KG Diaria"
                    fill="rgba(16, 185, 129, 0.4)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumKg"
                    name="Acumulado KG 2026"
                    stroke="#065f46"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                  />
                  {hasPrev && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="acumKgPrev"
                      name={`Acumulado KG ${prevMonthShortYY}`}
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, strokeWidth: 1, fill: "white" }}
                    />
                  )}
                  {hasPrev && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="paceKg"
                      name="Pace 2025 (lineal)"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="2 4"
                      dot={false}
                    />
                  )}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ============ Tabla diaria ============ */}
      {tableRows.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th>Día</Th>
                  <Th>Fecha</Th>
                  {!isKg ? (
                    <>
                      <Th align="right">Venta Diaria</Th>
                      <Th align="right">Acumulado</Th>
                      <Th align="right">% Ptto</Th>
                      <Th align="right">Vel. Necesaria</Th>
                      <Th align="right">Margen $</Th>
                      <Th align="right">Margen %</Th>
                      <Th align="right">KG</Th>
                    </>
                  ) : (
                    <>
                      <Th align="right">KG Diaria</Th>
                      <Th align="right">Acum 2026</Th>
                      <Th align="right">Acum 2025</Th>
                      <Th align="right">Diferencia</Th>
                      <Th align="right">% vs 2025</Th>
                      <Th align="right">KG/día 2025</Th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr
                    key={row.d}
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--bg-surface)"
                          : "var(--bg-surface-muted)",
                    }}
                  >
                    <Td>{row.dow}</Td>
                    <Td>
                      {row.d} {MONTH_SHORT_LOWER[row.date.getMonth()]}
                    </Td>
                    {!isKg ? (
                      <>
                        <Td align="right">{formatMoney(row.venta)}</Td>
                        <Td align="right">{formatMoney(row.acum)}</Td>
                        <Td align="right">{row.pctPtto.toFixed(1)}%</Td>
                        <Td
                          align="right"
                          color={`var(--${row.velNecesTone})`}
                          bold
                        >
                          {hasPtto ? formatMoney(row.velNeces) : "—"}
                        </Td>
                        <Td align="right">{formatMoney(row.margen)}</Td>
                        <Td align="right">{row.marginPct.toFixed(1)}%</Td>
                        <Td align="right">{formatKilos(row.kg)}</Td>
                      </>
                    ) : (
                      <>
                        <Td align="right">{formatKilos(row.kg)}</Td>
                        <Td align="right">{formatKilos(row.acumKg)}</Td>
                        <Td align="right">
                          {hasPrev ? formatKilos(row.acumKgPrev) : "—"}
                        </Td>
                        <Td
                          align="right"
                          color={
                            hasPrev
                              ? row.diffKg >= 0
                                ? "var(--success)"
                                : "var(--danger)"
                              : undefined
                          }
                          bold
                        >
                          {hasPrev
                            ? `${row.diffKg >= 0 ? "+" : ""}${formatKilos(row.diffKg)}`
                            : "—"}
                        </Td>
                        <Td
                          align="right"
                          color={
                            hasPrev
                              ? row.pctVs2025 >= 0
                                ? "var(--success)"
                                : "var(--danger)"
                              : undefined
                          }
                        >
                          {hasPrev
                            ? `${row.pctVs2025 >= 0 ? "+" : ""}${row.pctVs2025.toFixed(1)}%`
                            : "—"}
                        </Td>
                        <Td align="right">
                          {hasPrev ? formatKilos(row.kgPrevDaily) : "—"}
                        </Td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Row TOTAL */}
                {tableTotals && (
                  <tr
                    style={{
                      background: "var(--bg-surface-muted)",
                      borderTop: "2px solid var(--border-strong)",
                    }}
                  >
                    <Td bold>—</Td>
                    <Td bold>TOTAL</Td>
                    {!isKg ? (
                      <>
                        <Td align="right" bold>
                          {formatMoney(tableTotals.ventaTot)}
                        </Td>
                        <Td align="right" bold>
                          {formatMoney(tableTotals.ventaTot)}
                        </Td>
                        <Td align="right" bold>
                          {hasPtto
                            ? `${((tableTotals.ventaTot / ptto) * 100).toFixed(1)}%`
                            : "—"}
                        </Td>
                        <Td align="right" bold>
                          —
                        </Td>
                        <Td align="right" bold>
                          {formatMoney(tableTotals.margenTot)}
                        </Td>
                        <Td align="right" bold>
                          {tableTotals.marginPctTot.toFixed(1)}%
                        </Td>
                        <Td align="right" bold>
                          {formatKilos(tableTotals.kgTot)}
                        </Td>
                      </>
                    ) : (
                      <>
                        <Td align="right" bold>
                          {formatKilos(tableTotals.kgTot)}
                        </Td>
                        <Td align="right" bold>
                          {formatKilos(tableTotals.kgTot)}
                        </Td>
                        <Td align="right" bold>
                          {hasPrev ? formatKilos(tableTotals.kgPrevTot) : "—"}
                        </Td>
                        <Td
                          align="right"
                          bold
                          color={
                            hasPrev
                              ? tableTotals.diffKgTot >= 0
                                ? "var(--success)"
                                : "var(--danger)"
                              : undefined
                          }
                        >
                          {hasPrev
                            ? `${tableTotals.diffKgTot >= 0 ? "+" : ""}${formatKilos(tableTotals.diffKgTot)}`
                            : "—"}
                        </Td>
                        <Td
                          align="right"
                          bold
                          color={
                            hasPrev
                              ? tableTotals.pctVs2025Tot >= 0
                                ? "var(--success)"
                                : "var(--danger)"
                              : undefined
                          }
                        >
                          {hasPrev
                            ? `${tableTotals.pctVs2025Tot >= 0 ? "+" : ""}${tableTotals.pctVs2025Tot.toFixed(1)}%`
                            : "—"}
                        </Td>
                        <Td align="right" bold>
                          {hasPrev ? formatKilos(pace2025) : "—"}
                        </Td>
                      </>
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Sub-components ============

/**
 * Toggle Pesos / Kilos. Segmented control estilo iOS.
 */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const baseBtn =
    "flex items-center justify-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors";
  return (
    <div
      role="tablist"
      aria-label="Modo de vista"
      className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "pesos"}
        onClick={() => onChange("pesos")}
        className={`${baseBtn} rounded-[var(--radius-sm)]`}
        style={{
          background: mode === "pesos" ? "var(--bg-surface)" : "transparent",
          color:
            mode === "pesos" ? "var(--accent)" : "var(--text-secondary)",
          boxShadow: mode === "pesos" ? "var(--shadow-card)" : "none",
        }}
      >
        Pesos
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "kg"}
        onClick={() => onChange("kg")}
        className={`${baseBtn} rounded-[var(--radius-sm)]`}
        style={{
          background: mode === "kg" ? "var(--bg-surface)" : "transparent",
          color: mode === "kg" ? "var(--accent)" : "var(--text-secondary)",
          boxShadow: mode === "kg" ? "var(--shadow-card)" : "none",
        }}
      >
        Kilos
      </button>
    </div>
  );
}

/**
 * Stat card.
 *
 * - Si recibe `subInline`: el secundario se muestra al lado del valor
 *   principal (estilo "$1.6M · 27.9%" — opción B aprobada por Mauricio).
 * - Si recibe `sub`: el secundario va abajo en gris muted (formato clásico).
 */
function Stat({
  label,
  value,
  sub,
  subInline,
  valueTone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  subInline?: string;
  valueTone?: "neutral" | "success" | "warning" | "danger";
}) {
  const valueColor =
    valueTone === "success"
      ? "var(--success)"
      : valueTone === "warning"
        ? "var(--warning)"
        : valueTone === "danger"
          ? "var(--danger)"
          : "var(--text-primary)";
  return (
    <div
      className="rounded-[var(--radius-lg)] border px-4 py-3"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
        <span
          className="text-xl font-bold"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        {subInline && (
          <span
            className="text-sm"
            style={{ color: "var(--text-muted)", opacity: 0.85 }}
          >
            {subInline}
          </span>
        )}
      </div>
      {sub && (
        <div
          className="mt-0.5 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {sub}
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
      className={`px-3 py-1.5 text-${align}`}
      style={{
        color: color ?? "var(--text-primary)",
        fontWeight: bold ? 600 : 400,
      }}
    >
      {children}
    </td>
  );
}

// ============================================================
// TrackingDiarioTooltip — alineado al UI moderno del tab Ventas
// ============================================================
// Header: "DÍA X — D MMM" + delta YoY del acumulado (▲/▼ vs Día X mes año ant.)
// Cuerpo: Row por cada serie del chart con bullet color + label + valor.
// Datos: vienen del payload de Recharts (chartData), respetando misma info
// que ya se mostraba; solo cambia presentación.
interface TooltipPayloadItem {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string;
}

function TrackingDiarioTooltip({
  active,
  payload,
  label,
  currentMonthIdx,
  prevMonthShortYY,
  mode,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  currentMonthIdx: number;
  prevMonthShortYY: string;
  mode: ViewMode;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dayNum = typeof label === "number" ? label : Number(label);
  const monthLower = MONTH_SHORT_LOWER[currentMonthIdx] ?? "";
  const isKgTooltip = mode === "kg";

  // YoY del acumulado: usa la dataKey correspondiente al modo
  const acumKey = isKgTooltip ? "acumKg" : "acumulado";
  const prevKey = isKgTooltip ? "acumKgPrev" : "anoAnterior";
  const acumActual = payload.find((p) => p.dataKey === acumKey)?.value;
  const acumPrev = payload.find((p) => p.dataKey === prevKey)?.value;
  const yoyDelta =
    typeof acumActual === "number" &&
    typeof acumPrev === "number" &&
    acumPrev > 0
      ? ((acumActual - acumPrev) / acumPrev) * 100
      : null;

  // Orden visual según modo
  const orderedKeys = isKgTooltip
    ? ["kgDiaria", "acumKg", "acumKgPrev", "paceKg"]
    : ["ventaDiaria", "acumulado", "pttoLinear", "anoAnterior"];
  const ordered = orderedKeys
    .map((k) => payload.find((p) => p.dataKey === k))
    .filter((p): p is TooltipPayloadItem => p != null);

  // Formatter de valor según modo (KG vs $)
  const fmt = (v: number | null | undefined) =>
    typeof v === "number"
      ? isKgTooltip
        ? formatKilos(v)
        : formatMoney(v)
      : "—";

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 240,
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
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          Día {dayNum} — {dayNum} {monthLower}
        </span>
        {yoyDelta != null && (
          <span
            className="text-[10px] font-semibold whitespace-nowrap"
            style={{
              color: yoyDelta >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta).toFixed(1)}% vs Día{" "}
            {dayNum} {prevMonthShortYY}
          </span>
        )}
      </div>

      {/* Cuerpo: una sola sección con todas las series */}
      <div className="px-3 py-2">
        {ordered.map((p) => (
          <TtRow
            key={p.dataKey}
            color={p.color}
            label={p.name ?? ""}
            value={fmt(p.value)}
          />
        ))}
      </div>
    </div>
  );
}

function TtRow({
  color,
  label,
  value,
}: {
  color: string | undefined;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: color ?? "var(--text-muted)" }}
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
