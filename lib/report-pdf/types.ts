/**
 * lib/report-pdf/types.ts — tipos compartidos para el PDF "Avance Comercial".
 *
 * El reporte se arma del data que ya está en el DashboardClient. No hace
 * queries adicionales; reutiliza territories[].kpi, totalKpi, clientes.byTerritory
 * y derivados.
 */

/** Los 11 territorios que entran en el reporte (8 CEDIs + CDP + Distrib + Retail).
 *  Los demás (Tiendas, Intercompañías, Venta Detalle, Zurt-t) se filtran en
 *  data.ts antes de armar el PDF. */
export const REPORT_TERRITORIES = [
  "Cedis Bajio Celaya",
  "Cedis Bajio Queretaro",
  "Cedis Cancun",
  "Cedis Leon",
  "Cedis Mexico",
  "Cedis Monterrey",
  "Cedis Morelia",
  "Cedis San Luis Potosi",
  "Cuentas Directas Planta",
  "Distribuidores",
  "Ventas Retail",
] as const;

export type ReportTerritory = (typeof REPORT_TERRITORIES)[number];

/** Mapping territorio → división (canal). Inferido del PDF AvComSS. */
export const TERRITORY_DIVISION: Record<ReportTerritory, "Foodservice" | "Distribuidores" | "Retail"> = {
  "Cedis Bajio Celaya": "Foodservice",
  "Cedis Bajio Queretaro": "Foodservice",
  "Cedis Cancun": "Foodservice",
  "Cedis Leon": "Foodservice",
  "Cedis Mexico": "Foodservice",
  "Cedis Monterrey": "Foodservice",
  "Cedis Morelia": "Foodservice",
  "Cedis San Luis Potosi": "Foodservice",
  "Cuentas Directas Planta": "Foodservice",
  Distribuidores: "Distribuidores",
  "Ventas Retail": "Retail",
};

/** Modo del reporte según selección del sidebar. */
export type ReportMode =
  | { kind: "single"; territory: string }
  | { kind: "multi"; territories: string[]; label: string }
  | { kind: "all"; territories: string[] };

/** Fila resumen Pesos por (territorio | división | empresa).
 *  Incluye comparativo al-día 2025 (sumando kpi.currentMonthAlDia.v25 de los
 *  territorios del grupo). */
export interface ReportSummaryRow {
  name: string;
  objetivo: number;
  avance: number;
  proyeccion: number;
  pctVsObjetivo: number; // proyeccion / objetivo
  marginPct: number;
  /** Pesos al mismo día hábil del mismo mes 2025. */
  avance2025AlDia: number;
  /** (avance - avance2025AlDia) / avance2025AlDia. null si no hay base. */
  varVsAnio: number | null;
}

/** Fila Kilos por territorio. Kilos no tiene objetivo, por eso solo comparamos
 *  contra el cierre del mismo mes 2025. */
export interface ReportKilosRow {
  name: string;
  kg26: number;
  kg25: number; // cierre del mes 2025 (no al-día porque no está agregado en backend)
  deltaKg: number;
  varVsAnio: number | null;
}

/** Fila Margen $ y % por territorio. Compara contra el cierre del mes 2025. */
export interface ReportMargenRow {
  name: string;
  margen26: number;
  marginPct26: number; // 0-1
  margen25: number; // cierre del mes 2025
  marginPct25: number; // 0-1
  deltaMargen: number;
  /** Diferencia en puntos porcentuales (marginPct26 - marginPct25) × 100. */
  deltaPp: number;
}

/** Punto del trend mensual para el chart de 16+ meses. */
export interface ReportMonthlyPoint {
  /** Etiqueta: "ene-25", "feb-25", etc. */
  label: string;
  anio: number;
  mes: number;
  /** Venta del mes (cerrado o al-día si es el actual) */
  venta: number;
  /** Si es el slot del mes actual, también incluimos objetivo y proyección. */
  isCurrent?: boolean;
  objetivo?: number;
  proyeccion?: number;
}

/** Top 10 cliente (en USD del mes actual, al-día). */
export interface ReportTopCliente {
  no_cliente: string;
  cliente: string;
  vendedor: string;
  /** Venta al-día del mes actual */
  ventaActual: number;
  /** Venta al-día del mismo mes año anterior (para comparativo) */
  ventaAnio: number;
  varPct: number | null;
}

