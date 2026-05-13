/**
 * lib/report-pdf/AvanceComercialPDF.tsx — componente principal del reporte PDF.
 *
 * Genera un PDF estilo "AvComSS" (Avance Comercial Susazón) con:
 *  - Header con metadata (mes, fecha, % avance, días hábiles)
 *  - 3 tablas (Por División / Por Empresa / Por Territorio)
 *  - Trend mensual visualizado (barras simples sin recharts, porque @react-pdf
 *    no soporta SVG complejo de recharts; usamos rectángulos nativos)
 *  - Top 10 clientes del mes + comparativo año anterior
 *  - Tracking diario detallado
 *
 * Tres modos:
 *  - single: KPI focalizado de un territorio + su tracking diario + top clientes
 *  - multi: como "all" pero con etiqueta "X territorios seleccionados"
 *  - all: replica completa estilo AvComSS
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Rect,
  Line as SvgLine,
  Polyline,
} from "@react-pdf/renderer";
import type {
  ReportData,
  TrackingChartPoint,
  ReportKilosRow,
  ReportMargenRow,
  ReportSummaryRow,
} from "./types";

// ============================================================
// Fonts — usamos Helvetica (built-in) para evitar carga de fonts externas.
// Si en el futuro queremos Bebas Neue + Montserrat reales, se registran con
// Font.register({ family, src }) apuntando a archivos en public/.
// ============================================================

// ============================================================
// Estilos
// ============================================================

const COLORS = {
  orange: "#ed6808",
  orangeDark: "#c55300",
  brown: "#2c1810",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  bgMuted: "#f9fafb",
  bgHeader: "#f3f4f6",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: COLORS.textPrimary,
  },

  // === Header de página ===
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "column",
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: COLORS.textPrimary,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: COLORS.orange,
    marginTop: 2,
  },
  metaRight: {
    alignItems: "flex-end",
  },
  metaText: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },

  // === Box de KPIs del día ===
  kpiBox: {
    flexDirection: "row",
    marginBottom: 14,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 4,
    padding: 8,
    backgroundColor: COLORS.bgMuted,
  },
  kpiLabel: {
    fontSize: 7,
    color: COLORS.textMuted,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textPrimary,
    marginTop: 3,
  },
  kpiSub: {
    fontSize: 7,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // === Section ===
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `1pt solid ${COLORS.orange}`,
  },

  // === Tabla ===
  table: {
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.bgHeader,
    borderBottom: `1pt solid ${COLORS.borderStrong}`,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${COLORS.border}`,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    backgroundColor: COLORS.bgMuted,
  },
  tableTotalRow: {
    flexDirection: "row",
    backgroundColor: COLORS.bgHeader,
    borderTop: `1.5pt solid ${COLORS.borderStrong}`,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  cell: {
    fontSize: 8,
  },
  cellHeader: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cellBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  cellRight: {
    textAlign: "right",
  },

  // === Footer ===
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    fontSize: 7,
    color: COLORS.textMuted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: `0.5pt solid ${COLORS.border}`,
    paddingTop: 5,
  },

  // === Stats grid (8 cards) ===
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  statCard: {
    // 4 columnas → cada card ocupa ~25% (con gap). Calculamos manualmente:
    width: "24.4%",
    border: `0.5pt solid ${COLORS.border}`,
    borderRadius: 3,
    padding: 5,
    backgroundColor: COLORS.bgMuted,
  },
  statLabel: {
    fontSize: 6,
    color: COLORS.textMuted,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  statValueWithInline: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap",
  },
  statValueInline: {
    fontSize: 8,
    color: COLORS.textSecondary,
  },
  statSub: {
    fontSize: 6,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // === Progress bar ===
  progressWrap: {
    marginVertical: 4,
  },
  progressTrack: {
    height: 14,
    width: "100%",
    backgroundColor: COLORS.bgMuted,
    borderRadius: 2,
    border: `0.5pt solid ${COLORS.border}`,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabel: {
    fontSize: 7,
    color: "white",
    fontFamily: "Helvetica-Bold",
  },
  progressMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  progressMetaText: {
    fontSize: 7,
    color: COLORS.textSecondary,
  },
  progressBadge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    color: "white",
  },

  // === Trend chart simulado (rectángulos) — LEGACY ===
  trendChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 3,
    marginVertical: 4,
  },
  trendBarWrap: {
    flex: 1,
    alignItems: "center",
  },
  trendBar: {
    width: "70%",
    backgroundColor: COLORS.orange,
    minHeight: 1,
  },
  trendBarObjetivo: {
    backgroundColor: COLORS.brown,
  },
  trendBarProyeccion: {
    backgroundColor: COLORS.orangeDark,
  },
  trendLabel: {
    fontSize: 5,
    color: COLORS.textMuted,
    marginTop: 2,
    transform: "rotate(-30deg)",
    transformOrigin: "center",
  },
});

// ============================================================
// Helpers
// ============================================================

function formatMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatMoneyExact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatKilos(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M kg`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K kg`;
  return `${sign}${abs.toFixed(0)} kg`;
}

function formatPctRaw(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

/** Variante coloreable según tone. */
function toneColor(tone: "success" | "warning" | "danger" | "neutral"): string {
  if (tone === "success") return COLORS.success;
  if (tone === "warning") return COLORS.warning;
  if (tone === "danger") return COLORS.danger;
  return COLORS.textPrimary;
}

