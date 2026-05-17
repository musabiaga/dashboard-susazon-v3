"use client";

/**
 * InsightsTab — tab nuevo del dashboard. Espacio para análisis avanzados
 * que NO son operativos del día a día (eso vive en Tracking/Ventas/Productos/etc).
 *
 * Arquitectura: el tab funciona como contenedor con sub-toggle de análisis.
 * En v1 solo hay "Concentración" (análisis Pareto + Treemap/Radar). En el
 * futuro se pueden agregar más sub-análisis (Estacionalidad, Cohortes,
 * Crecimiento, etc.) y el sub-toggle se ajusta automáticamente.
 */

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { ConcentracionAnalysis } from "@/components/dashboard/insights/ConcentracionAnalysis";

type SubAnalysis = "concentracion";

const STORAGE_KEY = "insights-sub-analysis";

interface Props {
  /** Hoy CDMX para los date pickers de los sub-análisis. */
  today: { year: number; month: number; day: number };
}

interface SubAnalysisDef {
  key: SubAnalysis;
  label: string;
  description: string;
}

const SUB_ANALYSES: SubAnalysisDef[] = [
  {
    key: "concentracion",
    label: "Concentración",
    description:
      "Análisis tipo Pareto: ¿qué tan dependientes somos de los top clientes / grupos / productos?",
  },
  // Futuros sub-análisis se agregan aquí:
  // { key: "estacionalidad", label: "Estacionalidad", description: "..." },
  // { key: "crecimiento", label: "Crecimiento YoY", description: "..." },
];

export function InsightsTab({ today }: Props) {
  const [active, setActive] = useState<SubAnalysis>("concentracion");

  // Recordar último sub-análisis usado
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && SUB_ANALYSES.some((s) => s.key === saved)) {
        setActive(saved as SubAnalysis);
      }
    } catch {
      // ignore
    }
  }, []);

  const selectSub = (key: SubAnalysis) => {
    setActive(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // ignore
    }
  };

  const activeDef = SUB_ANALYSES.find((s) => s.key === active) ?? SUB_ANALYSES[0];

  return (
    <div className="space-y-4">
      {/* Header del tab con sub-toggle de análisis */}
      <div
        className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            <Lightbulb size={16} />
          </div>
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-primary)" }}
            >
              Insights · {activeDef.label}
            </h3>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {activeDef.description}
            </p>
          </div>
        </div>

        {/* Sub-toggle entre análisis. En v1 solo hay 1, así que se renderiza
            como info-pill no clickeable. Cuando agreguemos más, se convertirá
            automáticamente en toggle real. */}
        {SUB_ANALYSES.length > 1 ? (
          <div
            className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
            style={{
              background: "var(--bg-surface-muted)",
              borderColor: "var(--border)",
            }}
          >
            {SUB_ANALYSES.map((sa) => {
              const isActive = sa.key === active;
              return (
                <button
                  key={sa.key}
                  type="button"
                  onClick={() => selectSub(sa.key)}
                  className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    background: isActive ? "var(--bg-surface)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    boxShadow: isActive ? "var(--shadow-card)" : "none",
                  }}
                >
                  {sa.label}
                </button>
              );
            })}
          </div>
        ) : (
          <span
            className="rounded-[var(--radius)] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: "var(--accent-soft)",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
          >
            v1 · más sub-análisis próximamente
          </span>
        )}
      </div>

      {/* Render del sub-análisis activo */}
      {active === "concentracion" && <ConcentracionAnalysis today={today} />}
    </div>
  );
}
