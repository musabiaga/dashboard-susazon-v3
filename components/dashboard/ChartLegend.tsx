"use client";

export type LegendItemType = "bar" | "bar-stacked" | "line-solid" | "line-dashed";

export interface ChartLegendItem {
  label: string;
  color: string;
  type: LegendItemType;
}

export interface ChartLegendSection {
  /** Título corto que aparece como mini-header (ej: "Venta", "Margen %") */
  title: string;
  /** Tipo visual del grupo (ej: "barras", "líneas") — aparece entre paréntesis junto al título */
  visualKind: string;
  items: ChartLegendItem[];
}

interface Props {
  sections: ChartLegendSection[];
  /** Si true, muestra las secciones lado a lado en una fila (compacto).
   *  Si false, secciones apiladas verticalmente. Default: true. */
  inline?: boolean;
}

/**
 * Leyenda custom para charts del dashboard. Agrupa items en secciones con
 * mini-header que indica qué tipo visual es cada grupo (barras vs líneas).
 *
 * Diseñada para ser compacta — NO roba plot area al chart cuando se usa
 * en `<Legend content={<ChartLegend ... />} />` de Recharts.
 */
export function ChartLegend({ sections, inline = true }: Props) {
  return (
    <div
      className={
        inline
          ? "flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-2 py-0.5"
          : "flex flex-col items-center gap-1.5 px-2 py-0.5"
      }
      style={{ fontSize: 11 }}
    >
      {sections.map((section, idx) => (
        <div
          key={section.title}
          className="flex flex-wrap items-center gap-x-3 gap-y-0.5"
        >
          {/* Mini-header */}
          <span
            className="flex items-baseline gap-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            <span style={{ color: "var(--text-secondary)" }}>{section.title}</span>
            <span style={{ opacity: 0.7 }}>({section.visualKind})</span>
          </span>
          {/* Items */}
          {section.items.map((item) => (
            <span
              key={`${section.title}-${item.label}`}
              className="flex items-center gap-1.5 whitespace-nowrap"
              style={{ color: "var(--text-secondary)" }}
            >
              <LegendIcon type={item.type} color={item.color} />
              <span>{item.label}</span>
            </span>
          ))}
          {/* Separador entre secciones (excepto la última) */}
          {idx < sections.length - 1 && inline && (
            <span
              className="hidden md:inline"
              style={{ color: "var(--border-strong)", opacity: 0.5 }}
              aria-hidden
            >
              │
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function LegendIcon({
  type,
  color,
}: {
  type: LegendItemType;
  color: string;
}) {
  if (type === "bar") {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
    );
  }
  if (type === "bar-stacked") {
    // Cuadrado dividido en 2 tonos verticales (sólido abajo + translúcido arriba)
    // para indicar visualmente que la barra está apilada en 2 segmentos
    return (
      <span
        className="inline-flex h-3 w-2.5 flex-col-reverse overflow-hidden rounded-sm"
        aria-hidden
      >
        <span style={{ background: color, height: "60%" }} />
        <span style={{ background: color, height: "40%", opacity: 0.35 }} />
      </span>
    );
  }
  if (type === "line-solid") {
    return (
      <span
        className="inline-block h-0.5 w-4"
        style={{ background: color, borderRadius: 1 }}
      />
    );
  }
  // line-dashed
  return (
    <span
      className="inline-block h-0 w-4"
      style={{
        borderTop: `2px dashed ${color}`,
      }}
    />
  );
}
