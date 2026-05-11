"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney, formatKilos } from "@/lib/format";
import {
  GroupedBarChart,
  type GroupedBarSeries,
} from "@/components/dashboard/GroupedBarChart";
import { MultiSelectChips } from "@/components/dashboard/MultiSelectChips";
import { ExportExcelButton } from "@/components/dashboard/ExportExcelButton";
import type {
  ExcelColumn,
  ExcelSummaryRow,
} from "@/lib/export-excel";

export interface DimensionRow {
  name: string;
  // Cierre del mes (mes completo de cada año). 2026 = mes en curso.
  v24: number;
  v25: number;
  v26: number;
  // Opcionales — Productos los popula con kg y margen.
  k24?: number;
  k25?: number;
  k26?: number;
  m24?: number;
  m25?: number;
  m26?: number;
  // ===== Acumulado al "mismo día laboral" del mes 2026 actual (Mejora 2) =====
  // Para 2026 = lo facturado hasta hoy (igual que v26 cuando el mes está
  // en curso; igual que cierre cuando ya pasó).
  // Para 2024 y 2025: acumulado al día calendario equivalente al día hábil
  // que llevamos en 2026. Permite comparativos día-vs-día equitativos.
  v24_alDia?: number;
  v25_alDia?: number;
  v26_alDia?: number;
  k24_alDia?: number;
  k25_alDia?: number;
  k26_alDia?: number;
  m24_alDia?: number;
  m25_alDia?: number;
  m26_alDia?: number;
  // Tab Vendedores y Clientes pueden traer info extra
  empresa?: string; // "Sus" | "Suve" para Vendedores
}

interface Props {
  rows: DimensionRow[];
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
  /** Header/columna: "Grupo" / "Cliente" / "Vendedor" */
  dimensionLabel: string;
  /** Plural usado en titulo del chart: "Grupos" / "Clientes" / "Vendedores" */
  dimensionLabelPlural: string;
  /** Cuantos en chart (resto en tabla). Si null, muestra TODOS en chart. Default 10. */
  topNChart?: number | null;
  /** Cuantos en tabla. Si null, muestra TODOS. Default null (todos). */
  topNTable?: number | null;
  /** Si true, agrega 4 columnas extra de KG en la tabla (kg24, kg25, kg26, var % kg).
   *  Solo se activa cuando los rows traen k24/k25/k26 poblados. Default false. */
  showKg?: boolean;
  /** Si true, agrega un buscador con multi-select arriba del chart. La selección
   *  override el Top N (sólo afecta el chart, la tabla mantiene Top N). */
  enableMultiSelect?: boolean;
  /** Key de localStorage para persistir la selección entre sesiones. Requerido
   *  cuando enableMultiSelect=true. */
  selectionStorageKey?: string;
  /** Máximo de items seleccionables en el multi-select. Default 15. */
  multiSelectMaxItems?: number;
  /** Placeholder del buscador (ej. "Buscar cliente…"). */
  multiSelectPlaceholder?: string;
  /** Si está definido, se renderiza el botón "Exportar Excel" arriba del chart.
   *  El nombre se usa para filename + sheet name. Ej: "GrupoProducto",
   *  "Clientes", "Vendedores_Sus". */
  exportTabName?: string;
  /** Etiqueta corta del periodo para el resumen. Ej: "Mayo 2026". */
  exportPeriodLabel?: string;
  /** Territorio activo para resumen + filename del Excel. "" = "Todos". */
  exportTerritory?: string;
  /** Permiso para descargar Excel (default false). */
  canExportExcel?: boolean;
}

/**
 * Componente generico para tabs basados en una dimension (grupo, cliente,
 * vendedor) con la misma estructura: bar chart top N + tabla con
 * comparacion 3 anos + Var %.
 *
 * Usado por:
 *  - Tab Grupo Producto (cambio funcional #1 + #2)
 *  - Tab Clientes (cambio #3)
 *  - Tab Vendedores
 *
 * El bug del V2.2 ("$0, $1, $2..." en eje X) se resuelve usando Recharts
 * con XAxis dataKey="name" en GroupedBarChart.
 */
