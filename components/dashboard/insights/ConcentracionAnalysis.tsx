"use client";

/**
 * ConcentracionAnalysis — primer sub-análisis del tab "Insights".
 *
 * Permite al usuario dimensionar la concentración / dependencia del negocio
 * sobre clientes, grupos o productos en distintas métricas (Pesos, Kilos,
 * Margen $, Margen %) en un rango de fechas libre.
 *
 * Visualización dual:
 *   - Treemap: bloques proporcionales al valor de cada item
 *   - Radar: cada eje = un item, valor = % del universo total
 *
 * El usuario empieza con Top 7 + "Resto del universo" (= octágono) y puede
 * borrar items o agregar otros sin límite. La tabla Pareto debajo da los
 * números exactos.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  Treemap,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  Loader2,
  LayoutGrid,
  Radar as RadarIcon,
  X,
} from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/dashboard/DateRangePicker";
import { MultiSelectChips } from "@/components/dashboard/MultiSelectChips";

type Dimension = "clientes" | "grupos" | "productos";
type Metric = "venta" | "kg" | "margen" | "margen_pct";
type ChartKind = "treemap" | "radar";

const DIMENSION_LABEL: Record<Dimension, { sg: string; pl: string }> = {
  clientes: { sg: "Cliente", pl: "Clientes" },
  grupos: { sg: "Grupo", pl: "Grupos" },
  productos: { sg: "Producto (SKU)", pl: "Productos" },
};

const METRIC_LABEL: Record<Metric, string> = {
  venta: "Pesos vendidos",
  kg: "Kilos vendidos",
  margen: "Margen $",
  margen_pct: "Margen %",
};

const DEFAULT_TOP_N = 7;
const STORAGE_KEY_DIMENSION = "insights-concentracion-dimension";
const STORAGE_KEY_METRIC = "insights-concentracion-metric";
const STORAGE_KEY_CHART = "insights-concentracion-chart";

interface ApiItem {
  name: string;
  venta: number;
  kg: number;
  margen: number;
  margen_pct: number;
}

interface ApiResponse {
  from: string;
  to: string;
  dimension: Dimension;
  total_items: number;
  universe: { venta: number; kg: number; margen: number; margen_pct: number };
  items: ApiItem[];
}

interface Props {
  /** Día/mes/año "hoy" CDMX, viene del server. Pasado para no llamar al server
   *  desde el cliente solo por la fecha. */
  today: { year: number; month: number; day: number };
}