/** Tracking diario: una fila por día del mes actual. */
export interface ReportDailyRow {
  dia: number;
  dow: string; // "L", "M", "Mi"...
  venta: number;
  acumulado: number;
  pctPtto: number;
  velNecesaria: number;
  /** Categoría del semáforo de vel. necesaria comparada con vel. original. */
  velNecesTone: "success" | "warning" | "danger";
  margen: number;
  marginPct: number;
  kg: number;
  // ===== Comparativo KG vs mismo día año anterior (para tabla en PDF) =====
  acumKg: number;
  acumKgPrev: number;
  diffKg: number;
  pctVs2025: number;
  kgPrevDaily: number;
}

/** Punto del chart compuesto del Tracking Diario (Pesos o KG). */
export interface TrackingChartPoint {
  day: number;
  // Pesos
  ventaDiaria: number;
  acumulado: number;
  pttoLinear: number;
  anoAnterior: number;
  // Kilos
  kgDiaria: number;
  acumKg: number;
  acumKgPrev: number;
  paceKg: number;
}

/** Stats del Tracking Diario — réplica exacta de las 8 stats por modo (Pesos / Kilos)
 *  del tab. Se usa para armar los dos grids de 8 KPIs en la página 1 del PDF. */
export interface TrackingPdfStats {
  // === Datos base ===
  elapsedBizDays: number;
  totalBizDays: number;
  daysWithInvoice: number;
  hasPtto: boolean;
  hasPrev: boolean;
  ptto: number;

  // === Pesos (8 stats) ===
  acum: number;
  alcancePct: number; // 0-100
  faltante: number;
  marginMoney: number;
  marginPct: number; // 0-100
  prevYearVenta: number;
  yoyCh: number; // % vs año ant.
  velOrig: number;
  velActual: number;
  velNeces: number;
  runRate: number;
  runRatePct: number; // % del ptto

  // === Kilos (8 stats) ===
  acumKg: number;
  prevYearKg: number;
  yoyKgDelta: number;
  yoyKgPct: number;
  pace2025: number;
  velActualKg: number;
  ySuperaste: boolean;
  kgGapAbs: number;
  mesCerradoSinSuperar: boolean;
  faltaIgualarKg: number;
  runRateKg: number;
  pctVs2025: number; // % de cierre 2025 (proy.)

  // === Progress bar Pesos (vs PTTO) ===
  tiempoPct: number;
  brechaPp: number;
  progressTone: "success" | "warning" | "danger";

  // === Chart compuesto (mismas series Pesos+Kilos en el mismo array) ===
  chartData: TrackingChartPoint[];
}

/** Datos completos del reporte. */
export interface ReportData {
  /** Metadata */
  monthLabel: string; // "Mayo 2026"
  monthShortYY: string; // "May 26"
  dataDate: string; // "11-may-26"
  mode: ReportMode;

  /** Header KPIs */
  diasHabiles: number;
  avanceDias: number;
  pctAvanceDias: number;

  /** Venta del día por división (solo para modo "all" o "multi") */
  ventaDiaPorDivision?: Record<"Foodservice" | "Distribuidores" | "Retail", number>;

  /** Totales globales del periodo */
  totalObjetivo: number;
  totalAvance: number;
  totalProyeccion: number;
  totalPctVsObjetivo: number;
  totalMarginPct: number;

  /** Tablas Pesos — siempre se generan (en single tienen 1 fila). */
  porDivision?: ReportSummaryRow[];
  porEmpresa?: ReportSummaryRow[];
  porTerritorio?: ReportSummaryRow[];
  /** Tabla Kilos por territorio — comparativo vs cierre del mes 2025. */
  porTerritorioKilos?: ReportKilosRow[];
  /** Tabla Margen por territorio — comparativo vs cierre del mes 2025. */
  porTerritorioMargen?: ReportMargenRow[];

  /** Trend mensual (~16 meses + slot may'26 con objetivo/proyección) */
  trendMensual: ReportMonthlyPoint[];

  /** Sección focalizada (cuando mode.kind === "single") o agregados (todos modos) */
  singleTerritoryKpis?: {
    objetivo: number;
    avance: number;
    proyeccion: number;
    pctVsObjetivo: number;
    marginPct: number;
    ventaDia: number;
  };

  /** Top 10 clientes (mes actual al-día + comparativo año anterior) */
  topClientes: ReportTopCliente[];

  /** Tracking diario detallado */
  trackingDiario: ReportDailyRow[];

  /** Bloques del tab Tracking Diario para la página 1 del PDF.
   *  Réplica exacta del tab: 8 stats Pesos + 8 stats Kilos + progress bar + chart. */
  tracking: TrackingPdfStats;
}
