"use client";

/**
 * lib/export-excel.ts — helper genérico para exportar tablas a .xlsx
 *
 * Diseñado para los tabs del dashboard. Cada tab arma un objeto
 * `ExcelExportOptions` con su bloque resumen, sus columnas y sus filas, y
 * llama a `exportToExcel(opts)`. El helper genera un .xlsx con:
 *
 *   - Título + subtítulo arriba (opcional)
 *   - Bloque resumen (label/value, ej: "# Perdidos | 12")
 *   - Header bold con fondo oscuro + fila congelada (freeze panes)
 *   - Filas de datos con zebra
 *   - Row TOTAL al final (opcional, bold con borde superior)
 *   - Anchos de columna ajustables, formatos numéricos personalizables
 *
 * Importante: este módulo SOLO debe importarse desde Client Components.
 * exceljs es ~700KB minified y no aporta nada en el server.
 */

import ExcelJS from "exceljs";

export type ExcelColumn = {
  /** Nombre que aparece en el header del Excel */
  header: string;
  /** Llave del campo en cada row del array `rows` */
  key: string;
  /** Ancho de la columna en chars (default 15). exceljs ajusta automático. */
  width?: number;
  /** Formato numérico Excel: "$#,##0", "0.0%", "#,##0", "yyyy-mm-dd"... */
  numFmt?: string;
  /** Alineación de los datos. Default: "left" para texto, "right" para números */
  align?: "left" | "right" | "center";
};

export type ExcelSummaryRow = {
  label: string;
  value: string | number;
  /** Formato numérico Excel para la celda value */
  numFmt?: string;
};

export type ExcelExportOptions = {
  /** Nombre del archivo SIN extensión (la agrega el helper) */
  fileName: string;
  /** Nombre de la hoja (max 31 chars, exceljs lo trunca) */
  sheetName: string;
  /** Título grande arriba (opcional) */
  title?: string;
  /** Subtítulo en gris debajo del título (ej. "Mayo 2026 · Mérida") */
  subtitle?: string;
  /** Bloque resumen — array de label/value mostrado antes de la tabla */
  summary?: ExcelSummaryRow[];
  /** Columnas de la tabla */
  columns: ExcelColumn[];
  /** Filas de datos. Cada row es un objeto con key=valor por cada columna */
  rows: Record<string, unknown>[];
  /** Row TOTAL al final (opcional) */
  totalRow?: Record<string, unknown>;
};

const HEADER_BG = "FF1F2937"; // gris oscuro (slate-800)
const HEADER_FG = "FFFFFFFF";
const ZEBRA_BG = "FFF9FAFB"; // gris muy claro (gray-50)
const TOTAL_BG = "FFE5E7EB"; // gris claro (gray-200)
const SUBTITLE_FG = "FF6B7280"; // gray-500
const TITLE_FG = "FF111827"; // gray-900
const SUMMARY_LABEL_FG = "FF6B7280";
const BORDER_DARK = "FF111827";

/**
 * Genera y dispara la descarga de un archivo .xlsx con la estructura
 * descrita en `opts`. Usa Blob + a.download (no requiere navegador especial).
 */
