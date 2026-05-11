"use client";

import { useEffect, useState } from "react";
import { BookOpen, X, ExternalLink, Loader2 } from "lucide-react";

/**
 * InstructivoButton — botón en el header + modal fullscreen con el instructivo.
 *
 * - Solo se renderiza si el setting global `instructivo_visible.enabled` es true
 *   (controlado por admin desde /admin/configuracion).
 * - Click abre modal fullscreen con iframe a `/instructivo.html`.
 * - ESC cierra el modal.
 * - Botón "Abrir en pestaña nueva" para ver en grande.
 */
export function InstructivoButton({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    // Bloquear scroll del body cuando el modal está abierto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIframeLoading(true);
          setOpen(true);
        }}
        title="Abrir instructivo de uso"
        aria-label="Abrir instructivo"
        className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-all hover:bg-[var(--bg-surface-muted)]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          background: "var(--bg-surface)",
        }}
      >
        <BookOpen size={14} style={{ color: "var(--accent)" }} />
        <span>Instructivo</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          style={{
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={(e) => {
            // Click fuera del card cierra el modal
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative flex h-full max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-[var(--radius-lg)] border shadow-2xl"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-strong)",
              boxShadow: "0 30px 80px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* Header del modal */}
            <header
              className="flex items-center justify-between gap-3 border-b px-5 py-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface-muted)",
              }}
            >
              <div className="flex items-center gap-2">
                <BookOpen
                  size={18}
                  style={{ color: "var(--accent)" }}
                />
                <h2
                  className="text-base font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-primary)" }}
                >
                  Instructivo del Dashboard
                </h2>
                <span
                  className="ml-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  · presiona ESC para cerrar
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="/instructivo.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir en pestaña nueva"
                  className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors hover:bg-[var(--bg-surface)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ExternalLink size={12} />
                  <span>Abrir en pestaña</span>
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar instructivo"
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-surface)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* Contenido: iframe del instructivo */}
            <div className="relative flex-1 overflow-hidden">
              {iframeLoading && (
                <div
                  className="absolute inset-0 flex items-center justify-center gap-2 text-sm"
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                  <span>Cargando instructivo…</span>
                </div>
              )}
              <iframe
                src="/instructivo.html"
                title="Instructivo del Dashboard"
                className="h-full w-full border-0"
                style={{ background: "white" }}
                onLoad={() => setIframeLoading(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
