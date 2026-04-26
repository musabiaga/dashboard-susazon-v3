"use client";

import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
        aria-label="Cambiar tema"
      >
        <Palette size={16} />
        <span className="hidden sm:inline">Tema</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Cerrar selector"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-lg">
            {THEMES.map((t) => (
              <ThemeOption
                key={t.id}
                id={t.id}
                label={t.label}
                description={t.description}
                preview={t.preview}
                selected={theme === t.id}
                onSelect={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ThemeOption({
  id,
  label,
  description,
  preview,
  selected,
  onSelect,
}: {
  id: ThemeId;
  label: string;
  description: string;
  preview: { bg: string; surface: string; accent: string; header: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-[var(--bg-surface-muted)]",
        selected && "bg-[var(--accent-soft)]"
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[var(--border)]"
        aria-hidden
      >
        <span className="flex-1" style={{ background: preview.header }} />
        <span className="flex-1" style={{ background: preview.bg }} />
        <span
          className="flex-1"
          style={{ background: preview.accent }}
          data-theme-id={id}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
        <div className="truncate text-xs text-[var(--text-secondary)]">{description}</div>
      </div>
      {selected && <Check size={16} className="text-[var(--accent)]" />}
    </button>
  );
}
