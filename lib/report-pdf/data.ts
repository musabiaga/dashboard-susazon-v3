/**
 * lib/report-pdf/data.ts — extracción/transformación de data del DashboardClient
 * al formato ReportData que consume AvanceComercialPDF.
 *
 * Reglas:
 *   - Solo 11 territorios "report-relevant" (filtrados con REPORT_TERRITORIES).
 *   - Selección del sidebar determina el ReportMode (single/multi/all).
 *   - Avance, objetivo, proyección, margen reusan los cálculos del dashboard.
 */

import type { Territory, TerritoryKpi } from "@/components/dashboard/Sidebar";
import type { DimensionRow } from "@/components/dashboard/DimensionTab";
import { countBizDays, isBusinessDay } from "@/lib/business-days";
import {
  REPORT_TERRITORIES,
  TERRITORY_DIVISION,
  type ReportData,
  type ReportMode,
  type ReportSummaryRow,
  type ReportMonthlyPoint,
  type ReportTopCliente,
  type ReportDailyRow,
  type TrackingPdfStats,
  type TrackingChartPoint,
} from "./types";

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const MONTH_LONG_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DOW_ES = ["D", "L", "M", "Mi", "J", "V", "S"];

export interface BuildReportInput {
  /** Lista de TODOS los territorios disponibles (con kpi, ventaBudget, isActive). */
  territories: Territory[];
  /** KPI agregado del set seleccionado del sidebar (puede ser uno solo o muchos). */
  selectedKpi: TerritoryKpi;
  /** Budget agregado del set seleccionado. */
  selectedBudget: number;
  /** Modo del reporte (derivado de la selección del sidebar). */
  mode: ReportMode;
  /** Año actual */
  currentYear: number;
  /** Mes actual 1-12 */
  currentMonth: number;
  /** Día calendario "hoy" CDMX */
  daysCurrent: number;
  /** Días hábiles transcurridos */
  elapsedBizDays: number;
  /** Días hábiles totales del mes */
  totalBizDays: number;
  /** Dataset de clientes (para Top 10) */
  clientes: { byTerritory: Record<string, DimensionRow[]>; total: DimensionRow[] };
}

/** Filtra territorios al universo del reporte (11) y a la selección del modo. */
function filterReportTerritories(
  territories: Territory[],
  mode: ReportMode
): Territory[] {
  const reportSet = new Set<string>(REPORT_TERRITORIES);
  const onlyActive = territories.filter(
    (t) => t.isActive && reportSet.has(t.name)
  );
  if (mode.kind === "single") {
    return onlyActive.filter((t) => t.name === mode.territory);
  }
  if (mode.kind === "multi") {
    const sel = new Set(mode.territories);
    return onlyActive.filter((t) => sel.has(t.name));
  }
  return onlyActive; // "all"
}

/** Proyección = avance / días hábiles transcurridos × días hábiles totales. */
function projectMonth(avance: number, elapsed: number, total: number): number {
  if (elapsed <= 0) return 0;
  return (avance / elapsed) * total;
}

/** Devuelve { objetivo, avance, proyeccion, pctVsObjetivo, marginPct } por
 *  conjunto de territorios. */
function summarize(
  territories: Territory[],
  elapsed: number,
  total: number
): Omit<ReportSummaryRow, "name"> {
  const objetivo = territories.reduce((s, t) => s + t.ventaBudget, 0);
  const avance = territories.reduce((s, t) => s + t.kpi.venta, 0);
  const margen = territories.reduce((s, t) => s + t.kpi.margen, 0);
  const proyeccion = projectMonth(avance, elapsed, total);
  return {
    objetivo,
    avance,
    proyeccion,
    pctVsObjetivo: objetivo > 0 ? proyeccion / objetivo : 0,
    marginPct: avance > 0 ? margen / avance : 0,
  };
}

