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
} from "@react-pdf/renderer";
import type { ReportData } from "./types";

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

  // === Trend chart simulado (rectángulos) ===
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

// === Tabla genérica resumen ===
function SummaryTable({
  title,
  rows,
  showMargin,
  totalRow,
}: {
  title: string;
  rows: { name: string; objetivo: number; avance: number; proyeccion: number; pctVsObjetivo: number; marginPct?: number }[];
  showMargin: boolean;
  totalRow?: { objetivo: number; avance: number; proyeccion: number; pctVsObjetivo: number; marginPct?: number };
}) {
  // Anchos relativos
  const W_NAME = 26;
  const W_NUM = 14;
  const W_PCT = 9;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.cellHeader, { width: `${W_NAME}%` }]}>División</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Objetivo</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Avance</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_NUM}%` }]}>Proyección</Text>
          <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PCT}%` }]}>% Obj.</Text>
          {showMargin && (
            <Text style={[styles.cellHeader, styles.cellRight, { width: `${W_PCT}%` }]}>Margen %</Text>
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
            <Text style={[styles.cell, styles.cellRight, styles.cellBold, { width: `${W_PCT}%`, color: r.pctVsObjetivo >= 1 ? COLORS.success : r.pctVsObjetivo >= 0.9 ? COLORS.warning : COLORS.danger }]}>
              {formatPct(r.pctVsObjetivo)}
            </Text>
            {showMargin && (
              <Text style={[styles.cell, styles.cellRight, { width: `${W_PCT}%`, color: COLORS.textSecondary }]}>
                {formatPct(r.marginPct ?? 0)}
              </Text>
            )}
          </View>
        ))}
        {totalRow && (
          <View style={styles.tableTotalRow}>
            <Text style={[styles.cellBold, { width: `${W_NAME}%` }]}>TOTAL</Text>
            <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
              {formatMoney(totalRow.objetivo)}
            </Text>
            <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
              {formatMoney(totalRow.avance)}
            </Text>
            <Text style={[styles.cellBold, styles.cellRight, { width: `${W_NUM}%` }]}>
              {formatMoney(totalRow.proyeccion)}
            </Text>
            <Text style={[styles.cellBold, styles.cellRight, { width: `${W_PCT}%` }]}>
              {formatPct(totalRow.pctVsObjetivo)}
            </Text>
            {showMargin && (
              <Text style={[styles.cellBold, styles.cellRight, { width: `${W_PCT}%` }]}>
                {formatPct(totalRow.marginPct ?? 0)}
              </Text>
            )}
          </View>
        )}
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

// === Tracking diario ===
function TrackingDiarioTable({ data }: { data: ReportData }) {
  if (data.trackingDiario.length === 0) return null;
  const totalVenta = data.totalAvance;
  const totalMargen = data.trackingDiario.reduce((s, r) => s + r.margen, 0);
  const totalKg = data.trackingDiario.reduce((s, r) => s + r.kg, 0);
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
            <Text style={[styles.cell, styles.cellRight, { width: "16%" }]}>
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
            {formatPct(data.totalObjetivo > 0 ? totalVenta / data.totalObjetivo : 0)}
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
// Documento PDF principal
// ============================================================

export function AvanceComercialPDF({ data }: { data: ReportData }) {
  const totalRow = {
    objetivo: data.totalObjetivo,
    avance: data.totalAvance,
    proyeccion: data.totalProyeccion,
    pctVsObjetivo: data.totalPctVsObjetivo,
    marginPct: data.totalMarginPct,
  };

  return (
    <Document
      title={`Avance Comercial ${data.monthLabel}`}
      author="InCom · Susazón"
      subject="Reporte de avance comercial"
    >
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        <FooterFixed data={data} />

        {/* Modo SINGLE: KPIs del territorio focalizado */}
        {data.mode.kind === "single" && <SingleTerritoryKpis data={data} />}

        {/* Modo MULTI/ALL: KPIs de venta del día por división */}
        <KpiBoxes data={data} />

        {/* Tendencia mensual */}
        <TrendChart data={data} />

        {/* Tablas Por División / Por Empresa (solo multi/all) */}
        {data.mode.kind !== "single" && data.porDivision && (
          <SummaryTable
            title="Por División (canal)"
            rows={data.porDivision}
            showMargin={false}
            totalRow={totalRow}
          />
        )}
        {data.mode.kind !== "single" && data.porEmpresa && data.porEmpresa.length > 1 && (
          <SummaryTable
            title="Por Empresa"
            rows={data.porEmpresa}
            showMargin={false}
            totalRow={totalRow}
          />
        )}

        {/* Tabla Por Territorio (siempre, con margen) */}
        {data.porTerritorio && data.porTerritorio.length > 0 && (
          <SummaryTable
            title="Por Territorio"
            rows={data.porTerritorio}
            showMargin
            totalRow={totalRow}
          />
        )}
      </Page>

      {/* Página 2: agregados (Top Clientes + Tracking Diario) */}
      <Page size="LETTER" style={styles.page}>
        <Header data={data} />
        <FooterFixed data={data} />
        <TopClientesTable data={data} />
        <TrackingDiarioTable data={data} />
      </Page>
    </Document>
  );
}