export function DimensionTab({
  rows,
  monthLabel24,
  monthLabel25,
  monthLabel26,
  dimensionLabel,
  dimensionLabelPlural,
  topNChart = 10,
  topNTable = null,
  showKg = false,
  enableMultiSelect = false,
  selectionStorageKey,
  multiSelectMaxItems = 15,
  multiSelectPlaceholder = "Buscar…",
  exportTabName,
  exportPeriodLabel,
  exportTerritory = "",
  canExportExcel = false,
}: Props) {
  // Selección custom (multi-select). Vacía = comportamiento default Top N.
  // Persistencia en localStorage si selectionStorageKey está definido.
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  useEffect(() => {
    if (!enableMultiSelect || !selectionStorageKey) return;
    try {
      const raw = window.localStorage.getItem(selectionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedItems(parsed.filter((s) => typeof s === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, [enableMultiSelect, selectionStorageKey]);
  const updateSelected = (next: string[]) => {
    const trimmed = next.slice(0, multiSelectMaxItems);
    setSelectedItems(trimmed);
    if (!selectionStorageKey) return;
    try {
      window.localStorage.setItem(
        selectionStorageKey,
        JSON.stringify(trimmed)
      );
    } catch {
      // ignore
    }
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.v26 - a.v26),
    [rows]
  );

  // Items disponibles para el multi-select (todos los nombres únicos)
  const availableItems = useMemo(
    () => sorted.map((r) => r.name),
    [sorted]
  );

  const isCustomMode = enableMultiSelect && selectedItems.length > 0;

  // Items del chart:
  //  - Custom: respeta orden de selección del usuario, mapea a rows reales
  //  - Default: top N por venta del mes actual
  const top = useMemo(() => {
    if (isCustomMode) {
      const byName = new Map(rows.map((r) => [r.name, r]));
      return selectedItems
        .map((name) => byName.get(name))
        .filter((r): r is DimensionRow => r != null);
    }
    return topNChart == null ? sorted : sorted.slice(0, topNChart);
  }, [isCustomMode, selectedItems, rows, sorted, topNChart]);

  // Tabla:
  //  - Si está en modo personalizado (con selección custom) → tabla muestra
  //    SOLO los items seleccionados (mismo orden que el chart, coherente).
  //  - Si modo default → topNTable como antes.
  const tableRows = useMemo(() => {
    if (isCustomMode) {
      return top;
    }
    return topNTable == null ? sorted : sorted.slice(0, topNTable);
  }, [isCustomMode, top, sorted, topNTable]);

  const series: GroupedBarSeries[] = [
    { key: "v24", label: monthLabel24, color: "#94a3b8" },
    { key: "v25", label: monthLabel25, color: "#3b82f6" },
    { key: "v26", label: monthLabel26, color: "#10b981" },
  ];

  // Series de margen para chart + tooltip. Las labels añaden "Margen" para
  // distinguir de las barras de venta en la leyenda.
  const marginAmountSeries: GroupedBarSeries[] = [
    { key: "m24", label: `Margen ${monthLabel24}`, color: "#94a3b8" },
    { key: "m25", label: `Margen ${monthLabel25}`, color: "#3b82f6" },
    { key: "m26", label: `Margen ${monthLabel26}`, color: "#10b981" },
  ];
  const marginPctSeries: GroupedBarSeries[] = [
    { key: "mp24", label: `Margen % ${monthLabel24}`, color: "#94a3b8" },
    { key: "mp25", label: `Margen % ${monthLabel25}`, color: "#3b82f6" },
    { key: "mp26", label: `Margen % ${monthLabel26}`, color: "#10b981" },
  ];

  // ============ Export Excel ============
  // Lazy import (exceljs ~700KB se carga solo al click). WYSIWYG: respeta
  // el multi-select activo (tableRows ya viene filtrado).
  const handleExportExcel = exportTabName
    ? async () => {
        const { exportToExcel, sanitizeFileName, todayISO } = await import(
          "@/lib/export-excel"
        );

        const territorioLabel =
          exportTerritory && exportTerritory !== ""
            ? exportTerritory
            : "Todos";

        const totalCierre = tableRows.reduce(
          (acc, r) => ({
            v24: acc.v24 + r.v24,
            v25: acc.v25 + r.v25,
            v26: acc.v26 + r.v26,
            k24: acc.k24 + (r.k24 ?? 0),
            k25: acc.k25 + (r.k25 ?? 0),
            k26: acc.k26 + (r.k26 ?? 0),
            m24: acc.m24 + (r.m24 ?? 0),
            m25: acc.m25 + (r.m25 ?? 0),
            m26: acc.m26 + (r.m26 ?? 0),
            v24_alDia: acc.v24_alDia + (r.v24_alDia ?? r.v24),
            v25_alDia: acc.v25_alDia + (r.v25_alDia ?? r.v25),
            v26_alDia: acc.v26_alDia + (r.v26_alDia ?? r.v26),
            k24_alDia: acc.k24_alDia + (r.k24_alDia ?? r.k24 ?? 0),
            k25_alDia: acc.k25_alDia + (r.k25_alDia ?? r.k25 ?? 0),
            k26_alDia: acc.k26_alDia + (r.k26_alDia ?? r.k26 ?? 0),
            m24_alDia: acc.m24_alDia + (r.m24_alDia ?? r.m24 ?? 0),
            m25_alDia: acc.m25_alDia + (r.m25_alDia ?? r.m25 ?? 0),
            m26_alDia: acc.m26_alDia + (r.m26_alDia ?? r.m26 ?? 0),
          }),
          {
            v24: 0, v25: 0, v26: 0,
            k24: 0, k25: 0, k26: 0,
            m24: 0, m25: 0, m26: 0,
            v24_alDia: 0, v25_alDia: 0, v26_alDia: 0,
            k24_alDia: 0, k25_alDia: 0, k26_alDia: 0,
            m24_alDia: 0, m25_alDia: 0, m26_alDia: 0,
          }
        );

        const summary: ExcelSummaryRow[] = [
          ...(exportPeriodLabel
            ? [{ label: "Periodo", value: exportPeriodLabel }]
            : []),
          { label: "Territorio", value: territorioLabel },
          { label: "Dimensión", value: dimensionLabelPlural },
          {
            label: isCustomMode ? "Modo" : "Modo",
            value: isCustomMode
              ? `Selección custom (${tableRows.length} items)`
              : topNTable == null
                ? "Default (todos)"
                : `Default (Top ${topNTable})`,
          },
          {
            label: `# ${dimensionLabelPlural} exportados`,
            value: tableRows.length,
            numFmt: "#,##0",
          },
          {
            label: `Venta total ${monthLabel26}`,
            value: totalCierre.v26,
            numFmt: "$#,##0",
          },
          {
            label: `Venta total ${monthLabel25}`,
            value: totalCierre.v25,
            numFmt: "$#,##0",
          },
          {
            label: `Venta total ${monthLabel24}`,
            value: totalCierre.v24,
            numFmt: "$#,##0",
          },
        ];

        // Columnas: dim + venta cierre 24/25/26 + venta al-día 24/25/26 +
        // kg + margen + margen % + var %
        const columns: ExcelColumn[] = [
          { header: dimensionLabel, key: "name", width: 38 },
          // Pesos cierre
          { header: `Venta ${monthLabel24} cierre`, key: "v24", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel25} cierre`, key: "v25", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel26} cierre`, key: "v26", width: 16, numFmt: "$#,##0" },
          // Pesos al-día (comparativos día-vs-día)
          { header: `Venta ${monthLabel24} al-día`, key: "v24_alDia", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel25} al-día`, key: "v25_alDia", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel26} al-día`, key: "v26_alDia", width: 16, numFmt: "$#,##0" },
          // Var %
          { header: "Var Venta % (cierre 26 vs 25)", key: "varVentaPct", width: 18, numFmt: "0.0%" },
          // KG cierre
          { header: `KG ${monthLabel24} cierre`, key: "k24", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel25} cierre`, key: "k25", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel26} cierre`, key: "k26", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel24} al-día`, key: "k24_alDia", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel25} al-día`, key: "k25_alDia", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel26} al-día`, key: "k26_alDia", width: 14, numFmt: "#,##0" },
          { header: "Var KG %", key: "varKgPct", width: 14, numFmt: "0.0%" },
          // Margen
          { header: `Margen ${monthLabel24}`, key: "m24", width: 16, numFmt: "$#,##0" },
          { header: `Margen ${monthLabel25}`, key: "m25", width: 16, numFmt: "$#,##0" },
          { header: `Margen ${monthLabel26}`, key: "m26", width: 16, numFmt: "$#,##0" },
          { header: `Margen % ${monthLabel24}`, key: "mp24", width: 14, numFmt: "0.0%" },
          { header: `Margen % ${monthLabel25}`, key: "mp25", width: 14, numFmt: "0.0%" },
          { header: `Margen % ${monthLabel26}`, key: "mp26", width: 14, numFmt: "0.0%" },
        ];

        const xlsxRows = tableRows.map((r) => {
          const k24 = r.k24 ?? 0;
          const k25 = r.k25 ?? 0;
          const k26 = r.k26 ?? 0;
          const m24 = r.m24 ?? 0;
          const m25 = r.m25 ?? 0;
          const m26 = r.m26 ?? 0;
          return {
            name: r.name,
            v24: r.v24,
            v25: r.v25,
            v26: r.v26,
            v24_alDia: r.v24_alDia ?? r.v24,
            v25_alDia: r.v25_alDia ?? r.v25,
            v26_alDia: r.v26_alDia ?? r.v26,
            varVentaPct: r.v25 > 0 ? (r.v26 - r.v25) / r.v25 : 0,
            k24,
            k25,
            k26,
            k24_alDia: r.k24_alDia ?? k24,
            k25_alDia: r.k25_alDia ?? k25,
            k26_alDia: r.k26_alDia ?? k26,
            varKgPct: k25 > 0 ? (k26 - k25) / k25 : 0,
            m24,
            m25,
            m26,
            mp24: r.v24 > 0 ? m24 / r.v24 : 0,
            mp25: r.v25 > 0 ? m25 / r.v25 : 0,
            mp26: r.v26 > 0 ? m26 / r.v26 : 0,
          };
        });

        const totalRow: Record<string, unknown> = {
          name: `TOTAL (${tableRows.length} ${dimensionLabelPlural.toLowerCase()})`,
          v24: totalCierre.v24,
          v25: totalCierre.v25,
          v26: totalCierre.v26,
          v24_alDia: totalCierre.v24_alDia,
          v25_alDia: totalCierre.v25_alDia,
          v26_alDia: totalCierre.v26_alDia,
          varVentaPct:
            totalCierre.v25 > 0
              ? (totalCierre.v26 - totalCierre.v25) / totalCierre.v25
              : 0,
          k24: totalCierre.k24,
          k25: totalCierre.k25,
          k26: totalCierre.k26,
          k24_alDia: totalCierre.k24_alDia,
          k25_alDia: totalCierre.k25_alDia,
          k26_alDia: totalCierre.k26_alDia,
          varKgPct:
            totalCierre.k25 > 0
              ? (totalCierre.k26 - totalCierre.k25) / totalCierre.k25
              : 0,
          m24: totalCierre.m24,
          m25: totalCierre.m25,
          m26: totalCierre.m26,
          mp24: totalCierre.v24 > 0 ? totalCierre.m24 / totalCierre.v24 : 0,
          mp25: totalCierre.v25 > 0 ? totalCierre.m25 / totalCierre.v25 : 0,
          mp26: totalCierre.v26 > 0 ? totalCierre.m26 / totalCierre.v26 : 0,
        };

        const territoriosForFile =
          territorioLabel.length > 30 ? "varios" : territorioLabel;
        const fileName = `${sanitizeFileName(exportTabName)}_${sanitizeFileName(territoriosForFile)}_${todayISO()}`;

        await exportToExcel({
          fileName,
          sheetName: exportTabName.slice(0, 31),
          title: `Tab ${exportTabName} · ${monthLabel26}`,
          subtitle: `${territorioLabel}${
            exportPeriodLabel ? ` · ${exportPeriodLabel}` : ""
          } · ${tableRows.length} ${dimensionLabelPlural.toLowerCase()}`,
          summary,
          columns,
          rows: xlsxRows,
          totalRow,
        });
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Toolbar superior: solo botón export (alineado a la derecha) */}
      {handleExportExcel && canExportExcel && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ExportExcelButton
            onExport={handleExportExcel}
            disabled={tableRows.length === 0}
            canExport={canExportExcel}
            title={
              tableRows.length === 0
                ? "Sin filas para exportar"
                : `Exportar ${tableRows.length} fila${tableRows.length === 1 ? "" : "s"} a Excel`
            }
          />
        </div>
      )}

      {/* Chart top N */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {top.length === 0 && !enableMultiSelect ? (
          <p
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin data del mes actual.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {isCustomMode
                    ? `${top.length} ${dimensionLabelPlural} seleccionado${top.length === 1 ? "" : "s"} · ${monthLabel26}`
                    : topNChart == null
                      ? `${dimensionLabelPlural} · ${monthLabel26}`
                      : `Top ${top.length} ${dimensionLabelPlural} · ${monthLabel26}`}
                </h3>
                {isCustomMode && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Modo personalizado · selección custom override Top default
                  </span>
                )}
              </div>
              {enableMultiSelect && (
                <MultiSelectChips
                  options={availableItems}
                  selected={selectedItems}
                  onChange={updateSelected}
                  maxItems={multiSelectMaxItems}
                  placeholder={multiSelectPlaceholder}
                  emptyLabel="Top default"
                />
              )}
            </div>
            {top.length === 0 ? (
              <p
                className="py-12 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {isCustomMode
                  ? "Sin data para los items seleccionados en este mes."
                  : "Sin data del mes actual."}
              </p>
            ) : (
              <GroupedBarChart
                data={top.map((r) => {
                  const m24 = r.m24 ?? 0;
                  const m25 = r.m25 ?? 0;
                  const m26 = r.m26 ?? 0;
                  // Acumulados al día N (Mejora 2). Si por alguna razón
                  // al-día > cierre (no debería), nos quedamos con cierre.
                  const v24AlDia = Math.min(r.v24, r.v24_alDia ?? r.v24);
                  const v25AlDia = Math.min(r.v25, r.v25_alDia ?? r.v25);
                  const v26AlDia = Math.min(r.v26, r.v26_alDia ?? r.v26);
                  return {
                    name: r.name,
                    // Cierre del mes (segmento total)
                    v24: r.v24,
                    v25: r.v25,
                    v26: r.v26,
                    // Al día N (segmento sólido inferior)
                    v24_alDia: v24AlDia,
                    v25_alDia: v25AlDia,
                    v26_alDia: v26AlDia,
                    // "Resto hasta cierre" (segmento translúcido superior)
                    __rest_v24: Math.max(0, r.v24 - v24AlDia),
                    __rest_v25: Math.max(0, r.v25 - v25AlDia),
                    __rest_v26: Math.max(0, r.v26 - v26AlDia),
                    // Margen $ y margen % (van al tooltip)
                    m24,
                    m25,
                    m26,
                    mp24: r.v24 > 0 ? (m24 / r.v24) * 100 : 0,
                    mp25: r.v25 > 0 ? (m25 / r.v25) * 100 : 0,
                    mp26: r.v26 > 0 ? (m26 / r.v26) * 100 : 0,
                    // KG (al tooltip)
                    k24: r.k24 ?? 0,
                    k25: r.k25 ?? 0,
                    k26: r.k26 ?? 0,
                  };
                })}
                series={series}
                marginAmountSeries={marginAmountSeries}
                marginPctSeries={marginPctSeries}
                alDiaKeyByCierre={{
                  v24: "v24_alDia",
                  v25: "v25_alDia",
                  v26: "v26_alDia",
                }}
                height={520}
                xAngle={-30}
                xLabelHeight={130}
              />
            )}
          </>
        )}
      </div>

      {/* Tabla */}
      {tableRows.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Leyenda explícita: la tabla muestra acumulado AL MISMO DÍA
              (consistente con el chart). Antes mostraba cierre completo,
              causando incongruencia con tooltips del chart. */}
          <div
            className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface-muted)",
              color: "var(--text-muted)",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              ⓘ Valores al mismo día laboral
            </span>
            <span className="ml-2">
              (comparativos día-vs-día equitativos entre años)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th>{dimensionLabel}</Th>
                  {/* Pesos — al-día */}
                  <Th align="right">{monthLabel24}</Th>
                  <Th align="right">{monthLabel25}</Th>
                  <Th align="right">{monthLabel26}</Th>
                  <Th align="right">Var %</Th>
                  {/* KG (opcional) — al-día */}
                  {showKg && (
                    <>
                      <Th align="right" subtle>{`KG ${monthLabel24}`}</Th>
                      <Th align="right" subtle>{`KG ${monthLabel25}`}</Th>
                      <Th align="right" subtle>{`KG ${monthLabel26}`}</Th>
                      <Th align="right" subtle>Var % KG</Th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  // === Mostrar SIEMPRE al-día (coherente con tooltip del chart) ===
                  // Si al-día no existe (data vieja sin Mejora 2), fallback a cierre.
                  const v24Show = r.v24_alDia ?? r.v24;
                  const v25Show = r.v25_alDia ?? r.v25;
                  const v26Show = r.v26_alDia ?? r.v26;
                  const k24Show = r.k24_alDia ?? r.k24 ?? 0;
                  const k25Show = r.k25_alDia ?? r.k25 ?? 0;
                  const k26Show = r.k26_alDia ?? r.k26 ?? 0;
                  const varPct =
                    v25Show > 0 ? ((v26Show - v25Show) / v25Show) * 100 : null;
                  const varKgPct =
                    k25Show > 0 ? ((k26Show - k25Show) / k25Show) * 100 : null;
                  return (
                    <tr
                      key={r.name + i}
                      style={{
                        background:
                          i % 2 === 0
                            ? "var(--bg-surface)"
                            : "var(--bg-surface-muted)",
                      }}
                    >
                      <Td>{r.name}</Td>
                      <Td align="right">{formatMoney(v24Show)}</Td>
                      <Td align="right">{formatMoney(v25Show)}</Td>
                      <Td align="right">{formatMoney(v26Show)}</Td>
                      <Td
                        align="right"
                        bold
                        color={
                          varPct == null
                            ? "var(--text-muted)"
                            : varPct >= 0
                              ? "var(--success)"
                              : "var(--danger)"
                        }
                      >
                        {varPct == null
                          ? "—"
                          : `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                      </Td>
                      {showKg && (
                        <>
                          <Td align="right" subtle>{formatKilos(k24Show)}</Td>
                          <Td align="right" subtle>{formatKilos(k25Show)}</Td>
                          <Td align="right" subtle>{formatKilos(k26Show)}</Td>
                          <Td
                            align="right"
                            bold
                            color={
                              varKgPct == null
                                ? "var(--text-muted)"
                                : varKgPct >= 0
                                  ? "var(--success)"
                                  : "var(--danger)"
                            }
                          >
                            {varKgPct == null
                              ? "—"
                              : `${varKgPct >= 0 ? "+" : ""}${varKgPct.toFixed(1)}%`}
                          </Td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {topNTable != null && sorted.length > tableRows.length && (
            <div
              className="border-t px-3 py-2 text-center text-[11px]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Mostrando top {tableRows.length} de {sorted.length}{" "}
              {dimensionLabelPlural.toLowerCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
  subtle = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  /** Si true, color más tenue + borde izquierdo sutil para separar grupo de columnas. */
  subtle?: boolean;
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: subtle ? "var(--text-muted)" : "var(--text-secondary)",
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
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
  subtle = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  color?: string;
  bold?: boolean;
  /** Si true, color más tenue + borde izquierdo sutil. */
  subtle?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-${align}`}
      style={{
        color: color ?? (subtle ? "var(--text-secondary)" : "var(--text-primary)"),
        fontWeight: bold ? 600 : 400,
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
      }}
    >
      {children}
    </td>
  );
}
