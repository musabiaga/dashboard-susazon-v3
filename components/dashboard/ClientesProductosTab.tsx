"use client";

/**
 * ClientesProductosTab — contenedor del tab unificado "Clientes y Productos"
 * (Fase 1 de la combinación de tabs).
 *
 * Toggle maestro de dimensión "Ranking por: Clientes | Productos" que alterna
 * entre la vista completa de Clientes (DimensionTab) y la de Productos
 * (ProductosTab). Cada vista conserva TODAS sus features actuales intactas
 * — este contenedor solo maneja el toggle + persistencia.
 *
 * Las vistas se reciben ya construidas como props (clienteView / productoView)
 * desde DashboardClient, donde vive el wiring de datos. Solo la vista activa
 * se monta (la otra es un elemento sin renderizar → sin fetch hasta que la
 * seleccionas).
 *
 * Fase 2 (futuro): desacoplar gráfica y tabla en toggles independientes.
 * Fase 3 (futuro): rango de fechas global.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Users, Package } from "lucide-react";

type Dim = "clientes" | "productos";
const STORAGE_KEY = "clientes-productos-dimension";

interface Props {
  clienteView: ReactNode;
  productoView: ReactNode;
}

export function ClientesProductosTab({ clienteView, productoView }: Props) {
  const [dim, setDim] = useState<Dim>("clientes");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "clientes" || saved === "productos") setDim(saved);
    } catch {
      // ignore
    }
  }, []);

  const select = (d: Dim) => {
    setDim(d);
    try {
      window.localStorage.setItem(STORAGE_KEY, d);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Toggle maestro de dimensión */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Ranking por:
        </span>
        <div
          className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
          style={{
            background: "var(--bg-surface-muted)",
            borderColor: "var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => select("clientes")}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: dim === "clientes" ? "var(--bg-surface)" : "transparent",
              color: dim === "clientes" ? "var(--accent)" : "var(--text-muted)",
              boxShadow: dim === "clientes" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            <Users size={13} /> Clientes
          </button>
          <button
            type="button"
            onClick={() => select("productos")}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: dim === "productos" ? "var(--bg-surface)" : "transparent",
              color: dim === "productos" ? "var(--accent)" : "var(--text-muted)",
              boxShadow: dim === "productos" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            <Package size={13} /> Productos
          </button>
        </div>
      </div>

      {/* Vista activa (solo una se monta) */}
      {dim === "clientes" ? clienteView : productoView}
    </div>
  );
}