// ============================================================
// Componentes reusables
// ============================================================

function Header({ data }: { data: ReportData }) {
  const modeLabel =
    data.mode.kind === "single"
      ? `Territorio: ${data.mode.territory}`
      : data.mode.kind === "multi"
        ? `${data.mode.territories.length} territorios seleccionados`
        : "Todos los territorios";

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <Text style={styles.brand}>SUSAZÓN · Área Comercial</Text>
        <Text style={styles.title}>Avance de Ventas {data.monthLabel}</Text>
        <Text style={[styles.metaText, { marginTop: 3 }]}>{modeLabel}</Text>
      </View>
      <View style={styles.metaRight}>
        <Text style={styles.metaText}>Generado: {new Date().toLocaleString("es-MX")}</Text>
        <Text style={styles.metaText}>Data al: {data.dataDate}</Text>
        <Text style={styles.metaText}>
          Día hábil {data.avanceDias} de {data.diasHabiles} ({formatPct(data.pctAvanceDias)})
        </Text>
      </View>
    </View>
  );
}

function KpiBoxes({ data }: { data: ReportData }) {
  // Solo se muestran en modo "all" o "multi"
  if (data.mode.kind === "single" || !data.ventaDiaPorDivision) {
    return null;
  }
  const v = data.ventaDiaPorDivision;
  return (
    <View style={styles.kpiBox}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Venta del día · Foodservice</Text>
        <Text style={styles.kpiValue}>{formatMoneyExact(v.Foodservice)}</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Venta del día · Distribuidores</Text>
        <Text style={styles.kpiValue}>{formatMoneyExact(v.Distribuidores)}</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Venta del día · Retail</Text>
        <Text style={styles.kpiValue}>{formatMoneyExact(v.Retail)}</Text>
      </View>
    </View>
  );
}

function SingleTerritoryKpis({ data }: { data: ReportData }) {
  if (!data.singleTerritoryKpis) return null;
  const k = data.singleTerritoryKpis;
  return (
    <View style={[styles.kpiBox, { marginBottom: 14 }]}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Avance del mes</Text>
        <Text style={styles.kpiValue}>{formatMoneyExact(k.avance)}</Text>
        <Text style={styles.kpiSub}>{formatPct(k.pctVsObjetivo)} vs Objetivo</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Objetivo del mes</Text>
        <Text style={styles.kpiValue}>{formatMoneyExact(k.objetivo)}</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Proyección al cierre</Text>
        <Text style={styles.kpiValue}>{formatMoneyExact(k.proyeccion)}</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Margen %</Text>
        <Text style={styles.kpiValue}>{formatPct(k.marginPct)}</Text>
        <Text style={styles.kpiSub}>Venta del día: {formatMoneyExact(k.ventaDia)}</Text>
      </View>
    </View>
  );
}

