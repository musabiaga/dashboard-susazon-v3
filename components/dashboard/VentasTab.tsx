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
import type { TerritoryKpi } from "@/components/dashboard/Sidebar";
import { ChartLegend } from "@/components/dashboard/ChartLegend";
import { ExportExcelButton } from "@/components/dashboard/ExportExcelButton";
import { ReportButton } from "@/components/dashboard/ReportButton";
import type { BuildReportInput } from "@/lib/report-pdf/data";
import type {
  ExcelColumn,
  ExcelSummaryRow,
} from "@/lib/export-excel";

type VentasViewMode = "pesos" | "kg";
const VENTAS_MODE_KEY = "ventas-tab-mode";

const MONTHS_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTHS_LONG_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Props {
  kpi: TerritoryKpi;
  // Hasta qué (anio, mes) hay data real. Después de esto las celdas son null.
  // Uso: en abril 2026, May-Dic 2026 son null (mes futuro).
  cutoffYear: number;
  cutoffMonth: number; // 1-12
  /** Territorio activo para resumen + filename del Excel ("" = "Todos"). */
  exportTerritory?: string;
  /** Etiqueta de periodo para el resumen del Excel. */
  exportPeriodLabel?: string;
  /** Permiso para descargar Excel (default false). */
  canExportExcel?: boolean;
  /** Input para el reporte PDF "Avance Comercial". */
  reportInput?: BuildReportInput | null;
}

/**
 * Tab Ventas — replica V2.2:
 *   - Bar chart vertical con 12 meses (Ene-Dic) en eje X
 *   - 3 series de barras: Venta 2024 (gris), Venta 2025 (azul), Venta 2026 (verde)
 *   - 3 series de líneas: Margen% 2024/2025/2026 sobre eje Y derecho (0-50%)
 *   - Meses futuros (después de cutoff) quedan vacíos (no fuerzan a 0).
 */
