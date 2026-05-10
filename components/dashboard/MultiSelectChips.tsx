"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";

interface Props {
  /** Lista completa de opciones disponibles (nombres) */
  options: string[];
  /** Items actualmente seleccionados */
  selected: string[];
  /** Handler de cambio */
  onChange: (next: string[]) => void;
  /** Máximo de items seleccionables (lock estricto) */
  maxItems?: number;
  /** Placeholder del input */
  placeholder?: string;
  /** Texto cuando no hay selección — para indicar default */
  emptyLabel?: string;
  /** Width del input */
  inputWidth?: string;
}

/**
 * Multi-select con chips inline estilo Notion / Linear.
 *
 * Comportamiento:
 *   - Input de búsqueda + dropdown con opciones filtradas
 *   - Click en opción → toggle seleccionado
 *   - Items seleccionados aparecen como chips removibles arriba del input
 *   - Lock estricto cuando se llega al maxItems (opciones nuevas se ven
 *     deshabilitadas con tooltip)
 *   - Backspace en input vacío → remueve último chip
 *   - Escape → cierra dropdown
 *   - Click fuera → cierra dropdown
 *
 * Stateless — el padre maneja `selected` y persistencia (localStorage).
 */
export function MultiSelectChips({
  options,
  selected,
  onChange,
  maxItems = 15,
  placeholder = "Buscar…",
  emptyLabel = "Mostrando default",
  inputWidth = "min-w-[220px]",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cerrar dropdown al click fuera
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isAtLimit = selected.length >= maxItems;

  // Filtrar opciones por query (case-insensitive). Mostrar primero las
  // no seleccionadas.
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options;
    const selectedSet = new Set(selected);
    const notSelected = all.filter((o) => !selectedSet.has(o));
    const alreadySelected = all.filter((o) => selectedSet.has(o));
    return [...notSelected, ...alreadySelected];
  }, [options, query, selected]);

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
      return;
    }
    if (selected.length >= maxItems) return; // lock
    onChange([...selected, name]);
  }

  function removeChip(name: string) {
    onChange(selected.filter((s) => s !== name));
  }

  function clearAll() {
    onChange([]);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      e.preventDefault();
      onChange(selected.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative inline-flex flex-col gap-1.5">
      {/* Chips de seleccionados (arriba del input) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-[var(--radius)] border px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: "var(--accent-soft)",
                borderColor: "var(--accent)",
                color: "var(--accent)",
                maxWidth: 180,
              }}
            >
              <span className="truncate" title={name}>
                {name}
              </span>
              <button
                type="button"
                onClick={() => removeChip(name)}
                aria-label={`Quitar ${name}`}
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-[var(--accent)] hover:text-white"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Limpiar
          </button>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {selected.length}/{maxItems}
          </span>
        </div>
      )}

      {/* Input de búsqueda */}
      <div
        className={`flex items-center gap-2 rounded-[var(--radius)] border px-2.5 py-1.5 ${inputWidth}`}
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <Search
          size={14}
          style={{ color: "var(--text-muted)" }}
          className="shrink-0"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : `${selected.length} seleccionados`}
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        {selected.length === 0 && (
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              background: "var(--bg-surface-muted)",
              color: "var(--text-muted)",
            }}
          >
            {emptyLabel}
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-[var(--radius-lg)] border py-1 shadow-lg"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          {filteredOptions.length === 0 ? (
            <div
              className="px-3 py-2 text-center text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {query
                ? `Sin resultados para "${query}"`
                : "Sin opciones disponibles"}
            </div>
          ) : (
            <>
              {isAtLimit && (
                <div
                  className="border-b px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--warning-soft)",
                    borderColor: "var(--border)",
                    color: "var(--warning)",
                  }}
                >
                  Máximo {maxItems} alcanzado · quita uno para agregar otro
                </div>
              )}
              {filteredOptions.slice(0, 100).map((name) => {
                const isSelected = selected.includes(name);
                const disabled = !isSelected && isAtLimit;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => !disabled && toggle(name)}
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--bg-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      color: isSelected
                        ? "var(--accent)"
                        : "var(--text-primary)",
                      fontWeight: isSelected ? 600 : 400,
                      background: isSelected
                        ? "var(--accent-soft)"
                        : "transparent",
                    }}
                  >
                    <span className="truncate" title={name}>
                      {name}
                    </span>
                    {isSelected && (
                      <Check
                        size={13}
                        style={{ color: "var(--accent)" }}
                        className="shrink-0"
                      />
                    )}
                  </button>
                );
              })}
              {filteredOptions.length > 100 && (
                <div
                  className="border-t px-3 py-1.5 text-center text-[10px]"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Mostrando 100 de {filteredOptions.length} · escribe para
                  filtrar
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