// === Tabla resumen Pesos (Por División / Por Empresa / Por Territorio) ===
function SummaryTable({
  title,
  rows,
  showMargin,
  nameHeader,
}: {
  title: string;
  rows: ReportSummaryRow[];
  showMargin: boolean;
  nameHeader: string;
}) {
  if (rows.length === 0) return null;
  // Anchos relativos: con 7 columnas (nombre + 4 numéricas + 1 pct + 1 var)
  // ó 8 (cuando showMargin agrega Margen %).
  const W_NAME = 20;
  const W_NUM = 11;
  const W_PCT = 7;
  const W_VAR = 7;

  // Computar TOTAL como suma de todas las filas.
  const sum = (k: keyof ReportSummaryRow) =>
    rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const objetivoT = sum("objetivo");
  const avanceT = sum("avance");
  const proyeccionT = sum("proyeccion");
  const avance25T = sum("avance2025AlDia");
  const pctTotal = objetivoT > 0 ? proyeccionT / objetivoT : 0;
  const varTotal: number | null =
    avance25T > 0 ? (avanceT - avance25T) / avance25T : null;
  // Margen ponderado por avance
  const totalMargenAbs = rows.reduce(
    (s, r) => s + (r.marginPct || 0) * (r.avance || 0),
    0
  );
  const marginPctTotal = avanceT > 0 ? totalMargenAbs / avanceT : 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, { width: `${W_NAME}%` }]}>
            {nameHeader}
          </Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Objetivo</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Avance</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Proyección</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PCT}%` }]}>% Obj.</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>25 al-día</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_VAR}%` }]}>Var % 25</Text>
          {showMargin && (
            <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PCT}%` }]}>Mg %</Text>
          )}
        </View>
        {rows.map((r, i) => (
          <View
            key={r.name}
            style={i % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}
          >
            <Text style={[styles.cell, { width: `${W_NAME}%` }]}>{r.name}</Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_NUM}%` }]}>
              {formatMoney(r.objetivo)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_NUM}%` }]}>
              {formatMoney(r.avance)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_NUM}%` }]}>
              {formatMoney(r.proyeccion)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                styles.cellBold,
                {
                  width: `${W_PCT}%`,
                  color:
                    r.pctVsObjetivo >= 1
                      ? COLORS.success
                      : r.pctVsObjetivo >= 0.9
                        ? COLORS.warning
                        : COLORS.danger,
                },
              ]}
            >
              {formatPct(r.pctVsObjetivo)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                { width: `${W_NUM}%`, color: COLORS.textSecondary },
              ]}
            >
              {formatMoney(r.avance2025AlDia)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                styles.cellBold,
                {
                  width: `${W_VAR}%`,
                  color:
                    r.varVsAnio === null
                      ? COLORS.textMuted
                      : r.varVsAnio >= 0
                        ? COLORS.success
                        : COLORS.danger,
                },
              ]}
            >
              {r.varVsAnio === null
                ? "—"
                : `${r.varVsAnio >= 0 ? "+" : ""}${formatPct(r.varVsAnio)}`}
            </Text>
            {showMargin && (
              <Text style={[styles.cell, styles.cellRight, { width: `${W_PCT}%`, color: COLORS.textSecondary }]}>
                {formatPct(r.marginPct ?? 0)}
              </Text>
            )}
          </View>
        ))}
        <View style={styles.tableTotalRow}>
          <Text style={[styles.cellBold, { width: `${W_NAME}%` }]}>TOTAL</Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
            {formatMoney(objetivoT)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
            {formatMoney(avanceT)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
            {formatMoney(proyeccionT)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_PCT}%` }]}>
            {formatPct(pctTotal)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%`, color: COLORS.textSecondary }]}>
            {formatMoney(avance25T)}
          </Text>
          <Text
            style={[
              styles.cellBold,
              styles.cellRight,
              {
                width: `${W_VAR}%`,
                color:
                  varTotal === null
                    ? COLORS.textMuted
                    : varTotal >= 0
                      ? COLORS.success
                      : COLORS.danger,
              },
            ]}
          >
            {varTotal === null
              ? "—"
              : `${varTotal >= 0 ? "+" : ""}${formatPct(varTotal)}`}
          </Text>
          {showMargin && (
            <Text style={[styles.cellBold, styles.cellRight, { width: `${W_PCT}%` }]}>
              {formatPct(marginPctTotal)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// === Tabla Kilos por Territorio (vs cierre 2025) ===
function KilosTable({ rows }: { rows: ReportKilosRow[] }) {
  if (rows.length === 0) return null;
  const W_NAME = 28;
  const W_NUM = 16;
  const W_VAR = 12;
  const kg26T = rows.reduce((s, r) => s + r.kg26, 0);
  const kg25T = rows.reduce((s, r) => s + r.kg25, 0);
  const deltaT = kg26T - kg25T;
  const varT = kg25T > 0 ? deltaT / kg25T : null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kilos por Territorio · vs cierre 2025</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, { width: `${W_NAME}%` }]}>Territorio</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>KG Mes</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>KG 25 cierre</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Δ KG</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_VAR}%` }]}>Var %</Text>
        </View>
        {rows.map((r, i) => (
          <View
            key={r.name}
            style={i % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}
          >
            <Text style={[styles.cell, { width: `${W_NAME}%` }]}>{r.name}</Text>
            <Text style={[styles.cell, styles.cellRight, styles.cellBold, { width: `${W_NUM}%` }]}>
              {formatKilos(r.kg26)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_NUM}%`, color: COLORS.textSecondary }]}>
              {formatKilos(r.kg25)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                {
                  width: `${W_NUM}%`,
                  color: r.deltaKg >= 0 ? COLORS.success : COLORS.danger,
                },
              ]}
            >
              {r.deltaKg >= 0 ? "+" : ""}
              {formatKilos(Math.abs(r.deltaKg))}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                styles.cellBold,
                {
                  width: `${W_VAR}%`,
                  color:
                    r.varVsAnio === null
                      ? COLORS.textMuted
                      : r.varVsAnio >= 0
                        ? COLORS.success
                        : COLORS.danger,
                },
              ]}
            >
              {r.varVsAnio === null
                ? "—"
                : `${r.varVsAnio >= 0 ? "+" : ""}${formatPct(r.varVsAnio)}`}
            </Text>
          </View>
        ))}
        <View style={styles.tableTotalRow}>
          <Text style={[styles.cellBold, { width: `${W_NAME}%` }]}>TOTAL</Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
            {formatKilos(kg26T)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%`, color: COLORS.textSecondary }]}>
            {formatKilos(kg25T)}
          </Text>
          <Text
            style={[
              styles.cellBold,
              styles.cellRight,
              {
                width: `${W_NUM}%`,
                color: deltaT >= 0 ? COLORS.success : COLORS.danger,
              },
            ]}
          >
            {deltaT >= 0 ? "+" : ""}
            {formatKilos(Math.abs(deltaT))}
          </Text>
          <Text
            style={[
              styles.cellBold,
              styles.cellRight,
              {
                width: `${W_VAR}%`,
                color:
                  varT === null
                    ? COLORS.textMuted
                    : varT >= 0
                      ? COLORS.success
                      : COLORS.danger,
              },
            ]}
          >
            {varT === null
              ? "—"
              : `${varT >= 0 ? "+" : ""}${formatPct(varT)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// === Tabla Margen por Territorio (vs cierre 2025) ===
function MargenTable({ rows }: { rows: ReportMargenRow[] }) {
  if (rows.length === 0) return null;
  const W_NAME = 20;
  const W_NUM = 13;
  const W_PCT = 9;
  const W_PP = 9;
  const margen26T = rows.reduce((s, r) => s + r.margen26, 0);
  const margen25T = rows.reduce((s, r) => s + r.margen25, 0);
  const deltaT = margen26T - margen25T;
  // Para margen % total, ponderado por venta
  const venta26T = rows.reduce(
    (s, r) => s + (r.marginPct26 > 0 ? r.margen26 / r.marginPct26 : 0),
    0
  );
  const venta25T = rows.reduce(
    (s, r) => s + (r.marginPct25 > 0 ? r.margen25 / r.marginPct25 : 0),
    0
  );
  const marginPct26T = venta26T > 0 ? margen26T / venta26T : 0;
  const marginPct25T = venta25T > 0 ? margen25T / venta25T : 0;
  const deltaPpT = (marginPct26T - marginPct25T) * 100;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Margen por Territorio · vs cierre 2025</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, { width: `${W_NAME}%` }]}>Territorio</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Mg $ Mes</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PCT}%` }]}>Mg %</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Mg $ 25 cierre</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PCT}%` }]}>Mg % 25</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Δ $</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PP}%` }]}>Δ pp</Text>
        </View>
        {rows.map((r, i) => (
          <View
            key={r.name}
            style={i % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}
          >
            <Text style={[styles.cell, { width: `${W_NAME}%` }]}>{r.name}</Text>
            <Text style={[styles.cell, styles.cellRight, styles.cellBold, { width: `${W_NUM}%` }]}>
              {formatMoney(r.margen26)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_PCT}%` }]}>
              {formatPct(r.marginPct26)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_NUM}%`, color: COLORS.textSecondary }]}>
              {formatMoney(r.margen25)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: `${W_PCT}%`, color: COLORS.textSecondary }]}>
              {formatPct(r.marginPct25)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                {
                  width: `${W_NUM}%`,
                  color: r.deltaMargen >= 0 ? COLORS.success : COLORS.danger,
                },
              ]}
            >
              {r.deltaMargen >= 0 ? "+" : ""}
              {formatMoney(Math.abs(r.deltaMargen))}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                styles.cellBold,
                {
                  width: `${W_PP}%`,
                  color: r.deltaPp >= 0 ? COLORS.success : COLORS.danger,
                },
              ]}
            >
              {r.deltaPp >= 0 ? "+" : ""}
              {r.deltaPp.toFixed(1)} pp
            </Text>
          </View>
        ))}
        <View style={styles.tableTotalRow}>
          <Text style={[styles.cellBold, { width: `${W_NAME}%` }]}>TOTAL</Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
            {formatMoney(margen26T)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_PCT}%` }]}>
            {formatPct(marginPct26T)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%`, color: COLORS.textSecondary }]}>
            {formatMoney(margen25T)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: `${W_PCT}%`, color: COLORS.textSecondary }]}>
            {formatPct(marginPct25T)}
          </Text>
          <Text
            style={[
              styles.cellBold,
              styles.cellRight,
              {
                width: `${W_NUM}%`,
                color: deltaT >= 0 ? COLORS.success : COLORS.danger,
              },
            ]}
          >
            {deltaT >= 0 ? "+" : ""}
            {formatMoney(Math.abs(deltaT))}
          </Text>
          <Text
            style={[
              styles.cellBold,
              styles.cellRight,
              {
                width: `${W_PP}%`,
                color: deltaPpT >= 0 ? COLORS.success : COLORS.danger,
              },
            ]}
          >
            {deltaPpT >= 0 ? "+" : ""}
            {deltaPpT.toFixed(1)} pp
          </Text>
        </View>
      </View>
    </View>
  );
}

// === Trend mensual (chart de barras simple, sin recharts) ===
function TrendChart({ data }: { data: ReportData }) {
  if (data.trendMensual.length === 0) return null;
  // Escala: el máximo entre todos los puntos + objetivo del slot actual
  const maxVal = Math.max(
    ...data.trendMensual.map((p) => Math.max(p.venta, p.objetivo ?? 0, p.proyeccion ?? 0))
  );
  if (maxVal <= 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tendencia mensual ({data.trendMensual.length} meses)</Text>
      <View style={styles.trendChart}>
        {data.trendMensual.map((p, i) => {
          const venta = p.venta;
          const obj = p.objetivo ?? 0;
          const proy = p.proyeccion ?? 0;
          const ventaH = (venta / maxVal) * 70;
          const objH = (obj / maxVal) * 70;
          const proyH = (proy / maxVal) * 70;
          return (
            <View key={i} style={styles.trendBarWrap}>
              {p.isCurrent ? (
                // Slot del mes actual: 3 barras lado a lado (objetivo, proyección, avance)
                <View style={{ flexDirection: "row", height: 72, alignItems: "flex-end", gap: 1 }}>
                  <View style={[{ width: 5, backgroundColor: COLORS.brown, height: objH }]} />
                  <View style={[{ width: 5, backgroundColor: COLORS.orangeDark, height: proyH }]} />
                  <View style={[{ width: 5, backgroundColor: COLORS.orange, height: ventaH }]} />
                </View>
              ) : (
                <View style={[styles.trendBar, { height: ventaH }]} />
              )}
              <Text style={styles.trendLabel}>{p.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 6, justifyContent: "center" }}>
        <Legend color={COLORS.orange} label="Avance" />
        <Legend color={COLORS.orangeDark} label="Proyección (mes actual)" />
        <Legend color={COLORS.brown} label="Objetivo (mes actual)" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <View style={{ width: 8, height: 8, backgroundColor: color }} />
      <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>{label}</Text>
    </View>
  );
}

// === Top 10 clientes (con comparativo año anterior) ===
function TopClientesTable({ data }: { data: ReportData }) {
  if (data.topClientes.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Top 10 Clientes · {data.monthShortYY} (al-día) vs año anterior
      </Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, { width: "8%" }]}>#</Text>
          <Text style={[styles.cellHeader, { width: "47%" }]}>Cliente</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "15%" }]}>
            {data.monthShortYY}
          </Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "15%" }]}>
            {data.monthShortYY.replace(/-\d+$/, (m) => `-${(parseInt(m.slice(1)) - 1).toString().padStart(2, "0")}`)}
          </Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "15%" }]}>Var %</Text>
        </View>
        {data.topClientes.map((r, i) => (
          <View
            key={r.cliente}
            style={i % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}
          >
            <Text style={[styles.cell, { width: "8%" }]}>{i + 1}</Text>
            <Text style={[styles.cell, { width: "47%" }]}>{r.cliente}</Text>
            <Text style={[styles.cell, styles.cellRight, styles.cellBold, { width: "15%" }]}>
              {formatMoney(r.ventaActual)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: "15%", color: COLORS.textSecondary }]}>
              {formatMoney(r.ventaAnio)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                styles.cellBold,
                {
                  width: "15%",
                  color:
                    r.varPct === null
                      ? COLORS.textMuted
                      : r.varPct >= 0
                        ? COLORS.success
                        : COLORS.danger,
                },
              ]}
            >
              {r.varPct === null ? "—" : `${r.varPct >= 0 ? "+" : ""}${formatPct(r.varPct)}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// === Tracking diario (con semáforo de vel. necesaria) ===
function TrackingDiarioTable({ data }: { data: ReportData }) {
  if (data.trackingDiario.length === 0) return null;
  const t = data.tracking;
  const totalVenta = t.acum;
  const totalMargen = t.marginMoney;
  const totalKg = t.acumKg;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tracking Diario · {data.monthLabel}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, { width: "6%" }]}>Día</Text>
          <Text style={[styles.cellHeader, { width: "6%" }]}>Dow</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "14%" }]}>Venta</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "16%" }]}>Acumulado</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "11%" }]}>% Ptto</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "16%" }]}>Vel. Nec.</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "13%" }]}>Margen</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "9%" }]}>Mg %</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: "9%" }]}>KG</Text>
        </View>
        {data.trackingDiario.map((r, i) => (
          <View
            key={r.dia}
            style={i % 2 === 0 ? styles.tableRow : [styles.tableRow, styles.tableRowAlt]}
          >
            <Text style={[styles.cell, { width: "6%" }]}>{r.dia}</Text>
            <Text style={[styles.cell, { width: "6%", color: COLORS.textSecondary }]}>
              {r.dow}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: "14%" }]}>
              {formatMoney(r.venta)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, styles.cellBold, { width: "16%" }]}>
              {formatMoney(r.acumulado)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: "11%", color: COLORS.textSecondary }]}>
              {formatPct(r.pctPtto)}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRight,
                styles.cellBold,
                { width: "16%", color: toneColor(r.velNecesTone) },
              ]}
            >
              {formatMoney(r.velNecesaria)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: "13%" }]}>
              {formatMoney(r.margen)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: "9%", color: COLORS.textSecondary }]}>
              {formatPct(r.marginPct)}
            </Text>
            <Text style={[styles.cell, styles.cellRight, { width: "9%", color: COLORS.textSecondary }]}>
              {r.kg.toFixed(0)}
            </Text>
          </View>
        ))}
        <View style={styles.tableTotalRow}>
          <Text style={[styles.cellBold, { width: "12%" }]}>TOTAL</Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: "14%" }]}>
            {formatMoney(totalVenta)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: "16%" }]}>
            {formatMoney(totalVenta)}
          </Text>
          <Text style={[styles.cell, styles.cellRight, { width: "11%" }]}>
            {formatPct(t.ptto > 0 ? totalVenta / t.ptto : 0)}
          </Text>
          <Text style={[styles.cell, styles.cellRight, { width: "16%" }]}>—</Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: "13%" }]}>
            {formatMoney(totalMargen)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: "9%" }]}>
            {formatPct(totalVenta > 0 ? totalMargen / totalVenta : 0)}
          </Text>
          <Text style={[styles.cellBold, styles.cellRight, { width: "9%" }]}>
            {totalKg.toFixed(0)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// === Footer fijo de página ===
function FooterFixed({ data }: { data: ReportData }) {
  return (
    <View style={styles.footer} fixed>
      <Text>InCom · Inteligencia Comercial Susazón®</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

// ============================================================
// Nuevos componentes — réplica del tab TrackingDiario
// ============================================================

/** Card de 1 stat con label/value/sub o subInline. Width controlada por el grid. */
function StatCard({
  label,
  value,
  valueTone,
  sub,
  subInline,
}: {
  label: string;
  value: string;
  valueTone?: "success" | "warning" | "danger" | "neutral";
  sub?: string;
  subInline?: string;
}) {
  const color = toneColor(valueTone ?? "neutral");
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      {subInline ? (
        <View style={styles.statValueWithInline}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statValueInline}>{subInline}</Text>
        </View>
      ) : (
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      )}
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

/** 8 stats vista PESOS (réplica exacta del tab). */
function StatsGridPesos({ data }: { data: ReportData }) {
  const t = data.tracking;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Resumen del mes · Pesos</Text>
      <View style={styles.statsGrid}>
        <StatCard
          label="Venta del Mes"
          value={formatMoneyExact(t.acum)}
          sub={`Día ${t.elapsedBizDays} de ${t.totalBizDays} · ${t.daysWithInvoice} con factura`}
        />
        <StatCard
          label="Alcance Ptto"
          value={t.hasPtto ? formatPctRaw(t.alcancePct) : "—"}
          sub={t.hasPtto ? `${formatMoneyExact(t.faltante)} faltante` : "Sin PTTO"}
        />
        <StatCard
          label="Margen $"
          value={formatMoneyExact(t.marginMoney)}
          subInline={formatPctRaw(t.marginPct)}
        />
        <StatCard
          label="vs Mismo Mes Año Ant."
          value={
            t.hasPrev
              ? `${t.yoyCh >= 0 ? "+" : ""}${t.yoyCh.toFixed(1)}%`
              : "—"
          }
          valueTone={t.hasPrev ? (t.yoyCh >= 0 ? "success" : "danger") : "neutral"}
          sub={
            t.hasPrev
              ? `vs ${formatMoneyExact(t.prevYearVenta)}`
              : "Sin data año ant."
          }
        />
        <StatCard
          label="Vel. Original"
          value={t.hasPtto ? formatMoneyExact(t.velOrig) : "—"}
          sub="meta/día"
        />
        <StatCard
          label="Vel. Actual"
          value={formatMoneyExact(t.velActual)}
          valueTone={
            t.hasPtto
              ? t.velActual >= t.velOrig
                ? "success"
                : "danger"
              : "neutral"
          }
          sub="meta/día"
        />
        <StatCard
          label="Vel. Necesaria"
          value={t.hasPtto ? formatMoneyExact(t.velNeces) : "—"}
          valueTone={
            t.hasPtto
              ? t.velNeces <= t.velOrig
                ? "success"
                : t.velNeces <= t.velOrig * 1.2
                  ? "warning"
                  : "danger"
              : "neutral"
          }
          sub="meta/día"
        />
        <StatCard
          label="Run Rate"
          value={formatMoneyExact(t.runRate)}
          sub={t.hasPtto ? `${t.runRatePct.toFixed(0)}% del ptto` : "Sin PTTO"}
        />
      </View>
    </View>
  );
}

/** 8 stats vista KILOS (réplica exacta del tab). */
function StatsGridKilos({ data }: { data: ReportData }) {
  const t = data.tracking;
  const kgSign = t.yoyKgPct >= 0 ? "+" : "";
  const kgSignDelta = t.yoyKgDelta >= 0 ? "+" : "";
  const kgArrow = t.yoyKgPct >= 0 ? "▲" : "▼";
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Resumen del mes · Kilos</Text>
      <View style={styles.statsGrid}>
        <StatCard
          label="KG del Mes"
          value={formatKilos(t.acumKg)}
          sub={`Día ${t.elapsedBizDays} de ${t.totalBizDays} · ${t.daysWithInvoice} con factura`}
        />
        <StatCard
          label="vs 2025"
          value={
            t.hasPrev
              ? `${kgArrow} ${Math.abs(t.yoyKgPct).toFixed(1)}%`
              : "—"
          }
          valueTone={t.hasPrev ? (t.yoyKgPct >= 0 ? "success" : "danger") : "neutral"}
          subInline={
            t.hasPrev
              ? `${kgSignDelta}${formatKilos(t.yoyKgDelta)}`
              : "Sin data año ant."
          }
        />
        <StatCard
          label="Margen $"
          value={formatMoneyExact(t.marginMoney)}
          subInline={formatPctRaw(t.marginPct)}
        />
        <StatCard
          label="vs Mismo Mes Año Ant."
          value={
            t.hasPrev
              ? `${kgSign}${t.yoyKgPct.toFixed(1)}%`
              : "—"
          }
          valueTone={t.hasPrev ? (t.yoyKgPct >= 0 ? "success" : "danger") : "neutral"}
          sub={
            t.hasPrev
              ? `vs ${formatKilos(t.prevYearKg)}`
              : "Sin data año ant."
          }
        />
        <StatCard
          label="Pace 2025"
          value={t.hasPrev ? formatKilos(t.pace2025) : "—"}
          sub="kg/día"
        />
        <StatCard
          label="Vel. Actual"
          value={formatKilos(t.velActualKg)}
          valueTone={
            t.hasPrev
              ? t.velActualKg >= t.pace2025
                ? "success"
                : "danger"
              : "neutral"
          }
          sub="kg/día"
        />
        <StatCard
          label="Falta para igualar 2025"
          value={
            !t.hasPrev
              ? "—"
              : t.ySuperaste
                ? "✓ Ya superaste"
                : t.mesCerradoSinSuperar
                  ? "✗ No alcanzado"
                  : formatKilos(t.faltaIgualarKg)
          }
          valueTone={
            !t.hasPrev
              ? "neutral"
              : t.ySuperaste
                ? "success"
                : t.mesCerradoSinSuperar
                  ? "danger"
                  : t.faltaIgualarKg <= t.pace2025
                    ? "warning"
                    : "danger"
          }
          sub={
            !t.hasPrev
              ? "Sin data año ant."
              : t.mesCerradoSinSuperar
                ? `-${formatKilos(t.kgGapAbs)} vs 2025`
                : "kg/día"
          }
        />
        <StatCard
          label="Run Rate KG"
          value={formatKilos(t.runRateKg)}
          sub={
            t.hasPrev
              ? `${t.pctVs2025.toFixed(0)}% de 2025 (proy.)`
              : "Sin data año ant."
          }
        />
      </View>
    </View>
  );
}

/** Progress bar Pesos: avance acumulado vs PTTO con semáforo de brecha
 *  acumulada vs avance temporal. */
function ProgressBarPesos({ data }: { data: ReportData }) {
  const t = data.tracking;
  if (!t.hasPtto) return null;
  const fillPct = Math.min(100, t.alcancePct);
  const fillColor = toneColor(t.progressTone);
  const brechaLabel = t.brechaPp >= 0 ? "AVANZADO" : "REZAGADO";
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Avance vs Presupuesto</Text>
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${fillPct}%`, backgroundColor: fillColor },
            ]}
          >
            {fillPct >= 12 && (
              <Text style={styles.progressLabel}>
                {formatMoneyExact(t.acum)} ({t.alcancePct.toFixed(0)}%)
              </Text>
            )}
          </View>
        </View>
        <View style={styles.progressMetaRow}>
          <Text style={styles.progressMetaText}>
            PTTO: {formatMoneyExact(t.ptto)} · Tiempo transcurrido:{" "}
            {t.tiempoPct.toFixed(0)}%
          </Text>
          <Text style={[styles.progressBadge, { backgroundColor: fillColor }]}>
            {brechaLabel} {t.brechaPp >= 0 ? "+" : ""}
            {t.brechaPp.toFixed(1)} pp
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Chart compuesto Pesos: barras (venta diaria) + 3 líneas (acumulado,
 *  ptto lineal, acumulado año anterior). Dibujado con SVG nativo de
 *  @react-pdf (no recharts). */
function DailyChart({ data }: { data: ReportData }) {
  const pts = data.tracking.chartData;
  if (pts.length === 0) return null;

  // Dimensiones del SVG. Letter width usable ≈ 540pt con paddingHorizontal 28.
  const W = 540;
  const H = 200;
  const padTop = 14;
  const padBottom = 26;
  const padLeft = 38;
  const padRight = 38;

  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  // Escalas
  const days = pts.map((p) => p.day);
  const maxDay = Math.max(...days);
  const minDay = Math.min(...days);
  const dayRange = Math.max(1, maxDay - minDay);

  const maxBar = Math.max(0, ...pts.map((p) => p.ventaDiaria));
  // Para el eje izquierdo (escala compartida pero podemos manejar barras vs
  // líneas con el mismo eje porque acumulado >> diaria, así que la barra
  // diaria queda chiquita. Mejor uso 2 escalas como en el tab.)
  const maxLine = Math.max(
    0,
    ...pts.map((p) => Math.max(p.acumulado, p.pttoLinear, p.anoAnterior))
  );

  // Helpers de coordenadas
  const xOf = (day: number) =>
    padLeft + ((day - minDay) / dayRange) * innerW;
  const yBarTop = (value: number) =>
    maxBar > 0 ? padTop + innerH - (value / maxBar) * (innerH * 0.4) : padTop + innerH;
  // Las barras ocupan los primeros 40% verticales (parte de abajo)
  const yLine = (value: number) =>
    maxLine > 0
      ? padTop + innerH - (value / maxLine) * innerH
      : padTop + innerH;

  // Build polyline points (acumulado, ptto, año ant.)
  const acumStr = pts.map((p) => `${xOf(p.day)},${yLine(p.acumulado)}`).join(" ");
  const pttoStr = pts.map((p) => `${xOf(p.day)},${yLine(p.pttoLinear)}`).join(" ");
  const anioStr = pts.map((p) => `${xOf(p.day)},${yLine(p.anoAnterior)}`).join(" ");

  // Ancho de cada barra
  const barW = Math.max(2, Math.min(18, (innerW / pts.length) * 0.55));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Tendencia diaria · {data.monthLabel} (barras: venta del día · líneas: acumulado)
      </Text>
      <Svg width={W} height={H}>
        {/* Ejes/grid suave */}
        <SvgLine
          x1={padLeft}
          y1={padTop + innerH}
          x2={padLeft + innerW}
          y2={padTop + innerH}
          stroke={COLORS.borderStrong}
          strokeWidth={0.5}
        />
        <SvgLine
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerH}
          stroke={COLORS.border}
          strokeWidth={0.3}
        />
        {/* Líneas horizontales tenues cada 25% */}
        {[0.25, 0.5, 0.75].map((f) => (
          <SvgLine
            key={f}
            x1={padLeft}
            y1={padTop + innerH * (1 - f)}
            x2={padLeft + innerW}
            y2={padTop + innerH * (1 - f)}
            stroke={COLORS.border}
            strokeWidth={0.3}
            strokeDasharray="2 2"
          />
        ))}

        {/* Barras venta diaria */}
        {pts.map((p) => {
          const x = xOf(p.day) - barW / 2;
          const y = yBarTop(p.ventaDiaria);
          const h = padTop + innerH - y;
          if (p.ventaDiaria <= 0) return null;
          return (
            <Rect
              key={`bar-${p.day}`}
              x={x}
              y={y}
              width={barW}
              height={Math.max(0.5, h)}
              fill={COLORS.orange}
              fillOpacity={0.5}
            />
          );
        })}

        {/* Línea año anterior (gris claro) */}
        <Polyline
          points={anioStr}
          stroke={COLORS.textMuted}
          strokeWidth={0.8}
          fill="none"
          strokeDasharray="3 2"
        />
        {/* Línea PTTO lineal (marrón) */}
        <Polyline
          points={pttoStr}
          stroke={COLORS.brown}
          strokeWidth={0.8}
          fill="none"
          strokeDasharray="4 2"
        />
        {/* Línea acumulado (naranja) */}
        <Polyline
          points={acumStr}
          stroke={COLORS.orangeDark}
          strokeWidth={1.4}
          fill="none"
        />
      </Svg>

      {/* Labels eje X simulados — solo cada 3 días para no saturar */}
      <View
        style={{
          flexDirection: "row",
          paddingLeft: padLeft,
          paddingRight: padRight,
          marginTop: -22,
          marginBottom: 4,
        }}
      >
        {labelDaysEvery(pts, 3).map((p) => (
          <View
            key={p.day}
            style={{
              position: "absolute",
              left: xOf(p.day) - 6,
              top: 4,
            }}
          >
            <Text style={{ fontSize: 6, color: COLORS.textMuted }}>{p.day}</Text>
          </View>
        ))}
      </View>

      {/* Leyenda */}
      <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 4 }}>
        <Legend color={COLORS.orange} label="Venta del día" />
        <Legend color={COLORS.orangeDark} label="Venta acumulada" />
        <Legend color={COLORS.brown} label="PTTO lineal" />
        <Legend color={COLORS.textMuted} label="Acum. año anterior" />
      </View>
    </View>
  );
}

/** Filtra puntos para mostrar cada N días en eje X. */
function labelDaysEvery(pts: TrackingChartPoint[], step: number): TrackingChartPoint[] {
  const out: TrackingChartPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i % step === 0 || i === pts.length - 1) out.push(pts[i]);
  }
  return out;
}

// ============================================================
// Documento PDF principal
// ============================================================

export function AvanceComercialPDF({ data }: { data: ReportData }) {
  return (
    <Document
      title={`Avance Comercial ${data.monthLabel}`}
      author="InCom · Susazón"
      subject="Reporte de avance comercial"
    >
      {/* === Página 1: réplica del tab Tracking Diario === */}
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        <FooterFixed data={data} />

        {/* 8 stats Pesos arriba */}
        <StatsGridPesos data={data} />

        {/* 8 stats Kilos abajo */}
        <StatsGridKilos data={data} />

        {/* Progress bar avance vs PTTO */}
        <ProgressBarPesos data={data} />

        {/* Chart compuesto (barras venta diaria + líneas acumulado/ptto/año ant) */}
        <DailyChart data={data} />
      </Page>

      {/* === Página 2: Avance Comercial por dimensión (estilo AvComSS) ===
          Se auto-pagina si las 5 tablas se desbordan. */}
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        <FooterFixed data={data} />

        {data.porDivision && (
          <SummaryTable
            title="Por División (canal)"
            rows={data.porDivision}
            showMargin={false}
            nameHeader="División"
          />
        )}
        {data.porEmpresa && data.porEmpresa.length > 0 && (
          <SummaryTable
            title="Por Empresa"
            rows={data.porEmpresa}
            showMargin={false}
            nameHeader="Empresa"
          />
        )}
        {data.porTerritorio && data.porTerritorio.length > 0 && (
          <SummaryTable
            title="Pesos por Territorio"
            rows={data.porTerritorio}
            showMargin
            nameHeader="Territorio"
          />
        )}
        {data.porTerritorioKilos && data.porTerritorioKilos.length > 0 && (
          <KilosTable rows={data.porTerritorioKilos} />
        )}
        {data.porTerritorioMargen && data.porTerritorioMargen.length > 0 && (
          <MargenTable rows={data.porTerritorioMargen} />
        )}
      </Page>

      {/* === Página 3: Top 10 Clientes + Tracking Diario detallado === */}
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        <FooterFixed data={data} />
        <TopClientesTable data={data} />
        <TrackingDiarioTable data={data} />
      </Page>
    </Document>
  );
}
