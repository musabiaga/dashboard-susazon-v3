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

/** Fila resumen por (territorio | división | empresa). */
export interface ReportSummaryRow {
  name: string;
  objetivo: number;
  avance: number;
  proyeccion: number;
  pctVsObjetivo: number; // proyeccion / objetivo
  marginPct: number;
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
  margen: number;
  marginPct: number;
  kg: number;
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

  /** Tablas — solo en modo "all" o "multi" */
  porDivision?: ReportSummaryRow[];
  porEmpresa?: ReportSummaryRow[];
  porTerritorio?: ReportSummaryRow[];

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
}
