"use client";

/**
 * InsightsTab — tab nuevo del dashboard. Espacio para análisis avanzados
 * que NO son operativos del día a día (eso vive en Tracking/Ventas/Productos/etc).
 *
 * Arquitectura: el tab funciona como contenedor con sub-toggle de análisis.
 * Sub-análisis actuales: Concentración (Pareto/Treemap), Precio $/kg
 * (dispersión), Cuadrante (BCG) y Estacionalidad (heatmap). Cada uno es una
 * entrada de SUB_ANALYSES (con su `help` para el popover del foco) y un
 * componente independiente; agregar/quitar uno = editar el arreglo. El
 * sub-toggle aparece solo cuando hay más de uno.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { ConcentracionAnalysis } from "@/components/dashboard/insights/ConcentracionAnalysis";
import { PrecioAnalysis } from "@/components/dashboard/insights/PrecioAnalysis";
import { CuadranteAnalysis } from "@/components/dashboard/insights/CuadranteAnalysis";
import { EstacionalidadAnalysis } from "@/components/dashboard/insights/EstacionalidadAnalysis";
import { PenetracionAnalysis } from "@/components/dashboard/insights/PenetracionAnalysis";

type SubAnalysis = "concentracion" | "precio" | "cuadrante" | "estacionalidad" | "penetracion";

const STORAGE_KEY = "insights-sub-analysis";

interface Props {
  /** Hoy CDMX para los date pickers de los sub-análisis. */
  today: { year: number; month: number; day: number };
  /** Territorios efectivos según selección del sidebar:
   *   - null = "Todos los territorios visibles" (RLS hace su trabajo)
   *   - [] = "Ninguno" (universo vacío)
   *   - ["X", "Y"] = filtrar a esos específicos
   *  Si cambia, los sub-análisis re-fetchean para mantener consistencia
   *  con el resto del dashboard. */
  territorios: string[] | null;
  /** Etiqueta del contexto actual ("Todos", "Cancún", "3 territorios…")
   *  para mostrar al usuario claramente qué está viendo. */
  contextLabel: string;
  /** Permiso para descargar Excel (lo usa el Insight Penetración). */
  canExportExcel?: boolean;
}

interface SubAnalysisDef {
  key: SubAnalysis;
  label: string;
  description: string;
  /** Explicación de "cómo leer esto", mostrada en el popover del foco. */
  help: ReactNode;
}