export function VentasTab({
  kpi,
  cutoffYear,
  cutoffMonth,
  exportTerritory = "",
  exportPeriodLabel,
  canExportExcel = false,
  reportInput = null,
}: Props) {
  // ============ Toggle Pesos / Kilos ============
  // Default = "pesos". Persiste en localStorage para que la preferencia
  // sobreviva entre sesiones. El margen % NO cambia con el toggle —
  // siempre se muestra como (margen $ / venta $) × 100 sobre el eje Y
  // derecho, para que se pueda ver el comportamiento del margen vs el
  // volumen de venta (en pesos o en kilos).
  const [mode, setMode] = useState<VentasViewMode>("pesos");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VENTAS_MODE_KEY);
      if (saved === "kg" || saved === "pesos") setMode(saved);
    } catch {
      // ignore
    }
  }, []);
  const switchMode = (next: VentasViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VENTAS_MODE_KEY, next);
    } catch {
      // ignore
    }
  };
  const isKg = mode === "kg";

  const chartData = useMemo(() => {
    // Index por (anio, mes) → MonthlyPoint
    const byKey = new Map<string, { v: number; m: number; k: number }>();
    for (const p of kpi.monthly) {
      byKey.set(`${p.anio}-${p.mes}`, {
        v: p.venta,
        m: p.margen,
        k: p.kg,
      });
    }

    // 12 filas, una por mes. Cada fila tiene venta y margen% por año.
    // Mejora 2 Commit B: el slot del mes actual usa barras apiladas
    // (al-día sólido + resto translúcido). Los demás meses se ven igual.
    const ald = kpi.currentMonthAlDia;
    return MONTHS_SHORT_ES.map((label, i) => {
      const mes = i + 1;
      const get = (anio: number) => byKey.get(`${anio}-${mes}`);
      const future = (anio: number) =>
        anio > cutoffYear || (anio === cutoffYear && mes > cutoffMonth);
      const isCurrentSlot = mes === cutoffMonth; // mes actual

      const v24 = get(2024);
      const v25 = get(2025);
      const v26 = get(2026);

      // null en futuro para que la barra/línea no aparezca
      const venta24 = future(2024) ? null : v24?.v ?? 0;
      const venta25 = future(2025) ? null : v25?.v ?? 0;
      const venta26 = future(2026) ? null : v26?.v ?? 0;
      const kg24Raw = future(2024) ? null : v24?.k ?? 0;
      const kg25Raw = future(2025) ? null : v25?.k ?? 0;
      const kg26Raw = future(2026) ? null : v26?.k ?? 0;

      // Para el slot del mes actual, calculamos al-día y resto.
      // Para los demás meses, al-día = cierre y resto = 0 (las barras
      // se ven idénticas a una barra simple porque el segmento translúcido
      // tiene altura 0).
      const v24AlDia = isCurrentSlot && ald
        ? Math.min(venta24 ?? 0, ald.v24)
        : (venta24 ?? 0);
      const v25AlDia = isCurrentSlot && ald
        ? Math.min(venta25 ?? 0, ald.v25)
        : (venta25 ?? 0);
      const v26AlDia = isCurrentSlot && ald
        ? Math.min(venta26 ?? 0, ald.v26)
        : (venta26 ?? 0);
      const v24Rest = isCurrentSlot && ald
        ? Math.max(0, (venta24 ?? 0) - v24AlDia)
        : 0;
      const v25Rest = isCurrentSlot && ald
        ? Math.max(0, (venta25 ?? 0) - v25AlDia)
        : 0;
      const v26Rest = isCurrentSlot && ald
        ? Math.max(0, (venta26 ?? 0) - v26AlDia)
        : 0;

      // Mismo patrón al-día / resto pero para KG.
      const k24AlDia = isCurrentSlot && ald
        ? Math.min(kg24Raw ?? 0, ald.k24)
        : (kg24Raw ?? 0);
      const k25AlDia = isCurrentSlot && ald
        ? Math.min(kg25Raw ?? 0, ald.k25)
        : (kg25Raw ?? 0);
      const k26AlDia = isCurrentSlot && ald
        ? Math.min(kg26Raw ?? 0, ald.k26)
        : (kg26Raw ?? 0);
      const k24Rest = isCurrentSlot && ald
        ? Math.max(0, (kg24Raw ?? 0) - k24AlDia)
        : 0;
      const k25Rest = isCurrentSlot && ald
        ? Math.max(0, (kg25Raw ?? 0) - k25AlDia)
        : 0;
      const k26Rest = isCurrentSlot && ald
        ? Math.max(0, (kg26Raw ?? 0) - k26AlDia)
        : 0;

      // Margen % = margen $ / venta $ × 100. NO depende del modo del
      // toggle — siempre se calcula así, para ver el margen vs venta
      // tanto cuando las barras muestran pesos como cuando muestran kg.
      const margenPct = (
        agg: { v: number; m: number } | undefined
      ): number | null =>
        agg && agg.v > 0 ? (agg.m / agg.v) * 100 : null;

      return {
        month: label,
        // Pesos (cierre + al-día apilado)
        venta24,
        venta25,
        venta26,
        venta24_alDia: future(2024) ? null : v24AlDia,
        venta25_alDia: future(2025) ? null : v25AlDia,
        venta26_alDia: future(2026) ? null : v26AlDia,
        __rest_v24: future(2024) ? null : v24Rest,
        __rest_v25: future(2025) ? null : v25Rest,
        __rest_v26: future(2026) ? null : v26Rest,
        // Kilos (mismo patrón cierre + al-día apilado)
        kg24: kg24Raw,
        kg25: kg25Raw,
        kg26: kg26Raw,
        kg24_alDia: future(2024) ? null : k24AlDia,
        kg25_alDia: future(2025) ? null : k25AlDia,
        kg26_alDia: future(2026) ? null : k26AlDia,
        __rest_k24: future(2024) ? null : k24Rest,
        __rest_k25: future(2025) ? null : k25Rest,
        __rest_k26: future(2026) ? null : k26Rest,
        // Flag para que el tooltip sepa si mostrar info de día-vs-día
        __isCurrentSlot: isCurrentSlot,
        // Margen % se calcula a partir de venta $ siempre (no depende del modo).
        margenPct24: future(2024) ? null : margenPct(v24),
        margenPct25: future(2025) ? null : margenPct(v25),
        margenPct26: future(2026) ? null : margenPct(v26),
      };
    });
  }, [kpi.monthly, kpi.currentMonthAlDia, cutoffYear, cutoffMonth]);

  // ============ Export Excel ============
  const handleExportExcel = async () => {
    const { exportToExcel, sanitizeFileName, todayISO } = await import(
      "@/lib/export-excel"
    );
    const territorioLabel =
      exportTerritory && exportTerritory !== "" ? exportTerritory : "Todos";

    // Re-construir data full (con venta + margen + kg + al-día) — no
    // podemos reusar chartData porque no carga margen $ desagregado.
    const byKey = new Map<string, { v: number; m: number; k: number }>();
    for (const p of kpi.monthly) {
      byKey.set(`${p.anio}-${p.mes}`, {
        v: p.venta,
        m: p.margen,
        k: p.kg,
      });
    }
    const ald = kpi.currentMonthAlDia;

    const xlsxRows = MONTHS_SHORT_ES.map((label, i) => {
      const mes = i + 1;
      const get = (anio: number) => byKey.get(`${anio}-${mes}`);
      const future = (anio: number) =>
        anio > cutoffYear || (anio === cutoffYear && mes > cutoffMonth);
      const isCurrentSlot = mes === cutoffMonth;

      const v24 = get(2024);
      const v25 = get(2025);
      const v26 = get(2026);

      const venta24 = future(2024) ? null : v24?.v ?? 0;
      const venta25 = future(2025) ? null : v25?.v ?? 0;
      const venta26 = future(2026) ? null : v26?.v ?? 0;
      const margen24 = future(2024) ? null : v24?.m ?? 0;
      const margen25 = future(2025) ? null : v25?.m ?? 0;
      const margen26 = future(2026) ? null : v26?.m ?? 0;
      const kg24 = future(2024) ? null : v24?.k ?? 0;
      const kg25 = future(2025) ? null : v25?.k ?? 0;
      const kg26 = future(2026) ? null : v26?.k ?? 0;

      const v24Ald =
        isCurrentSlot && ald ? Math.min(venta24 ?? 0, ald.v24) : venta24;
      const v25Ald =
        isCurrentSlot && ald ? Math.min(venta25 ?? 0, ald.v25) : venta25;
      const v26Ald =
        isCurrentSlot && ald ? Math.min(venta26 ?? 0, ald.v26) : venta26;
      const m24Ald =
        isCurrentSlot && ald ? Math.min(margen24 ?? 0, ald.m24) : margen24;
      const m25Ald =
        isCurrentSlot && ald ? Math.min(margen25 ?? 0, ald.m25) : margen25;
      const m26Ald =
        isCurrentSlot && ald ? Math.min(margen26 ?? 0, ald.m26) : margen26;
      const k24Ald =
        isCurrentSlot && ald ? Math.min(kg24 ?? 0, ald.k24) : kg24;
      const k25Ald =
        isCurrentSlot && ald ? Math.min(kg25 ?? 0, ald.k25) : kg25;
      const k26Ald =
        isCurrentSlot && ald ? Math.min(kg26 ?? 0, ald.k26) : kg26;

      const mp24 =
        venta24 != null && margen24 != null && venta24 > 0
          ? margen24 / venta24
          : null;
      const mp25 =
        venta25 != null && margen25 != null && venta25 > 0
          ? margen25 / venta25
          : null;
      const mp26 =
        venta26 != null && margen26 != null && venta26 > 0
          ? margen26 / venta26
          : null;

      return {
        mes: label,
        mes_num: mes,
        // Venta
        venta24,
        venta25,
        venta26,
        venta24_alDia: v24Ald,
        venta25_alDia: v25Ald,
        venta26_alDia: v26Ald,
        // Margen $
        margen24,
        margen25,
        margen26,
        margen24_alDia: m24Ald,
        margen25_alDia: m25Ald,
        margen26_alDia: m26Ald,
        // Margen %
        mp24,
        mp25,
        mp26,
        // KG (cierre + al-día)
        kg24,
        kg25,
        kg26,
        kg24_alDia: k24Ald,
        kg25_alDia: k25Ald,
        kg26_alDia: k26Ald,
        // Variaciones — venta
        var_pct_25: venta24 && venta25 != null && venta24 > 0
          ? (venta25 - venta24) / venta24
          : null,
        var_pct_26: venta25 && venta26 != null && venta25 > 0
          ? (venta26 - venta25) / venta25
          : null,
        // Variaciones — kg
        var_kg_25: kg24 && kg25 != null && kg24 > 0
          ? (kg25 - kg24) / kg24
          : null,
        var_kg_26: kg25 && kg26 != null && kg25 > 0
          ? (kg26 - kg25) / kg25
          : null,
      };
    });

    // Totales: sumas por año (ignorando null = mes futuro)
    const sum = (key: keyof (typeof xlsxRows)[number]) =>
      xlsxRows.reduce(
        (s, r) => s + ((r[key] as number | null | undefined) ?? 0),
        0
      );
    const tot_v24 = sum("venta24");
    const tot_v25 = sum("venta25");
    const tot_v26 = sum("venta26");
    const tot_m24 = sum("margen24");
    const tot_m25 = sum("margen25");
    const tot_m26 = sum("margen26");
    const tot_k24 = sum("kg24");
    const tot_k25 = sum("kg25");
    const tot_k26 = sum("kg26");

    const summary: ExcelSummaryRow[] = [
      ...(exportPeriodLabel
        ? [{ label: "Periodo", value: exportPeriodLabel }]
        : []),
      { label: "Territorio", value: territorioLabel },
      {
        label: "Cutoff",
        value: `${MONTHS_LONG_ES[cutoffMonth - 1]} ${cutoffYear}`,
      },
      { label: "Venta YTD 2024 (al cierre)", value: tot_v24, numFmt: "$#,##0" },
      { label: "Venta YTD 2025 (al cierre)", value: tot_v25, numFmt: "$#,##0" },
      { label: "Venta YTD 2026", value: tot_v26, numFmt: "$#,##0" },
      { label: "Margen YTD 2024", value: tot_m24, numFmt: "$#,##0" },
      { label: "Margen YTD 2025", value: tot_m25, numFmt: "$#,##0" },
      { label: "Margen YTD 2026", value: tot_m26, numFmt: "$#,##0" },
      { label: "KG YTD 2024 (al cierre)", value: tot_k24, numFmt: "#,##0" },
      { label: "KG YTD 2025 (al cierre)", value: tot_k25, numFmt: "#,##0" },
      { label: "KG YTD 2026", value: tot_k26, numFmt: "#,##0" },
    ];

    const columns: ExcelColumn[] = [
      { header: "Mes", key: "mes", width: 8, align: "center" },
      { header: "Mes (#)", key: "mes_num", width: 10, numFmt: "0", align: "center" },
      // Venta cierre
      { header: "Venta 2024 cierre", key: "venta24", width: 16, numFmt: "$#,##0" },
      { header: "Venta 2025 cierre", key: "venta25", width: 16, numFmt: "$#,##0" },
      { header: "Venta 2026 cierre", key: "venta26", width: 16, numFmt: "$#,##0" },
      // Venta al-día
      { header: "Venta 2024 al-día", key: "venta24_alDia", width: 16, numFmt: "$#,##0" },
      { header: "Venta 2025 al-día", key: "venta25_alDia", width: 16, numFmt: "$#,##0" },
      { header: "Venta 2026 al-día", key: "venta26_alDia", width: 16, numFmt: "$#,##0" },
      // Variaciones venta
      { header: "Var % 25 vs 24", key: "var_pct_25", width: 14, numFmt: "0.0%" },
      { header: "Var % 26 vs 25", key: "var_pct_26", width: 14, numFmt: "0.0%" },
      // Margen
      { header: "Margen 2024", key: "margen24", width: 14, numFmt: "$#,##0" },
      { header: "Margen 2025", key: "margen25", width: 14, numFmt: "$#,##0" },
      { header: "Margen 2026", key: "margen26", width: 14, numFmt: "$#,##0" },
      { header: "Margen 2024 al-día", key: "margen24_alDia", width: 16, numFmt: "$#,##0" },
      { header: "Margen 2025 al-día", key: "margen25_alDia", width: 16, numFmt: "$#,##0" },
      { header: "Margen 2026 al-día", key: "margen26_alDia", width: 16, numFmt: "$#,##0" },
      // Margen %
      { header: "Margen % 2024", key: "mp24", width: 12, numFmt: "0.0%" },
      { header: "Margen % 2025", key: "mp25", width: 12, numFmt: "0.0%" },
      { header: "Margen % 2026", key: "mp26", width: 12, numFmt: "0.0%" },
      // KG cierre
      { header: "KG 2024 cierre", key: "kg24", width: 14, numFmt: "#,##0" },
      { header: "KG 2025 cierre", key: "kg25", width: 14, numFmt: "#,##0" },
      { header: "KG 2026 cierre", key: "kg26", width: 14, numFmt: "#,##0" },
      // KG al-día
      { header: "KG 2024 al-día", key: "kg24_alDia", width: 14, numFmt: "#,##0" },
      { header: "KG 2025 al-día", key: "kg25_alDia", width: 14, numFmt: "#,##0" },
      { header: "KG 2026 al-día", key: "kg26_alDia", width: 14, numFmt: "#,##0" },
      // Variaciones KG
      { header: "Var KG 25 vs 24", key: "var_kg_25", width: 14, numFmt: "0.0%" },
      { header: "Var KG 26 vs 25", key: "var_kg_26", width: 14, numFmt: "0.0%" },
    ];

    const totalRow: Record<string, unknown> = {
      mes: "TOTAL",
      mes_num: "",
      venta24: tot_v24,
      venta25: tot_v25,
      venta26: tot_v26,
      venta24_alDia: sum("venta24_alDia"),
      venta25_alDia: sum("venta25_alDia"),
      venta26_alDia: sum("venta26_alDia"),
      var_pct_25: tot_v24 > 0 ? (tot_v25 - tot_v24) / tot_v24 : 0,
      var_pct_26: tot_v25 > 0 ? (tot_v26 - tot_v25) / tot_v25 : 0,
      margen24: tot_m24,
      margen25: tot_m25,
      margen26: tot_m26,
      margen24_alDia: sum("margen24_alDia"),
      margen25_alDia: sum("margen25_alDia"),
      margen26_alDia: sum("margen26_alDia"),
      mp24: tot_v24 > 0 ? tot_m24 / tot_v24 : 0,
      mp25: tot_v25 > 0 ? tot_m25 / tot_v25 : 0,
      mp26: tot_v26 > 0 ? tot_m26 / tot_v26 : 0,
      kg24: tot_k24,
      kg25: tot_k25,
      kg26: tot_k26,
      kg24_alDia: sum("kg24_alDia"),
      kg25_alDia: sum("kg25_alDia"),
      kg26_alDia: sum("kg26_alDia"),
      var_kg_25: tot_k24 > 0 ? (tot_k25 - tot_k24) / tot_k24 : 0,
      var_kg_26: tot_k25 > 0 ? (tot_k26 - tot_k25) / tot_k25 : 0,
    };

    const territoriosForFile =
      territorioLabel.length > 30 ? "varios" : territorioLabel;
    const fileName = `Ventas_${sanitizeFileName(territoriosForFile)}_${todayISO()}`;

    await exportToExcel({
      fileName,
      sheetName: "Ventas",
      title: `Tab Ventas · ${cutoffYear}`,
      subtitle: `${territorioLabel}${
        exportPeriodLabel ? ` · ${exportPeriodLabel}` : ""
      } · Cutoff: ${MONTHS_LONG_ES[cutoffMonth - 1]} ${cutoffYear}`,
      summary,
      columns,
      rows: xlsxRows,
      totalRow,
    });
  };

  // DataKeys de barras según modo (pesos o kg). El "_alDia" es el
  // segmento sólido y "__rest_*" es el translúcido apilado encima. En
  // meses pasados el resto = 0, así que se ve igual que una barra simple.
  const barKeyAlDia = (year: 24 | 25 | 26) =>
    isKg ? `kg${year}_alDia` : `venta${year}_alDia`;
  const barKeyRest = (year: 24 | 25 | 26) =>
    isKg ? `__rest_k${year}` : `__rest_v${year}`;

  const barTitle = isKg ? "Kilos" : "Venta";
  const yLeftFormatter = isKg ? formatKilos : formatMoney;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ModeToggle mode={mode} onChange={switchMode} />
        <ExportExcelButton
          onExport={handleExportExcel}
          canExport={canExportExcel}
          title="Exportar 12 meses de Ventas a Excel"
        />
        <ReportButton reportInput={reportInput} canExport={canExportExcel} />
      </div>
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <ResponsiveContainer width="100%" height={460}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 60, bottom: 5, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => yLeftFormatter(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 50]}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={<VentasTooltip isKg={isKg} />}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
          />
          <Legend
            verticalAlign="top"
            align="center"
            height={32}
            wrapperStyle={{ paddingBottom: 4 }}
            content={() => (
              <ChartLegend
                sections={[
                  {
                    title: barTitle,
                    visualKind: "barras",
                    items: [
                      { label: "2024", color: "rgba(148, 163, 184, 0.85)", type: "bar" },
                      { label: "2025", color: "rgba(59, 130, 246, 0.85)", type: "bar" },
                      { label: "2026", color: "rgba(16, 185, 129, 0.85)", type: "bar" },
                    ],
                  },
                  {
                    title: "Margen %",
                    visualKind: "líneas",
                    items: [
                      { label: "2024", color: "#94a3b8", type: "line-dashed" },
                      { label: "2025", color: "#3b82f6", type: "line-dashed" },
                      { label: "2026", color: "#10b981", type: "line-dashed" },
                    ],
                  },
                ]}
              />
            )}
          />
          {/* Barras APILADAS (cierre + al-día) — dataKeys cambian según
              modo (pesos vs kilos). Key del ComposedChart se nombra para
              que Recharts re-monte las barras al cambiar el modo y se
              re-anime el eje Y izquierdo. */}
          <Bar
            yAxisId="left"
            dataKey={barKeyAlDia(24)}
            stackId="stack-24"
            name={`${barTitle} 2024`}
            fill="rgba(148, 163, 184, 0.85)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey={barKeyRest(24)}
            stackId="stack-24"
            name={`${barTitle} 2024`}
            legendType="none"
            fill="rgba(148, 163, 184, 0.28)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey={barKeyAlDia(25)}
            stackId="stack-25"
            name={`${barTitle} 2025`}
            fill="rgba(59, 130, 246, 0.85)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey={barKeyRest(25)}
            stackId="stack-25"
            name={`${barTitle} 2025`}
            legendType="none"
            fill="rgba(59, 130, 246, 0.28)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey={barKeyAlDia(26)}
            stackId="stack-26"
            name={`${barTitle} 2026`}
            fill="rgba(16, 185, 129, 0.85)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey={barKeyRest(26)}
            stackId="stack-26"
            name={`${barTitle} 2026`}
            legendType="none"
            fill="rgba(16, 185, 129, 0.28)"
            radius={[2, 2, 0, 0]}
          />
          {/* Líneas de margen % (eje derecho) — NO cambian con el toggle.
              Esto permite leer el comportamiento del margen vs el
              volumen (en pesos o kg). */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margenPct24"
            name="Margen% 2024"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={{ r: 2.5, strokeWidth: 1, fill: "white" }}
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margenPct25"
            name="Margen% 2025"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1, fill: "white" }}
            connectNulls={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="margenPct26"
            name="Margen% 2026"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 1, fill: "white" }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// Toggle Pesos / Kilos — mismo look que el de TrackingDiarioTab