function buildSheet(
  wb: ExcelJS.Workbook,
  opts: Omit<ExcelExportOptions, "fileName">
): void {
  // exceljs limita el sheetName a 31 chars (regla de Excel)
  const safeSheetName = opts.sheetName.slice(0, 31);
  const ws = wb.addWorksheet(safeSheetName, {
    views: [{ state: "frozen", ySplit: 1 }], // se actualiza al final cuando sepamos el header row
  });

  let currentRow = 1;
  const numCols = opts.columns.length;

  // ===== Título =====
  if (opts.title) {
    const cell = ws.getCell(currentRow, 1);
    cell.value = opts.title;
    cell.font = { bold: true, size: 16, color: { argb: TITLE_FG } };
    if (numCols > 1) ws.mergeCells(currentRow, 1, currentRow, numCols);
    ws.getRow(currentRow).height = 24;
    currentRow++;
  }
  if (opts.subtitle) {
    const cell = ws.getCell(currentRow, 1);
    cell.value = opts.subtitle;
    cell.font = { italic: true, size: 11, color: { argb: SUBTITLE_FG } };
    if (numCols > 1) ws.mergeCells(currentRow, 1, currentRow, numCols);
    currentRow++;
  }
  if (opts.title || opts.subtitle) currentRow++; // línea blanca

  // ===== Bloque resumen =====
  if (opts.summary && opts.summary.length > 0) {
    const headerCell = ws.getCell(currentRow, 1);
    headerCell.value = "RESUMEN";
    headerCell.font = {
      bold: true,
      size: 10,
      color: { argb: SUMMARY_LABEL_FG },
    };
    currentRow++;

    for (const item of opts.summary) {
      const labelCell = ws.getCell(currentRow, 1);
      labelCell.value = item.label;
      labelCell.font = { color: { argb: SUMMARY_LABEL_FG } };

      const valueCell = ws.getCell(currentRow, 2);
      valueCell.value = item.value;
      valueCell.font = { bold: true, color: { argb: TITLE_FG } };
      if (item.numFmt) valueCell.numFmt = item.numFmt;

      currentRow++;
    }
    currentRow++; // línea blanca
  }

  // ===== Header de tabla =====
  const headerRowIdx = currentRow;
  const headerRow = ws.getRow(headerRowIdx);
  opts.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_BG },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: col.align ?? (col.numFmt ? "right" : "left"),
      wrapText: false,
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: BORDER_DARK } },
    };
  });
  headerRow.height = 22;
  currentRow++;

  // ===== Filas de datos =====
  opts.rows.forEach((row, rowIdx) => {
    const dataRow = ws.getRow(currentRow);
    const isZebra = rowIdx % 2 === 1;
    opts.columns.forEach((col, i) => {
      const cell = dataRow.getCell(i + 1);
      const value = row[col.key];
      cell.value =
        typeof value === "string" || typeof value === "number"
          ? value
          : value == null
            ? null
            : String(value);
      if (col.numFmt) cell.numFmt = col.numFmt;
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? (col.numFmt ? "right" : "left"),
      };
      if (isZebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ZEBRA_BG },
        };
      }
    });
    currentRow++;
  });

  // ===== Row TOTAL =====
  if (opts.totalRow) {
    const totalRow = ws.getRow(currentRow);
    opts.columns.forEach((col, i) => {
      const cell = totalRow.getCell(i + 1);
      const value = opts.totalRow![col.key];
      cell.value =
        typeof value === "string" || typeof value === "number"
          ? value
          : value == null
            ? null
            : String(value);
      cell.font = { bold: true, color: { argb: TITLE_FG } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: TOTAL_BG },
      };
      cell.border = {
        top: { style: "medium", color: { argb: BORDER_DARK } },
      };
      if (col.numFmt) cell.numFmt = col.numFmt;
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? (col.numFmt ? "right" : "left"),
      };
    });
    totalRow.height = 22;
    currentRow++;
  }

  // ===== Anchos de columna =====
  opts.columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width ?? 15;
  });

  // ===== Freeze panes en el header de la tabla =====
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
}

function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Comercial Susazón";
  wb.created = new Date();
  wb.lastModifiedBy = "Dashboard Comercial Susazón";
  return wb;
}

async function downloadWorkbook(
  wb: ExcelJS.Workbook,
  fileName: string
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Exporta UNA tabla a un .xlsx de una sola hoja.
 */
export async function exportToExcel(opts: ExcelExportOptions): Promise<void> {
  const wb = newWorkbook();
  buildSheet(wb, opts);
  await downloadWorkbook(wb, opts.fileName);
}

/**
 * Exporta VARIAS tablas a un .xlsx con UNA HOJA por cada una (ej. el Insight
 * Penetración: hoja "Por Cliente" + hoja "Por SKU"). Cada elemento de `sheets`
 * tiene la misma forma que `exportToExcel` pero sin `fileName`.
 */
export async function exportToExcelMultiSheet(
  fileName: string,
  sheets: Array<Omit<ExcelExportOptions, "fileName">>
): Promise<void> {
  const wb = newWorkbook();
  for (const s of sheets) buildSheet(wb, s);
  await downloadWorkbook(wb, fileName);
}

/**
 * Sanitiza un string para que sea válido como parte de un nombre de archivo.
 * Reemplaza caracteres prohibidos por `_` y trim.
 */
export function sanitizeFileName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Devuelve la fecha actual en formato YYYY-MM-DD (sin hora) en zona local.
 * Útil para sufijar el nombre del archivo.
 */
export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