const SUB_ANALYSES: SubAnalysisDef[] = [
  {
    key: "concentracion",
    label: "Concentración",
    description:
      "Análisis tipo Pareto: ¿qué tan dependientes somos de los top clientes / grupos / productos?",
    help: (
      <div className="space-y-1.5">
        <p>
          Mide la <strong>dependencia</strong> del negocio en pocos clientes,
          grupos, productos o territorios.
        </p>
        <p>
          • <strong>Treemap</strong>: el área de cada bloque = su peso en el total.
        </p>
        <p>
          • <strong>Pareto</strong>: barras de mayor a menor + línea de{" "}
          <strong>% acumulado</strong> → lees “el top N cubre X% del total”.
          Entre más rápido sube la línea, más concentrado (y más riesgoso).
        </p>
        <p>
          Puedes <strong>excluir</strong> items para recalcular el 100% sin ellos.
        </p>
      </div>
    ),
  },
  {
    key: "precio",
    label: "Precio $/kg",
    description:
      "Dispersión de precio: ¿a qué precio/kg le vendemos el mismo producto a cada cliente? ¿Dónde dejamos dinero en la mesa?",
    help: (
      <div className="space-y-1.5">
        <p>
          Cada punto es un <strong>cliente</strong> que compra el item: X ={" "}
          <strong>precio/kg</strong> que paga, Y = volumen (kg).
        </p>
        <p>
          • Línea negra = <strong>promedio ponderado</strong>; línea roja =
          umbral “paga barato”.
        </p>
        <p>• 🔴 paga bajo el umbral · 🟡 bajo el promedio · 🟢 en/sobre.</p>
        <p>
          <strong>Dinero en la mesa</strong> = (promedio − su precio) × su
          volumen: lo que ganarías subiéndolo al promedio.
        </p>
      </div>
    ),
  },
  {
    key: "cuadrante",
    label: "Cuadrante",
    description:
      "Cartera tipo BCG: tamaño vs crecimiento. ¿A quién cuido (estrellas), a quién rescato (en riesgo), en quién apuesto y a quién suelto?",
    help: (
      <div className="space-y-1.5">
        <p>
          Cada punto es un item: X = <strong>tamaño</strong> (venta, escala log),
          Y = <strong>crecimiento</strong> vs el mismo rango del año anterior,
          burbuja = margen $.
        </p>
        <p>
          • <strong>Estrella</strong> grande+crece · <strong>En riesgo</strong>{" "}
          grande+cae · <strong>Apuesta</strong> chico+crece ·{" "}
          <strong>Marginal</strong> chico+cae.
        </p>
        <p>
          Mueve los <strong>umbrales</strong> para redefinir “grande” y “crece”.
          Los <strong>Nuevos</strong> (sin venta el año anterior) van aparte.
        </p>
      </div>
    ),
  },
  {
    key: "estacionalidad",
    label: "Estacionalidad",
    description:
      "Heatmap mes × dimensión: ¿qué meses son pico/valle por grupo, territorio, cliente o SKU? ¿Cuándo compro, produzco y promociono?",
    help: (
      <div className="space-y-1.5">
        <p>
          Heatmap mes × item. Color: 🔵 <strong>valle</strong> ·{" "}
          🟧 <strong>pico</strong>.
        </p>
        <p>
          <strong>Índice</strong> = valor del mes ÷ <strong>promedio mensual de
          ese item</strong> × 100. Es <strong>por fila</strong>:{" "}
          <strong>100 = mes típico</strong> del item, 130 = +30%, 70 = −30%.
        </p>
        <p>
          Normaliza por tamaño → comparas el patrón de items grandes y chicos.
          Cambia a <strong>Absoluto</strong> para ver kilos/pesos reales.
        </p>
        <p>
          En el año parcial (2026) el 100 se calcula sobre los meses con datos.
        </p>
      </div>
    ),
  },
  {
    key: "penetracion",
    label: "Penetración / Canasta",
    description:
      "¿Qué tan amplia es la canasta? Por cliente: cuántos SKUs compra. Por SKU: cuántos clientes lo compran. Todo vs el año anterior.",
    help: (
      <div className="space-y-1.5">
        <p>
          Bidireccional: <strong>Por cliente</strong> = # de SKUs distintos que
          compra · <strong>Por SKU</strong> = # de clientes distintos que lo
          compran. Compara contra el <strong>mismo tramo de fechas</strong> del
          año anterior.
        </p>
        <p>
          • <strong>Scatter</strong>: X = Δ del conteo, Y = Δ venta. 🟢 amplía y
          crece · 🔴 angosta y cae · 🟡 mixto.
        </p>
        <p>
          • <strong>Tabla</strong>: cada fila se abre y muestra{" "}
          <strong>todos</strong> los SKUs (o clientes), marcando{" "}
          <strong>nuevos</strong> y los que <strong>dejó de comprar</strong>.
        </p>
        <p>
          Sirve para <strong>cross-sell</strong> (ampliar canasta) y para
          rescatar a quien la está angostando.
        </p>
      </div>
    ),
  },
];

export function InsightsTab({ today, territorios, contextLabel, canExportExcel = false }: Props) {
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
          <div className="group relative">
            <div
              className="flex h-8 w-8 shrink-0 cursor-help items-center justify-center rounded-full ring-[var(--accent)] transition-all group-hover:ring-2"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
              }}
              tabIndex={0}
              aria-describedby="insights-help-popover"
            >
              <Lightbulb size={16} />
            </div>
            {/* Badge "?" para indicar que el foco da ayuda al hover */}
            <span
              className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
              style={{
                background: "var(--accent)",
                color: "#fff",
                boxShadow: "0 0 0 2px var(--bg-surface)",
              }}
            >
              ?
            </span>
            {/* Popover de ayuda (con puente transparente pt-2.5 para no cerrarse) */}
            <div
              id="insights-help-popover"
              role="tooltip"
              className="invisible absolute left-0 top-full z-30 pt-2.5 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
              <div
                className="w-[340px] max-w-[86vw] rounded-[var(--radius-lg)] border p-3 text-[12px] leading-relaxed"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div
                  className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--accent)" }}
                >
                  <Lightbulb size={12} /> Cómo leer “{activeDef.label}”
                </div>
                {activeDef.help}
              </div>
            </div>
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
      {active === "concentracion" && (
        <ConcentracionAnalysis
          today={today}
          territorios={territorios}
          contextLabel={contextLabel}
        />
      )}
      {active === "precio" && (
        <PrecioAnalysis
          today={today}
          territorios={territorios}
          contextLabel={contextLabel}
        />
      )}
      {active === "cuadrante" && (
        <CuadranteAnalysis
          today={today}
          territorios={territorios}
          contextLabel={contextLabel}
        />
      )}
      {active === "estacionalidad" && (
        <EstacionalidadAnalysis
          today={today}
          territorios={territorios}
          contextLabel={contextLabel}
        />
      )}
      {active === "penetracion" && (
        <PenetracionAnalysis
          today={today}
          territorios={territorios}
          contextLabel={contextLabel}
          canExportExcel={canExportExcel}
        />
      )}
    </div>
  );
}
