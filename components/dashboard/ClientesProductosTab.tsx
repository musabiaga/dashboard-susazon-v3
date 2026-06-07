"use client";

/**
 * ClientesProductosTab — contenedor del tab unificado "Clientes y Productos"
 * (Fase 2: toggles independientes de dimensión para gráfica y tabla).
 *
 * Tres controles en el header:
 *   - Gráfica: [ Clientes | Productos ]
 *   - Tabla:   [ Clientes | Productos ]
 *   - Pesos / Kilos  (compartido)
 *
 * Estrategia clave para no romper Clientes:
 *   - Si la dimensión de gráfica == tabla → renderiza UN solo DimensionTab
 *     completo (monolítico, como el tab Clientes/Productos de siempre: el
 *     buscador filtra gráfica + tabla). Default = ambos en Clientes → idéntico
 *     al comportamiento histórico.
 *   - Si difieren → renderiza DOS instancias: una solo-gráfica (dim de gráfica)
 *     y otra solo-tabla (dim de tabla). Ahí la "combinabilidad" (ej. gráfica de
 *     Clientes + tabla de Productos).
 *
 * El modo Pesos/Kilos lo controla el contenedor (controlledMode) → un solo
 * toggle para ambas secciones, en el header.
 *
 * Las instancias de DimensionTab se construyen vía la render-prop `render`
 * (en DashboardClient, donde vive el wiring de datos por dimensión).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Users, Package } from "lucide-react";

export type CYPDim = "clientes" | "productos";
export type CYPMode = "pesos" | "kg";

interface RenderArgs {
  dim: CYPDim;
  mode: CYPMode;
  showChart: boolean;
  showTable: boolean;
}

interface Props {
  /** Construye un DimensionTab para la dimensión dada con la visibilidad y
   *  modo indicados. La provee DashboardClient. */
  render: (args: RenderArgs) => ReactNode;
}

const CHART_DIM_KEY = "cyp-chart-dim";
const TABLE_DIM_KEY = "cyp-table-dim";
const MODE_KEY = "cyp-mode";

function loadDim(key: string): CYPDim {
  try {
    const v = window.localStorage.getItem(key);
    if (v === "clientes" || v === "productos") return v;
  } catch {
    // ignore
  }
  return "clientes";
}

export function ClientesProductosTab({ render }: Props) {
  const [chartDim, setChartDim] = useState<CYPDim>("clientes");
  const [tableDim, setTableDim] = useState<CYPDim>("clientes");
  const [mode, setMode] = useState<CYPMode>("pesos");

  useEffect(() => {
    setChartDim(loadDim(CHART_DIM_KEY));
    setTableDim(loadDim(TABLE_DIM_KEY));
    try {
      const m = window.localStorage.getItem(MODE_KEY);
      if (m === "pesos" || m === "kg") setMode(m);
    } catch {
      // ignore
    }
  }, []);

  const selectChartDim = (d: CYPDim) => {
    setChartDim(d);
    try {
      window.localStorage.setItem(CHART_DIM_KEY, d);
    } catch {
      // ignore
    }
  };
  const selectTableDim = (d: CYPDim) => {
    setTableDim(d);
    try {
      window.localStorage.setItem(TABLE_DIM_KEY, d);
    } catch {
      // ignore
    }
  };
  const selectMode = (m: CYPMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      // ignore
    }
  };

  const sameDim = chartDim === tableDim;

  return (
    <div className="space-y-4">
      {/* Header de controles */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-lg)] border p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <DimToggle
          label="Gráfica"
          value={chartDim}
          onChange={selectChartDim}
        />
        <DimToggle
          label="Tabla"
          value={tableDim}
          onChange={selectTableDim}
        />
        {/* Pesos / Kilos compartido */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Volumen
          </span>
          <div
            className="inline-flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
            style={{
              background: "var(--bg-surface-muted)",
              borderColor: "var(--border)",
            }}
          >
            {(["pesos", "kg"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMode(m)}
                className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: mode === m ? "var(--bg-surface)" : "transparent",
                  color: mode === m ? "var(--accent)" : "var(--text-muted)",
                  boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {m === "pesos" ? "Pesos" : "Kilos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido: monolítico (misma dim) o partido (dims distintas) */}
      {sameDim ? (
        render({ dim: chartDim, mode, showChart: true, showTable: true })
      ) : (
        <>
          {render({ dim: chartDim, mode, showChart: true, showTable: false })}
          {render({ dim: tableDim, mode, showChart: false, showTable: true })}
        </>
      )}
    </div>
  );
}

function DimToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CYPDim;
  onChange: (d: CYPDim) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
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
          onClick={() => onChange("clientes")}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
          style={{
            background: value === "clientes" ? "var(--bg-surface)" : "transparent",
            color: value === "clientes" ? "var(--accent)" : "var(--text-muted)",
            boxShadow: value === "clientes" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          <Users size={13} /> Clientes
        </button>
        <button
          type="button"
          onClick={() => onChange("productos")}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
          style={{
            background: value === "productos" ? "var(--bg-surface)" : "transparent",
            color: value === "productos" ? "var(--accent)" : "var(--text-muted)",
            boxShadow: value === "productos" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          <Package size={13} /> Productos
        </button>
      </div>
    </div>
  );
}