// ============================================================
function ModeToggle({
  mode,
  onChange,
}: {
  mode: VentasViewMode;
  onChange: (next: VentasViewMode) => void;
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

// ============================================================
// Custom Tooltip — separates Venta vs Margen% en 2 secciones
// ============================================================
interface TooltipPayloadItem {
  name?: string;
  value?: number | null;
  color?: string;
  dataKey?: string;
}

function VentasTooltip({
  active,
  payload,
  label,
  isKg = false,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  /** Si true muestra Kilos en lugar de Pesos en la sección de barras.
   *  La sección Margen % nunca cambia. */
  isKg?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const monthIdx = MONTHS_SHORT_ES.indexOf(label ?? "");
  const monthLong = monthIdx >= 0 ? MONTHS_LONG_ES[monthIdx] : (label ?? "");

  // Recharts inyecta el row completo en payload[0].payload — usamos eso
  // para leer al-día / cierre / margen sin duplicados (las 6 series de
  // venta apiladas darían 6 entries al filtrar por name).
  const row = (payload[0] as TooltipPayloadItem & {
    payload?: Record<string, number | string | boolean | null>;
  })?.payload;
  const num = (key: string): number | null => {
    if (!row) return null;
    const v = row[key];
    return typeof v === "number" ? v : null;
  };
  const isCurrentSlot = !!(row && row["__isCurrentSlot"]);

  // Margen items se mantienen del payload (líneas, no apiladas)
  const margenItems = payload.filter((p) => p.name?.startsWith("Margen%"));

  // YoY del header — siempre compara CIERRES de 2025 vs 2026 (pesos)
  // porque es la métrica más útil para identificar tendencias.
  const v25 = num("venta25");
  const v26 = num("venta26");
  const yoyDelta =
    v25 != null && v25 > 0 && v26 != null
      ? ((v26 - v25) / v25) * 100
      : null;

  // Series de la sección principal — cambia según modo (pesos o kilos).
  // Usamos al-día como principal y cierre como referencia (solo en mes actual).
  const ventaShow = isKg
    ? [
        { label: "2024", colorBar: "rgba(148, 163, 184, 0.85)", cierreKey: "kg24", alDiaKey: "kg24_alDia" },
        { label: "2025", colorBar: "rgba(59, 130, 246, 0.85)",  cierreKey: "kg25", alDiaKey: "kg25_alDia" },
        { label: "2026", colorBar: "rgba(16, 185, 129, 0.85)",  cierreKey: "kg26", alDiaKey: "kg26_alDia" },
      ]
    : [
        { label: "2024", colorBar: "rgba(148, 163, 184, 0.85)", cierreKey: "venta24", alDiaKey: "venta24_alDia" },
        { label: "2025", colorBar: "rgba(59, 130, 246, 0.85)",  cierreKey: "venta25", alDiaKey: "venta25_alDia" },
        { label: "2026", colorBar: "rgba(16, 185, 129, 0.85)",  cierreKey: "venta26", alDiaKey: "venta26_alDia" },
      ];
  const fmtValue = (v: number) => (isKg ? formatKilos(v) : formatMoney(v));
  const sectionTitle = isKg ? "Kilos" : "Venta";

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 220,
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
          {monthLong}
        </span>
        {yoyDelta != null && (
          <span
            className="text-[10px] font-semibold"
            style={{
              color: yoyDelta >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta).toFixed(1)}% vs '25
          </span>
        )}
      </div>

      {/* Sección Venta o Kilos — al día N (oscuro) + cierre (referencia) si mes actual */}
      <div className="px-3 py-2">
        <div
          className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {sectionTitle} {isCurrentSlot ? "· al mismo día laboral" : ""}
        </div>
        {ventaShow.map((s) => {
          const cierre = num(s.cierreKey);
          const alDia = num(s.alDiaKey);
          if (cierre == null && alDia == null) return null;
          // Si NO es slot actual, al-día = cierre; mostramos solo el cierre.
          // Si SÍ es slot actual, al-día puede ser distinto del cierre →
          // mostramos al-día como principal + "cierre X" como referencia.
          const showSecondary =
            isCurrentSlot &&
            alDia != null &&
            cierre != null &&
            cierre > 0 &&
            cierre !== alDia;
          return (
            <Row
              key={s.label}
              color={s.colorBar}
              label={s.label}
              value={
                isCurrentSlot && alDia != null
                  ? fmtValue(alDia)
                  : cierre != null
                    ? fmtValue(cierre)
                    : "—"
              }
              valueSecondary={
                showSecondary ? `cierre ${fmtValue(cierre)}` : undefined
              }
            />
          );
        })}
      </div>
      {/* Sección Margen% */}
      {margenItems.length > 0 && (
        <div
          className="px-3 py-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div
            className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Margen %
          </div>
          {margenItems.map((p) => (
            <Row
              key={p.name}
              color={p.color}
              label={p.name?.replace("Margen% ", "") ?? ""}
              value={
                typeof p.value === "number" ? `${p.value.toFixed(1)}%` : "—"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  label,
  value,
  valueSecondary,
}: {
  color: string | undefined;
  label: string;
  value: string;
  /** Texto secundario en gris (ej: "cierre $X" como referencia) */
  valueSecondary?: string;
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
      <span className="flex items-baseline gap-1.5">
        <span
          className="font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
        {valueSecondary && (
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            {valueSecondary}
          </span>
        )}
      </span>
    </div>
  );
}