export function buildReportData(input: BuildReportInput): ReportData {
  const {
    territories,
    mode,
    currentYear,
    currentMonth,
    daysCurrent,
    elapsedBizDays,
    totalBizDays,
    clientes,
    selectedKpi,
    selectedBudget,
  } = input;

  const reportTerrs = filterReportTerritories(territories, mode);
  const monthIdx = currentMonth - 1;

  // === Header / metadata ===
  const monthLabel = `${MONTH_LONG_ES[monthIdx]} ${currentYear}`;
  const monthShortYY = `${MONTH_SHORT_ES[monthIdx]}-${currentYear % 100}`;
  const dataDate = `${daysCurrent}-${MONTH_SHORT_ES[monthIdx]}-${currentYear % 100}`;
  const pctAvanceDias = totalBizDays > 0 ? elapsedBizDays / totalBizDays : 0;

  // === Totales globales del reporte ===
  // En modo "all" o "multi" hacemos suma directa de los territorios filtrados.
  // En modo "single" usamos selectedKpi (que = territory.kpi).
  let totalObjetivo: number;
  let totalAvance: number;
  let totalMarginPct: number;
  if (mode.kind === "single") {
    totalObjetivo = selectedBudget;
    totalAvance = selectedKpi.venta;
    totalMarginPct = selectedKpi.marginPct / 100; // viene en %
  } else {
    const s = summarize(reportTerrs, elapsedBizDays, totalBizDays);
    totalObjetivo = s.objetivo;
    totalAvance = s.avance;
    totalMarginPct = s.marginPct;
  }
  const totalProyeccion = projectMonth(totalAvance, elapsedBizDays, totalBizDays);
  const totalPctVsObjetivo = totalObjetivo > 0 ? totalProyeccion / totalObjetivo : 0;

  // === Venta del día por división (solo aplica si hay >1 territorio o "all") ===
  let ventaDiaPorDivision:
    | Record<"Foodservice" | "Distribuidores" | "Retail", number>
    | undefined;
  if (mode.kind !== "single") {
    const ventaDia = { Foodservice: 0, Distribuidores: 0, Retail: 0 } as Record<
      "Foodservice" | "Distribuidores" | "Retail",
      number
    >;
    for (const t of reportTerrs) {
      const division = TERRITORY_DIVISION[t.name as (typeof REPORT_TERRITORIES)[number]];
      if (!division) continue;
      // Venta del día = venta del último día con data en kpi.daily.current
      const lastDay = t.kpi.daily.current.find((p) => p.d === daysCurrent);
      ventaDia[division] += lastDay?.v ?? 0;
    }
    ventaDiaPorDivision = ventaDia;
  }

  // === Tabla "Por División" (solo modos all/multi) ===
  let porDivision: ReportSummaryRow[] | undefined;
  if (mode.kind !== "single") {
    const grouped = new Map<string, Territory[]>();
    for (const t of reportTerrs) {
      const div = TERRITORY_DIVISION[t.name as (typeof REPORT_TERRITORIES)[number]];
      if (!div) continue;
      if (!grouped.has(div)) grouped.set(div, []);
      grouped.get(div)!.push(t);
    }
    porDivision = Array.from(grouped.entries()).map(([div, ts]) => ({
      name: div,
      ...summarize(ts, elapsedBizDays, totalBizDays),
    }));
  }

  // === Tabla "Por Empresa" (Susazón / Suve) ===
  // Heurística: como no tenemos campo `empresa` por territorio, asumimos:
  //   - Ventas Retail → Suve (es la línea retail comercial)
  //   - Todo lo demás → Susazón
  // Esta es una APROXIMACIÓN. Para precisión real habría que sumar desde
  // sales_rows con filter por empresa (cambio de scope futuro).
  let porEmpresa: ReportSummaryRow[] | undefined;
  if (mode.kind !== "single") {
    const susazon = reportTerrs.filter((t) => t.name !== "Ventas Retail");
    const suve = reportTerrs.filter((t) => t.name === "Ventas Retail");
    porEmpresa = [];
    if (susazon.length > 0) {
      porEmpresa.push({
        name: "Susazón",
        ...summarize(susazon, elapsedBizDays, totalBizDays),
      });
    }
    if (suve.length > 0) {
      porEmpresa.push({
        name: "Suve",
        ...summarize(suve, elapsedBizDays, totalBizDays),
      });
    }
  }

  // === Tabla "Por Territorio" (siempre, en cualquier modo) ===
  const porTerritorio: ReportSummaryRow[] = reportTerrs.map((t) => ({
    name: t.name,
    ...summarize([t], elapsedBizDays, totalBizDays),
  }));

  // === Trend mensual (los últimos ~16 meses + slot del mes actual) ===
  const trendMensual: ReportMonthlyPoint[] = [];
  // Recolectar ventas mensuales sumando across los territorios del reporte
  const monthlyMap = new Map<string, number>(); // key: "anio-mes"
  for (const t of reportTerrs) {
    for (const p of t.kpi.monthly) {
      const key = `${p.anio}-${p.mes}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + p.venta);
    }
  }
  // Generar últimos 16 meses (no incluye el actual)
  for (let i = 15; i >= 1; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const key = `${y}-${m}`;
    const venta = monthlyMap.get(key) ?? 0;
    if (venta === 0) continue;
    trendMensual.push({
      label: `${MONTH_SHORT_ES[m - 1]}-${y % 100}`,
      anio: y,
      mes: m,
      venta,
    });
  }
  // Slot del mes actual con objetivo / proyección / avance separados
  trendMensual.push({
    label: monthShortYY,
    anio: currentYear,
    mes: currentMonth,
    venta: totalAvance,
    isCurrent: true,
    objetivo: totalObjetivo,
    proyeccion: totalProyeccion,
  });

  // === Single territory KPIs (cuando aplica) ===
  let singleTerritoryKpis: ReportData["singleTerritoryKpis"];
  if (mode.kind === "single") {
    const tt = reportTerrs[0];
    const ventaDia = tt?.kpi.daily.current.find((p) => p.d === daysCurrent)?.v ?? 0;
    singleTerritoryKpis = {
      objetivo: totalObjetivo,
      avance: totalAvance,
      proyeccion: totalProyeccion,
      pctVsObjetivo: totalPctVsObjetivo,
      marginPct: totalMarginPct,
      ventaDia,
    };
  }

  // === Top 10 clientes (mes actual al-día + comparativo año anterior) ===
  // Construir el "rows" de clientes según el mode:
  let clienteRows: DimensionRow[];
  if (mode.kind === "single") {
    clienteRows = clientes.byTerritory[mode.territory] ?? [];
  } else if (mode.kind === "multi") {
    // Suma de los seleccionados
    const map = new Map<string, DimensionRow>();
    for (const terr of mode.territories) {
      for (const r of clientes.byTerritory[terr] ?? []) {
        const cur = map.get(r.name);
        if (!cur) {
          map.set(r.name, { ...r });
          continue;
        }
        const NUM: (keyof DimensionRow)[] = [
          "v24", "v25", "v26",
          "k24", "k25", "k26",
          "m24", "m25", "m26",
          "v24_alDia", "v25_alDia", "v26_alDia",
          "k24_alDia", "k25_alDia", "k26_alDia",
          "m24_alDia", "m25_alDia", "m26_alDia",
        ];
        for (const f of NUM) {
          const a = (cur[f] as number | undefined) ?? 0;
          const b = (r[f] as number | undefined) ?? 0;
          (cur as unknown as Record<string, unknown>)[f] = a + b;
        }
      }
    }
    clienteRows = Array.from(map.values());
  } else {
    // all: filtrar el .total a los rows cuyos territorios estén en REPORT_TERRITORIES
    // (en realidad clientes.total ya agrega TODOS los territorios visibles del RLS,
    // que pueden incluir Tiendas/Intercompañías. Pero como mode=all aquí
    // implica selección de "Todos" del sidebar, asumimos que estaban incluidos
    // todos y no podemos sub-restar sin reagregar. Para v1 usamos clientes.total).
    clienteRows = clientes.total;
  }

  const topClientes: ReportTopCliente[] = [...clienteRows]
    .sort((a, b) => {
      const aV = a.v26_alDia ?? a.v26;
      const bV = b.v26_alDia ?? b.v26;
      return bV - aV;
    })
    .slice(0, 10)
    .map((r) => {
      const ventaActual = r.v26_alDia ?? r.v26;
      const ventaAnio = r.v25_alDia ?? r.v25;
      return {
        no_cliente: "",
        cliente: r.name,
        vendedor: "",
        ventaActual,
        ventaAnio,
        varPct: ventaAnio > 0 ? (ventaActual - ventaAnio) / ventaAnio : null,
      };
    });

  // === Tracking diario (réplica EXACTA del tab TrackingDiarioTab) ===
  // El conjunto de datos base es selectedKpi (= KPI agregado del set
  // seleccionado del sidebar). ptto = budget agregado, prev = misma agregación
  // pero de daily.prevYear.
  const ptto = selectedBudget;
  const acum = selectedKpi.venta;
  const marginMoney = selectedKpi.margen;
  const marginPctVal = selectedKpi.marginPct; // 0-100
  const prevYearVenta = selectedKpi.prevYear.venta;
  const remainingBizDays = Math.max(0, totalBizDays - elapsedBizDays);
  const hasPtto = ptto > 0;
  const hasPrev = prevYearVenta > 0;

  // ---- 8 stats Pesos ----
  const velOrig = totalBizDays > 0 ? ptto / totalBizDays : 0;
  const velActual = elapsedBizDays > 0 ? acum / elapsedBizDays : 0;
  const velNeces =
    remainingBizDays > 0
      ? Math.max(0, (ptto - acum) / remainingBizDays)
      : 0;
  const runRate = velActual * totalBizDays;
  const runRatePct = ptto > 0 ? (runRate / ptto) * 100 : 0;
  const alcancePct = ptto > 0 ? (acum / ptto) * 100 : 0;
  const faltante = Math.max(0, ptto - acum);
  const yoyCh =
    prevYearVenta > 0
      ? ((acum - prevYearVenta) / prevYearVenta) * 100
      : 0;
  const tiempoPct =
    totalBizDays > 0 ? (elapsedBizDays / totalBizDays) * 100 : 0;
  const brechaPp = alcancePct - tiempoPct;
  const progressTone: "success" | "warning" | "danger" =
    brechaPp >= 0 ? "success" : brechaPp >= -5 ? "warning" : "danger";

  // ---- 8 stats Kilos ----
  const acumKg = selectedKpi.daily.current.reduce((s, p) => s + p.k, 0);
  const prevYearKg = selectedKpi.daily.prevYear.reduce((s, p) => s + p.k, 0);
  const yoyKgDelta = acumKg - prevYearKg;
  const yoyKgPct =
    prevYearKg > 0 ? ((acumKg - prevYearKg) / prevYearKg) * 100 : 0;
  const pace2025 = totalBizDays > 0 ? prevYearKg / totalBizDays : 0;
  const velActualKg = elapsedBizDays > 0 ? acumKg / elapsedBizDays : 0;
  const ySuperaste = prevYearKg > 0 && acumKg >= prevYearKg;
  const kgGapAbs = Math.max(0, prevYearKg - acumKg);
  const mesCerradoSinSuperar =
    prevYearKg > 0 && remainingBizDays === 0 && !ySuperaste;
  const faltaIgualarKg =
    remainingBizDays > 0 && !ySuperaste ? kgGapAbs / remainingBizDays : 0;
  const runRateKg = velActualKg * totalBizDays;
  const pctVs2025_kpi = prevYearKg > 0 ? (acumKg / prevYearKg) * 100 : 0;

  // ---- Días hábiles con factura ----
  const daysWithInvoice = selectedKpi.daily.current.filter((p) =>
    isBusinessDay(new Date(currentYear, currentMonth - 1, p.d))
  ).length;

  // ---- Chart data (1 row por día con TODAS las series Pesos+Kilos) ----
  const allDays = new Set<number>();
  for (const p of selectedKpi.daily.current) allDays.add(p.d);
  for (const p of selectedKpi.daily.prevYear) allDays.add(p.d);
  const sortedDayList = Array.from(allDays).sort((a, b) => a - b);

  const currentByDayV = new Map(
    selectedKpi.daily.current.map((p) => [p.d, p.v])
  );
  const prevByDayV = new Map(
    selectedKpi.daily.prevYear.map((p) => [p.d, p.v])
  );
  const currentByDayK = new Map(
    selectedKpi.daily.current.map((p) => [p.d, p.k])
  );
  const prevByDayK = new Map(
    selectedKpi.daily.prevYear.map((p) => [p.d, p.k])
  );

  const chartData: TrackingChartPoint[] = [];
  let cumCV = 0;
  let cumPV = 0;
  let cumCK = 0;
  let cumPK = 0;
  for (const d of sortedDayList) {
    cumCV += currentByDayV.get(d) ?? 0;
    cumPV += prevByDayV.get(d) ?? 0;
    cumCK += currentByDayK.get(d) ?? 0;
    cumPK += prevByDayK.get(d) ?? 0;
    const bizElapsedHere = countBizDays(currentYear, currentMonth, d);
    const pttoLinearHere =
      totalBizDays > 0 ? ptto * (bizElapsedHere / totalBizDays) : 0;
    const pace2025Here = pace2025 * bizElapsedHere;
    chartData.push({
      day: d,
      ventaDiaria: currentByDayV.get(d) ?? 0,
      acumulado: cumCV,
      pttoLinear: pttoLinearHere,
      anoAnterior: cumPV,
      kgDiaria: currentByDayK.get(d) ?? 0,
      acumKg: cumCK,
      acumKgPrev: cumPK,
      paceKg: pace2025Here,
    });
  }

  const tracking: TrackingPdfStats = {
    elapsedBizDays,
    totalBizDays,
    daysWithInvoice,
    hasPtto,
    hasPrev,
    ptto,
    // Pesos
    acum,
    alcancePct,
    faltante,
    marginMoney,
    marginPct: marginPctVal,
    prevYearVenta,
    yoyCh,
    velOrig,
    velActual,
    velNeces,
    runRate,
    runRatePct,
    // Kilos
    acumKg,
    prevYearKg,
    yoyKgDelta,
    yoyKgPct,
    pace2025,
    velActualKg,
    ySuperaste,
    kgGapAbs,
    mesCerradoSinSuperar,
    faltaIgualarKg,
    runRateKg,
    pctVs2025: pctVs2025_kpi,
    // Progress bar
    tiempoPct,
    brechaPp,
    progressTone,
    // Chart data
    chartData,
  };

  // === Tracking diario detallado (tabla página 2) ===
  // Réplica EXACTA de la lógica del tab: rows ordenados con vel necesaria por
  // día, %ptto acumulado, semáforo, y columnas KG comparativas vs 2025 al
  // mismo día.
  const trackingDiario: ReportDailyRow[] = [];
  const sortedDays = [...selectedKpi.daily.current].sort((a, b) => a.d - b.d);
  const prevSortedK = [...selectedKpi.daily.prevYear].sort((a, b) => a.d - b.d);
  // Acumulado KG del año anterior por día (para "Acum 2025" en cada row)
  const prevAcumKgByDay = new Map<number, number>();
  let cumPrevK = 0;
  for (const p of prevSortedK) {
    cumPrevK += p.k;
    prevAcumKgByDay.set(p.d, cumPrevK);
  }
  const prevDailyKgByDay = new Map(prevSortedK.map((p) => [p.d, p.k]));

  let cumV = 0;
  let cumK = 0;
  for (const p of sortedDays) {
    cumV += p.v;
    cumK += p.k;
    const date = new Date(currentYear, currentMonth - 1, p.d);
    const dow = DOW_ES[date.getDay()];
    const bizElapsedHere = countBizDays(currentYear, currentMonth, p.d);
    const remainingBizHere = Math.max(0, totalBizDays - bizElapsedHere);
    const velNecesHere =
      remainingBizHere > 0 ? Math.max(0, (ptto - cumV) / remainingBizHere) : 0;
    const pctPtto = ptto > 0 ? cumV / ptto : 0; // como fracción 0-1
    const marginPctRow = p.v > 0 ? p.m / p.v : 0;
    const velNecesTone: "success" | "warning" | "danger" =
      velOrig === 0
        ? "success"
        : velNecesHere <= velOrig
          ? "success"
          : velNecesHere <= velOrig * 1.2
            ? "warning"
            : "danger";
    const acumKgPrevHere = prevAcumKgByDay.get(p.d) ?? 0;
    const diffKg = cumK - acumKgPrevHere;
    const pctVs2025Row =
      acumKgPrevHere > 0 ? (cumK - acumKgPrevHere) / acumKgPrevHere : 0;
    const kgPrevDaily = prevDailyKgByDay.get(p.d) ?? 0;
    trackingDiario.push({
      dia: p.d,
      dow,
      venta: p.v,
      acumulado: cumV,
      pctPtto,
      velNecesaria: velNecesHere,
      velNecesTone,
      margen: p.m,
      marginPct: marginPctRow,
      kg: p.k,
      acumKg: cumK,
      acumKgPrev: acumKgPrevHere,
      diffKg,
      pctVs2025: pctVs2025Row,
      kgPrevDaily,
    });
  }

  return {
    monthLabel,
    monthShortYY,
    dataDate,
    mode,
    diasHabiles: totalBizDays,
    avanceDias: elapsedBizDays,
    pctAvanceDias,
    ventaDiaPorDivision,
    totalObjetivo,
    totalAvance,
    totalProyeccion,
    totalPctVsObjetivo,
    totalMarginPct,
    porDivision,
    porEmpresa,
    porTerritorio,
    trendMensual,
    singleTerritoryKpis,
    topClientes,
    trackingDiario,
    tracking,
  };
}
