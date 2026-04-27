"use client";

import { Construction } from "lucide-react";

interface PlaceholderTabProps {
  title: string;
  note?: string;
}

/**
 * Estado vacío para tabs cuyo contenido aún no está implementado.
 * Reemplazar por el componente real conforme avancemos en Fase 2d/3.
 */
export function PlaceholderTab({ title, note }: PlaceholderTabProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed py-16 text-center"
      style={{
        borderColor: "var(--border-strong)",
        background: "var(--bg-surface-muted)",
      }}
    >
      <Construction
        size={32}
        style={{ color: "var(--text-muted)" }}
      />
      <h3
        className="mt-3 text-base font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p
        className="mt-1 max-w-md px-6 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {note ??
          "Este tab aún no está implementado. Se construye en una fase posterior."}
      </p>
    </div>
  );
}
