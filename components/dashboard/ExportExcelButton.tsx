"use client";

/**
 * ExportExcelButton — botón reusable para exportar a Excel.
 *
 * Se coloca en el header de cada tab (junto a los otros toggles). Al
 * hacer click ejecuta la callback `onExport` (que arma el .xlsx y dispara
 * la descarga vía `lib/export-excel.ts`). Muestra spinner mientras corre.
 *
 * Si la callback lanza, muestra un alert con el error (el dev solo loggea
 * a consola en el browser; el resto se entera por el alert).
 */

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

export function ExportExcelButton({
  onExport,
  label = "Exportar Excel",
  disabled = false,
  title,
  canExport = true,
}: {
  onExport: () => Promise<void> | void;
  label?: string;
  disabled?: boolean;
  /** Tooltip nativo (atributo title del botón) */
  title?: string;
  /** Si false, el botón NO se renderiza. Permiso de usuario controlado
   *  desde users_permissions.can_export_excel (default true para back-compat
   *  con llamadas sin la prop). */
  canExport?: boolean;
}) {
  // Sin permiso → no renderizar nada. UX limpia, no genera fricción.
  if (!canExport) return null;

  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading || disabled) return;
    try {
      setLoading(true);
      await onExport();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("[ExportExcelButton]", err);
      // Aviso visible al usuario
      if (typeof window !== "undefined") {
        window.alert(`No se pudo generar el Excel: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || disabled;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={title ?? label}
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
        <Download size={14} />
      )}
      <span>{loading ? "Generando…" : label}</span>
    </button>
  );
}