export function ConcentracionAnalysis({ today }: Props) {
  // ============== Estado de controles ==============
  const initialRange: DateRange = useMemo(
    () => ({
      from: `${today.year}-${String(today.month).padStart(2, "0")}-01`,
      to: `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
    }),
    [today]
  );

  const [range, setRange] = useState<DateRange>(initialRange);
  const [dimension, setDimension] = useState<Dimension>("clientes");
  const [metric, setMetric] = useState<Metric>("venta");
  const [chartKind, setChartKind] = useState<ChartKind>("treemap");
  // Items seleccionados manualmente (override del Top N default si .length > 0)
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  // Si el usuario nunca tocó la selección manual, usamos Top N. Al primer
  // click manual, isCustom = true y respetamos su elección.
  const [isCustom, setIsCustom] = useState(false);

  // Cargar preferencias persistidas
  useEffect(() => {
    try {
      const dim = window.localStorage.getItem(STORAGE_KEY_DIMENSION);
      if (dim === "clientes" || dim === "grupos" || dim === "productos") {
        setDimension(dim);
      }
      const met = window.localStorage.getItem(STORAGE_KEY_METRIC);
      if (
        met === "venta" ||
        met === "kg" ||
        met === "margen" ||
        met === "margen_pct"
      ) {
        setMetric(met);
      }
      const chart = window.localStorage.getItem(STORAGE_KEY_CHART);
      if (chart === "treemap" || chart === "radar") setChartKind(chart);
    } catch {
      // ignore
    }
  }, []);

  const persistDimension = (d: Dimension) => {
    setDimension(d);
    // Cambiar dimensión limpia la selección manual (los nombres ya no aplican)
    setSelectedItems([]);
    setIsCustom(false);
    try {
      window.localStorage.setItem(STORAGE_KEY_DIMENSION, d);
    } catch {}
  };
  const persistMetric = (m: Metric) => {
    setMetric(m);
    try {
      window.localStorage.setItem(STORAGE_KEY_METRIC, m);
    } catch {}
  };
  const persistChart = (c: ChartKind) => {
    setChartKind(c);
    try {
      window.localStorage.setItem(STORAGE_KEY_CHART, c);
    } catch {}
  };

  // ============== Fetch de data ==============
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      dimension,
    });
    fetch(`/api/insights/concentracion?${params.toString()}`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<ApiResponse>;
      })
      .then((j) => {
        if (cancelled) return;
        setData(j);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error desconocido");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, dimension]);

  // ============== Cálculos derivados ==============
  // Universo total según métrica seleccionada
  const universeValue = useMemo(() => {
    if (!data) return 0;
    if (metric === "margen_pct") return data.universe.margen_pct;
    return data.universe[metric === "venta" ? "venta" : metric === "kg" ? "kg" : "margen"];
  }, [data, metric]);

  // Helper para sacar el valor del item según métrica activa
  const valueOf = (item: ApiItem): number => {
    switch (metric) {
      case "venta":
        return item.venta;
      case "kg":
        return item.kg;
      case "margen":
        return item.margen;
      case "margen_pct":
        return item.margen_pct;
    }
  };

  // Items ordenados por la métrica activa (descendente). Re-ordena si cambia metric.
  const sortedItems = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => valueOf(b) - valueOf(a));
  }, [data, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  // Items disponibles para el multi-select
  const availableItems = useMemo(() => sortedItems.map((i) => i.name), [sortedItems]);

  // Items que se muestran en la visualización:
  //  - Si isCustom = true → respetamos selectedItems (en el orden del usuario)
  //  - Si isCustom = false → Top N default según la métrica
  const visibleItems: ApiItem[] = useMemo(() => {
    if (!data) return [];
    if (isCustom) {
      const byName = new Map(sortedItems.map((i) => [i.name, i]));
      return selectedItems
        .map((n) => byName.get(n))
        .filter((x): x is ApiItem => x != null);
    }
    return sortedItems.slice(0, DEFAULT_TOP_N);
  }, [data, isCustom, selectedItems, sortedItems]);

  // "Resto del universo" = lo que NO está en visibleItems
  const visibleSum = useMemo(
    () => visibleItems.reduce((s, i) => s + valueOf(i), 0),
    [visibleItems, metric] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const restoValue = Math.max(0, universeValue - visibleSum);
  // Para margen %, el "resto" se calcula distinto (es un margen, no se resta lineal)
  const restoPct =
    metric === "margen_pct"
      ? null // no aplica linealmente
      : universeValue > 0
        ? (restoValue / universeValue) * 100
        : 0;

  // ============== Update selection del multi-select ==============
  const onMultiSelectChange = (next: string[]) => {
    setSelectedItems(next);
    setIsCustom(next.length > 0);
  };

  const removeItem = (name: string) => {
    // Si está en Top N default → entra en custom mode con los otros 6
    if (!isCustom) {
      const current = visibleItems.map((i) => i.name).filter((n) => n !== name);
      setSelectedItems(current);
      setIsCustom(true);
    } else {
      setSelectedItems((prev) => prev.filter((n) => n !== name));
    }
  };

  const resetToTopN = () => {
    setSelectedItems([]);
    setIsCustom(false);
  };

  // ============== Formato del valor según métrica ==============
  const formatValue = (n: number): string => {
    if (metric === "venta" || metric === "margen") return formatMoney(n);
    if (metric === "kg") return formatKilos(n);
    return `${n.toFixed(1)}%`;
  };

  // ============== Data para Treemap ==============
  // Recharts Treemap requiere data con `name` y `size` (size define el área).
  // Para margen % no tiene sentido un treemap (negativo o muy pequeño se vería raro).
  const treemapData = useMemo(() => {
    const items = visibleItems.map((i) => ({
      name: i.name,
      size: Math.max(0, valueOf(i)),
      value: valueOf(i),
      pct: universeValue > 0 ? (valueOf(i) / universeValue) * 100 : 0,
    }));
    if (metric !== "margen_pct" && restoValue > 0) {
      items.push({
        name: "Resto del universo",
        size: restoValue,
        value: restoValue,
        pct: restoPct ?? 0,
      });
    }
    return items;
  }, [visibleItems, metric, restoValue, restoPct, universeValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============== Data para Radar ==============
  // Cada item = un eje. Valor = % del universo (0-100).
  const radarData = useMemo(() => {
    const items = visibleItems.map((i) => ({
      name: i.name,
      pct: universeValue > 0 ? (valueOf(i) / universeValue) * 100 : 0,
      raw: valueOf(i),
    }));
    if (metric !== "margen_pct") {
      items.push({
        name: "Resto",
        pct: restoPct ?? 0,
        raw: restoValue,
      });
    }
    return items;
  }, [visibleItems, metric, universeValue, restoValue, restoPct]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxRadarValue = useMemo(
    () => Math.max(10, ...radarData.map((d) => d.pct)),
    [radarData]
  );

  // ============== Stats panel ==============
  const cubrenPct = universeValue > 0 ? (visibleSum / universeValue) * 100 : 0;
  const topItem = visibleItems[0];
  const topItemPct =
    topItem && universeValue > 0
      ? (valueOf(topItem) / universeValue) * 100
      : 0;

  // ============== Tabla Pareto ==============
  // Calculamos acumulado para tabla
  const tableRows = useMemo(() => {
    let acum = 0;
    return visibleItems.map((i, idx) => {
      const v = valueOf(i);
      const pct = universeValue > 0 ? (v / universeValue) * 100 : 0;
      acum += pct;
      return {
        rank: idx + 1,
        name: i.name,
        value: v,
        pct,
        acumPct: acum,
        margenPct: i.margen_pct,
      };
    });
  }, [visibleItems, metric, universeValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============== Render ==============
  return (
    <div className="space-y-4">
      {/* ============ Toolbar superior con controles ============ */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Toggle Dimensión */}
        <ChipToggle
          label="Dimensión"
          options={[
            { value: "grupos", label: "Grupos" },
            { value: "clientes", label: "Clientes" },
            { value: "productos", label: "Productos" },
          ]}
          value={dimension}
          onChange={(v) => persistDimension(v as Dimension)}
        />
        {/* Toggle Métrica */}
        <ChipToggle
          label="Métrica"
          options={[
            { value: "venta", label: "Pesos" },
            { value: "kg", label: "Kilos" },
            { value: "margen", label: "Margen $" },
            { value: "margen_pct", label: "Margen %" },
          ]}
          value={metric}
          onChange={(v) => persistMetric(v as Metric)}
        />
        {/* Toggle Visualización */}
        <ChipToggle
          label="Vista"
          options={[
            { value: "treemap", label: "Treemap", icon: <LayoutGrid size={11} /> },
            { value: "radar", label: "Radar", icon: <RadarIcon size={11} /> },
          ]}
          value={chartKind}
          onChange={(v) => persistChart(v as ChartKind)}
        />
      </div>

      {/* ============ Multi-select de items ============ */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {isCustom
            ? `${selectedItems.length} ${DIMENSION_LABEL[dimension].pl.toLowerCase()} en análisis`
            : `Top ${Math.min(DEFAULT_TOP_N, visibleItems.length)} default`}
        </span>
        <MultiSelectChips
          options={availableItems}
          selected={isCustom ? selectedItems : visibleItems.map((i) => i.name)}
          onChange={onMultiSelectChange}
          maxItems={9999} // sin límite efectivo
          placeholder={`Agregar ${DIMENSION_LABEL[dimension].sg.toLowerCase()}…`}
          emptyLabel="Top default"
        />
        {isCustom && (
          <button
            type="button"
            onClick={resetToTopN}
            className="rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "var(--bg-surface)",
            }}
          >
            Volver al Top {DEFAULT_TOP_N}
          </button>
        )}
      </div>

      {/* ============ Panel de stats ============ */}
      <div
        className="grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] border p-4 sm:grid-cols-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <StatCell
          label="Universo total"
          value={formatValue(universeValue)}
          sub={`${data?.total_items ?? 0} ${DIMENSION_LABEL[dimension].pl.toLowerCase()}`}
        />
        <StatCell
          label="Items en análisis"
          value={String(visibleItems.length)}
          sub={`${METRIC_LABEL[metric]}`}
        />
        <StatCell
          label="Cubren del universo"
          value={`${cubrenPct.toFixed(1)}%`}
          sub={
            metric !== "margen_pct"
              ? `Resto: ${(100 - cubrenPct).toFixed(1)}%`
              : "—"
          }
        />
        <StatCell
          label="Top dependencia"
          value={topItem ? `${topItemPct.toFixed(1)}%` : "—"}
          sub={topItem?.name ?? "—"}
          subTruncate
        />
      </div>

      {/* ============ Errores / Loading ============ */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius)] border px-4 py-3 text-sm"
          style={{
            background: "var(--danger-soft)",
            borderColor: "var(--danger)",
            color: "var(--danger)",
          }}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ============ Visualización ============ */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {loading ? (
          <div
            className="flex items-center justify-center gap-2 py-32 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <Loader2 size={16} className="animate-spin" />
            Cargando…
          </div>
        ) : visibleItems.length === 0 ? (
          <div
            className="py-32 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin items para el rango y dimensión seleccionados.
          </div>
        ) : metric === "margen_pct" && chartKind === "treemap" ? (
          // Treemap con margen % no funciona bien (los valores son
          // comparables pero no representan "área del universo")
          <div
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            El treemap no aplica para Margen %. Usa la vista <strong>Radar</strong> o
            cambia a otra métrica para ver los bloques proporcionales.
          </div>
        ) : chartKind === "treemap" ? (
          <ResponsiveContainer width="100%" height={520}>
            <Treemap
              data={treemapData}
              dataKey="size"
              stroke="var(--bg-surface)"
              fill="var(--accent)"
              content={
                <TreemapBlock
                  formatValue={formatValue}
                  maxValue={Math.max(...treemapData.map((d) => d.size))}
                />
              }
            >
              <Tooltip content={<TreemapTooltip formatValue={formatValue} />} />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={520}>
            <RadarChart data={radarData} margin={{ top: 30, right: 60, bottom: 30, left: 60 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, Math.ceil(maxRadarValue / 10) * 10]}
                tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Radar
                name={METRIC_LABEL[metric]}
                dataKey="pct"
                stroke="var(--accent)"
                fill="var(--accent)"
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Tooltip
                content={
                  <RadarTooltip
                    formatValue={formatValue}
                    metricLabel={METRIC_LABEL[metric]}
                  />
                }
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ============ Tabla Pareto ============ */}
      {tableRows.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th align="center">#</Th>
                  <Th>{DIMENSION_LABEL[dimension].sg}</Th>
                  <Th align="right">{METRIC_LABEL[metric]}</Th>
                  <Th align="right">% Universo</Th>
                  <Th align="right">Acumulado</Th>
                  {metric !== "margen_pct" && <Th align="right">Margen %</Th>}
                  <Th align="center"></Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr
                    key={r.name}
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--bg-surface)"
                          : "var(--bg-surface-muted)",
                    }}
                  >
                    <Td align="center" subtle>
                      {r.rank}
                    </Td>
                    <Td>{r.name}</Td>
                    <Td align="right" bold>
                      {formatValue(r.value)}
                    </Td>
                    <Td align="right">{r.pct.toFixed(1)}%</Td>
                    <Td align="right" subtle>
                      {r.acumPct.toFixed(1)}%
                    </Td>
                    {metric !== "margen_pct" && (
                      <Td align="right" subtle>
                        {r.margenPct.toFixed(1)}%
                      </Td>
                    )}
                    <Td align="center">
                      <button
                        type="button"
                        onClick={() => removeItem(r.name)}
                        title="Quitar del análisis"
                        className="rounded-full p-1 transition-colors hover:bg-[var(--bg-surface-muted)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <X size={11} />
                      </button>
                    </Td>
                  </tr>
                ))}
                {/* Fila Resto del universo (solo si métrica no es margen %) */}
                {metric !== "margen_pct" && restoValue > 0 && (
                  <tr style={{ background: "var(--bg-surface-muted)" }}>
                    <Td align="center" subtle>
                      —
                    </Td>
                    <Td>
                      <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                        Resto del universo ({(data?.total_items ?? 0) - visibleItems.length}{" "}
                        {DIMENSION_LABEL[dimension].pl.toLowerCase()})
                      </span>
                    </Td>
                    <Td align="right" subtle>
                      {formatValue(restoValue)}
                    </Td>
                    <Td align="right" subtle>
                      {(restoPct ?? 0).toFixed(1)}%
                    </Td>
                    <Td align="right" subtle>
                      100.0%
                    </Td>
                    <Td align="right" subtle>
                      —
                    </Td>
                    <Td></Td>
                  </tr>
                )}
                {/* Fila TOTAL */}
                <tr
                  style={{
                    background: "var(--bg-surface-muted)",
                    borderTop: "2px solid var(--border-strong)",
                  }}
                >
                  <Td align="center"></Td>
                  <Td bold>TOTAL ({METRIC_LABEL[metric]})</Td>
                  <Td align="right" bold>
                    {formatValue(universeValue)}
                  </Td>
                  <Td align="right" bold>
                    100.0%
                  </Td>
                  <Td align="right"></Td>
                  {metric !== "margen_pct" && (
                    <Td align="right" bold>
                      {(data?.universe.margen_pct ?? 0).toFixed(1)}%
                    </Td>
                  )}
                  <Td></Td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

interface ChipOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

function ChipToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div
        className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
        style={{
          background: "var(--bg-surface-muted)",
          borderColor: "var(--border)",
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: active ? "var(--bg-surface)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                boxShadow: active ? "var(--shadow-card)" : "none",
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  subTruncate = false,
}: {
  label: string;
  value: string;
  sub?: string;
  subTruncate?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-xl font-bold tabular-nums"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-[11px] ${subTruncate ? "truncate" : ""}`}
          style={{ color: "var(--text-secondary)" }}
          title={subTruncate ? sub : undefined}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Treemap custom block — gradient por importancia
// ============================================================
interface TreemapPayload {
  // Estos los inyecta Recharts en tiempo de render. Opcionales para
  // que TypeScript no se queje al pasar el componente como `content`.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  size?: number;
  value?: number;
  pct?: number;
  maxValue?: number;
  formatValue?: (n: number) => string;
}

function TreemapBlock(props: TreemapPayload) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name,
    value,
    pct,
    maxValue,
    formatValue,
  } = props;
  const intensity =
    maxValue && maxValue > 0 ? Math.min(1, (value ?? 0) / maxValue) : 0;
  const isResto = name === "Resto del universo";
  // Color: naranja Susazón con opacidad por importancia. Resto = gris.
  const fill = isResto
    ? "var(--bg-surface-muted)"
    : `rgba(237, 104, 8, ${0.35 + intensity * 0.55})`;
  const textColor = isResto ? "var(--text-secondary)" : "white";

  // Solo mostrar label si el bloque es suficientemente grande
  const showLabel = width > 60 && height > 30;
  const showValue = width > 80 && height > 50;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: "var(--bg-surface)",
          strokeWidth: 2,
        }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showValue ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: Math.min(13, width / Math.max(8, (name?.length ?? 1) * 0.6)),
            fontWeight: 600,
            fill: textColor,
            pointerEvents: "none",
          }}
        >
          {(name ?? "").length > 28 ? (name ?? "").slice(0, 27) + "…" : name}
        </text>
      )}
      {showValue && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 + 6}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: 11,
              fill: textColor,
              opacity: 0.9,
              pointerEvents: "none",
            }}
          >
            {formatValue ? formatValue(value ?? 0) : (value ?? 0).toFixed(0)}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 20}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: 10,
              fontWeight: 700,
              fill: textColor,
              pointerEvents: "none",
            }}
          >
            {(pct ?? 0).toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

interface TooltipPayloadItem {
  payload?: {
    name?: string;
    value?: number;
    pct?: number;
    raw?: number;
  };
}

function TreemapTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  formatValue: (n: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {d.name}
      </div>
      <div className="mt-1 tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {formatValue(d.value ?? 0)}
      </div>
      <div className="tabular-nums" style={{ color: "var(--accent)", fontWeight: 600 }}>
        {(d.pct ?? 0).toFixed(1)}% del universo
      </div>
    </div>
  );
}

function RadarTooltip({
  active,
  payload,
  formatValue,
  metricLabel,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  formatValue: (n: number) => string;
  metricLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {d.name}
      </div>
      <div className="mt-1 tabular-nums" style={{ color: "var(--text-secondary)" }}>
        {metricLabel}: {formatValue(d.raw ?? 0)}
      </div>
      <div className="tabular-nums" style={{ color: "var(--accent)", fontWeight: 600 }}>
        {(d.pct ?? 0).toFixed(1)}% del universo
      </div>
    </div>
  );
}

// ============================================================
// Tabla helpers (idénticos a otros tabs)
// ============================================================
function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        textAlign: align,
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  bold = false,
  subtle = false,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  bold?: boolean;
  subtle?: boolean;
}) {
  return (
    <td
      className="px-3 py-2"
      style={{
        textAlign: align,
        fontWeight: bold ? 600 : 400,
        color: subtle ? "var(--text-muted)" : "var(--text-primary)",
      }}
    >
      {children}
    </td>
  );
}

