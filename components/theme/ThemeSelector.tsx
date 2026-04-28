"use client";

import { useEffect, useState } from "react";
import { Palette, Check, X } from "lucide-react";
import { THEMES, type ThemeId, type ThemeMeta } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    // Bloquear scroll del body mientras modal está abierto
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
        aria-label="Cambiar tema"
      >
        <Palette size={16} />
        <span className="hidden sm:inline">Tema</span>
      </button>

      {open && (
        <ThemeModal
          currentTheme={theme}
          onSelect={(t) => {
            setTheme(t);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ============================================================
function ThemeModal({
  currentTheme,
  onSelect,
  onClose,
}: {
  currentTheme: ThemeId;
  onSelect: (id: ThemeId) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="theme-modal-fade fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar selector de tema"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{
          background: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Modal container */}
      <div
        className="theme-modal-pop relative z-10 w-full max-w-[960px] overflow-hidden rounded-[var(--radius-lg)] border shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2
              id="theme-modal-title"
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Elegí tu tema
            </h2>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Cambia el look de toda la app · cada preview muestra cómo se vería
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors hover:bg-[var(--bg-surface-muted)]"
            aria-label="Cerrar"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Grid de previews 3x2 */}
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <ThemePreviewCard
              key={t.id}
              meta={t}
              active={t.id === currentTheme}
              onClick={() => onSelect(t.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
/**
 * Preview card — usa data-theme={t.id} scoped al card. Las CSS vars cascadean
 * al árbol interior, así el preview muestra el theme aplicado de verdad
 * (mini header + mini KPI card + mini chart bar real).
 *
 * Caso especial: Liquid Glass necesita el aurora gradient. Como `body::before`
 * no aplica scoped a un div, lo renderizamos inline con un wrapper interno.
 */
function ThemePreviewCard({
  meta,
  active,
  onClick,
}: {
  meta: ThemeMeta;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-theme={meta.id}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius)] border-2 transition-all hover:scale-[1.02]"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        boxShadow: active
          ? "0 0 0 4px var(--accent-soft)"
          : "var(--shadow-card)",
      }}
    >
      {/* Preview shell — usa el theme aplicado dentro */}
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{
          background:
            meta.id === "liquid-glass"
              ? "#0c0a1f"
              : "var(--bg-page)",
        }}
      >
        {/* Aurora gradient para liquid-glass (replica del body::before) */}
        {meta.id === "liquid-glass" && (
          <div
            aria-hidden
            className="absolute inset-[-25%]"
            style={{
              background: `
                radial-gradient(circle at 22% 28%, #ed6808 0%, transparent 55%),
                radial-gradient(circle at 78% 72%, #ff7e22 0%, transparent 42%),
                radial-gradient(circle at 80% 18%, #06b6d4 0%, transparent 38%),
                radial-gradient(circle at 25% 85%, #ec4899 0%, transparent 38%),
                radial-gradient(circle at 50% 55%, #3b82f6 0%, transparent 32%)
              `,
              filter: "blur(20px) saturate(1.3)",
              opacity: 0.55,
            }}
          />
        )}

        {/* Mini layout: header + body */}
        <div className="relative flex h-full flex-col">
          {/* Mini header */}
          <div
            className="flex items-center justify-between px-2.5 py-1.5"
            style={{
              background: "var(--bg-header)",
              color: "var(--text-on-header)",
            }}
          >
            <span className="text-[8px] font-bold uppercase tracking-wider">
              Dashboard
            </span>
            <span
              className="text-[7px]"
              style={{ color: "var(--text-on-header-muted)" }}
            >
              Susazón V3
            </span>
          </div>

          {/* Body — KPI card + chart */}
          <div className="flex-1 space-y-2 p-2.5">
            {/* Mini KPI card */}
            <div
              className="rounded-[var(--radius-sm)] border px-2.5 py-1.5"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <div
                className="text-[7px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Venta Abr 26
              </div>
              <div
                className="mt-0.5 text-base font-bold tabular-nums leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                $118.1M
              </div>
              <div
                className="mt-0.5 text-[7px]"
                style={{ color: "var(--success)" }}
              >
                ↑ +12% vs Abr 25
              </div>
            </div>

            {/* Mini chart — 3 barras */}
            <div className="flex h-12 items-end justify-around gap-1.5 px-1">
              <Bar pct={45} label="24" color="var(--chart-2024)" />
              <Bar pct={70} label="25" color="var(--chart-2025)" />
              <Bar pct={95} label="26" color="var(--chart-2026)" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer con label + description (en theme actual del modal, no del preview) */}
      <div
        className="border-t px-4 py-3 text-left"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {meta.label}
          </span>
          {active && (
            <Check
              size={14}
              style={{ color: "var(--accent)" }}
              aria-label="Activo"
            />
          )}
        </div>
        <p
          className="mt-0.5 text-[11px] leading-snug"
          style={{ color: "var(--text-muted)" }}
        >
          {meta.description}
        </p>
      </div>
    </button>
  );
}

function Bar({
  pct,
  label,
  color,
}: {
  pct: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <div
        className="w-full rounded-t-sm"
        style={{ background: color, height: `${pct}%`, minHeight: 6 }}
      />
      <span
        className="text-[7px] font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}
