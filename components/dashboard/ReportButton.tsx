"use client";

/**
 * ReportButton — botón para descargar el reporte "Avance Comercial" en PDF.
 *
 * Se coloca junto a `ExportExcelButton` en cada tab. Al hacer click:
 *   1. Lazy-importa @react-pdf/renderer + el componente PDF + el data builder
 *      (≈600KB chunk separado; no impacta el bundle inicial)
 *   2. Construye el ReportData a partir del input recibido
 *   3. Genera el Blob PDF en el browser
 *   4. Dispara descarga con filename inteligente según el modo
 *
 * Mientras corre muestra spinner. Si falla, alert al usuario.
 *
 * Permiso: reusa `users_permissions.can_export_excel` (mismo bucket de
 * "puede descargar reportes"). Sin permiso → no renderiza nada.
 */

import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import type { BuildReportInput } from "@/lib/report-pdf/data";

interface ReportButtonProps {
  /** Input para armar el reporte. Si es null, el botón se renderiza disabled
   *  (estado "sin data"). */
  reportInput: BuildReportInput | null;
  /** Permiso del usuario (reusa can_export_excel). Sin permiso → no renderiza. */
  canExport?: boolean;
  /** Label custom. Default "Generar PDF". */
  label?: string;
  /** Tooltip nativo. */
  title?: string;
  /** Si true, el botón aparece disabled (ej. modo aggregated-none). */
  disabled?: boolean;
}

/** Construye un filename útil según el modo. */
function buildFilename(input: BuildReportInput): string {
  const { mode } = input;
  const yyyy = input.currentYear;
  const mm = String(input.currentMonth).padStart(2, "0");
  const dd = String(input.daysCurrent).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // Slugify el contexto
  const sanitize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quitar acentos
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  let contexto: string;
  if (mode.kind === "single") {
    contexto = sanitize(mode.territory);
  } else if (mode.kind === "all") {
    contexto = "Todos";
  } else {
    // multi
    if (mode.territories.length <= 2) {
      contexto = mode.territories.map(sanitize).join("_");
    } else {
      contexto = `Multi_${mode.territories.length}_Territorios`;
    }
  }

  return `Avance_Comercial_${contexto}_${dateStr}.pdf`;
}

export function ReportButton({
  reportInput,
  canExport = true,
  label = "Generar PDF",
  title,
  disabled = false,
}: ReportButtonProps) {
  // Sin permiso → no renderizar. UX limpia (igual que ExportExcelButton).
  if (!canExport) return null;

  const [loading, setLoading] = useState(false);

  const noData = !reportInput;
  const isDisabled = loading || disabled || noData;

  async function handleClick() {
    if (isDisabled || !reportInput) return;
    try {
      setLoading(true);

      // Lazy import del stack pesado (≈600KB combinado): solo se carga
      // cuando el usuario hace click por primera vez. Posteriores clicks
      // son inmediatos porque el módulo queda cacheado en memoria.
      const [{ pdf }, { AvanceComercialPDF }, { buildReportData }, React] =
        await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/report-pdf/AvanceComercialPDF"),
          import("@/lib/report-pdf/data"),
          import("react"),
        ]);

      const reportData = buildReportData(reportInput);
      const element = React.createElement(AvanceComercialPDF, {
        data: reportData,
      });

      // Generar blob
      // @ts-expect-error pdf() acepta cualquier ReactElement compatible
      const blob = await pdf(element).toBlob();

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(reportInput);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Liberar después de un tick para que el browser inicie la descarga
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("[ReportButton]", err);
      if (typeof window !== "undefined") {
        window.alert(`No se pudo generar el reporte PDF: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={
        title ??
        (noData
          ? "Sin data para generar reporte"
          : "Descargar reporte 'Avance Comercial' en PDF")
      }
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: "var(--border)",
        color: "var(--text-primary)",
        background: "var(--bg-surface)",
      }}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <FileText size={14} />
      )}
      <span>{loading ? "Generando…" : label}</span>
    </button>
  );
}
