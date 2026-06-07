"use client";

/**
 * ItemPicker — selector single-select con búsqueda, para elegir UN item
 * (ej. un SKU entre cientos) en el sub-análisis "Dispersión de precio".
 *
 * Muestra el item seleccionado; al abrir, un input de búsqueda + lista
 * filtrada con volumen (kg) y precio/kg de referencia. Click fuera / Escape
 * cierra. Stateless: el padre maneja `value` y persistencia.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

export interface PickerOption {
  name: string;
  kg: number;
  precioKg: number;
}

interface Props {
  options: PickerOption[];
  value: string | null;
  onChange: (next: string) => void;
  placeholder?: string;
  formatKg: (n: number) => string;
  formatMoney: (n: number) => string;
}

export function ItemPicker({
  options,
  value,
  onChange,
  placeholder = "Buscar…",
  formatKg,
  formatMoney,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    // Focus al abrir
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      clearTimeout(t);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
    return list.slice(0, 200); // cap visual
  }, [options, query]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-[240px] max-w-[360px] items-center justify-between gap-2 rounded-[var(--radius)] border px-3 py-1.5 text-left text-[13px]"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <span className="truncate font-semibold">
          {value ?? "Selecciona un item…"}
        </span>
        <ChevronDown
          size={14}
          style={{ color: "var(--text-muted)" }}
          className="shrink-0"
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-30 w-[360px] overflow-hidden rounded-[var(--radius)] border shadow-lg"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="flex items-center gap-2 border-b px-2.5 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            <Search size={13} style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-[13px] outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div
                className="px-3 py-3 text-center text-[12px]"
                style={{ color: "var(--text-muted)" }}
              >
                Sin resultados
              </div>
            ) : (
              filtered.map((o) => {
                const active = o.name === value;
                return (
                  <button
                    key={o.name}
                    type="button"
                    onClick={() => {
                      onChange(o.name);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--bg-surface-muted)]"
                    style={{
                      background: active
                        ? "var(--accent-soft)"
                        : "transparent",
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {active && (
                        <Check
                          size={12}
                          style={{ color: "var(--accent)" }}
                          className="shrink-0"
                        />
                      )}
                      <span
                        className="truncate font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {o.name}
                      </span>
                    </span>
                    <span
                      className="shrink-0 tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {formatKg(o.kg)} · {formatMoney(o.precioKg)}/kg
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
