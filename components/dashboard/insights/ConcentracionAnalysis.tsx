"use client";

/**
 * ConcentracionAnalysis — primer sub-análisis del tab "Insights".
 *
 * Permite al usuario dimensionar la concentración / dependencia del negocio
 * sobre clientes, grupos o productos en distintas métricas (Pesos, Kilos,
 * Margen $, Margen %) en un rango de fechas libre.
 *
 * Visualización dual:
 *   - Treemap: bloques proporcionales al valor de cada item (área = valor)
 *   - Radar: cada eje = un item, valor = % del universo (ó margen % crudo
 *     cuando la métrica es Margen %)
 *
 * Importante sobre Margen %:
 *   El Margen % NO es aditivo. No tiene sentido hablar de "% del universo"
 *   ni "acumulado" para esta métrica (un cliente con 30% de margen NO es
 *   "30% del universo del margen"). Para Margen %:
 *     - Radar: eje muestra el margen % crudo (0–max+padding)
 *     - Treemap: no aplica (se muestra mensaje de cambiar a Radar)
 *     - Tabla: se reemplaza "% Universo" y "Acumulado" por "Δ pp vs universo"
 *     - Stats: "Cubren" → "Margen ponderado de los items"
 *             "Top dependencia" → "Mejor margen"
 *
 * El usuario empieza con Top 7 + "Resto del universo" (= octágono) y puede
 * borrar items o agregar otros sin límite. La tabla Pareto debajo da los
 * números exactos. Las filas son expandibles para ver el detalle (facturas
 * por día del cliente, o clientes que compraron del grupo/producto).
 */

import { Fragment, useEffect, useMemo, useState } from "react";
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
  ChevronRight,
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

type TopN = 7 | 10 | 15;
const DEFAULT_TOP_N: TopN = 7;
const TOP_N_OPTIONS: TopN[] = [7, 10, 15];
const STORAGE_KEY_DIMENSION = "insights-concentracion-dimension";
const STORAGE_KEY_METRIC = "insights-concentracion-metric";
const STORAGE_KEY_CHART = "insights-concentracion-chart";
const STORAGE_KEY_TOPN = "insights-concentracion-topn";

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

// === Detail (filas expandidas) ===
interface DetailFacturaPorFecha {
  fecha: string;
  territorio: string;
  venta: number;
  margen: number;
  kg: number;
  margen_pct: number;
  sku_count: number;
  vendedor: string;
}
interface DetailClientePorDim {
  cliente: string;
  venta: number;
  margen: number;
  kg: number;
  margen_pct: number;
}
type DetailResponse =
  | {
      kind: "facturas_por_fecha";
      total_records: number;
      items: DetailFacturaPorFecha[];
    }
  | {
      kind: "clientes_por_dim";
      total_records: number;
      items: DetailClientePorDim[];
    };

interface Props {
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
  const [topN, setTopN] = useState<TopN>(DEFAULT_TOP_N);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
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
      const tn = window.localStorage.getItem(STORAGE_KEY_TOPN);
      const parsed = tn ? Number(tn) : NaN;
      if (parsed === 7 || parsed === 10 || parsed === 15) setTopN(parsed);
    } catch {
      // ignore
    }
  }, []);

  const persistDimension = (d: Dimension) => {
    setDimension(d);
    setSelectedItems([]);
    setIsCustom(false);
    setExpandedItems(new Set());
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
  const persistTopN = (n: TopN) => {
    setTopN(n);
    try {
      window.localStorage.setItem(STORAGE_KEY_TOPN, String(n));
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
        setExpandedItems(new Set()); // limpiar expansiones al cambiar data
        setDetailCache(new Map());
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

  // ============== valueOf: extrae el valor de la métrica activa ==============
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

  // El "universo total" según métrica seleccionada
  const universeValue = useMemo(() => {
    if (!data) return 0;
    if (metric === "venta") return data.universe.venta;
    if (metric === "kg") return data.universe.kg;
    if (metric === "margen") return data.universe.margen;
    return data.universe.margen_pct;
  }, [data, metric]);

  // ============== shareOf: % del universo SOLO si la métrica es aditiva ==============
  // Para margen_pct NO aplica (sumarías porcentajes).
  const isAdditive = metric !== "margen_pct";
  const shareOf = (item: ApiItem): number => {
    if (!isAdditive) return item.margen_pct; // devuelve el % crudo
    return universeValue > 0 ? (valueOf(item) / universeValue) * 100 : 0;
  };

  // Items ordenados por la métrica activa (descendente)
  const sortedItems = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => valueOf(b) - valueOf(a));
  }, [data, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableItems = useMemo(() => sortedItems.map((i) => i.name), [sortedItems]);

  const visibleItems: ApiItem[] = useMemo(() => {
    if (!data) return [];
    if (isCustom) {
      const byName = new Map(sortedItems.map((i) => [i.name, i]));
      return selectedItems
        .map((n) => byName.get(n))
        .filter((x): x is ApiItem => x != null);
    }
    return sortedItems.slice(0, topN);
  }, [data, isCustom, selectedItems, sortedItems, topN]);

  // Para métricas aditivas: "Resto del universo" = lo que NO está en visibleItems
  // Para margen_pct: NO aplica el concepto de resto
  const visibleSum = useMemo(
    () => visibleItems.reduce((s, i) => s + valueOf(i), 0),
    [visibleItems, metric] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const restoValue = isAdditive ? Math.max(0, universeValue - visibleSum) : 0;
  const restoPct = isAdditive
    ? universeValue > 0
      ? (restoValue / universeValue) * 100
      : 0
    : 0;

  // ============== Update selection del multi-select ==============
  const onMultiSelectChange = (next: string[]) => {
    setSelectedItems(next);
    setIsCustom(next.length > 0);
  };

  const removeItem = (name: string) => {
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

  // ============== Formatos ==============
  const formatMetricValue = (n: number): string => {
    if (metric === "venta" || metric === "margen") return formatMoney(n);
    if (metric === "kg") return formatKilos(n);
    return `${n.toFixed(1)}%`;
  };

  // ============== Treemap data ==============
  // Solo para métricas aditivas. Para margen_pct se muestra mensaje.
  const treemapData = useMemo(() => {
    if (!isAdditive) return [];
    const items = visibleItems.map((i) => ({
      name: i.name,
      size: Math.max(0, valueOf(i)),
      value: valueOf(i),
      pct: shareOf(i),
    }));
    if (restoValue > 0) {
      items.push({
        name: "Resto del universo",
        size: restoValue,
        value: restoValue,
        pct: restoPct,
      });
    }
    return items;
  }, [visibleItems, metric, restoValue, restoPct, isAdditive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============== Radar data ==============
  // Aditivas: eje = % del universo (0–100+). Incluye "Resto".
  // Margen %: eje = margen % crudo de cada item (0–max).
  const radarData = useMemo(() => {
    if (isAdditive) {
      const items = visibleItems.map((i) => ({
        name: i.name,
        value: shareOf(i), // 0–100
        raw: valueOf(i),
      }));
      items.push({
        name: "Resto",
        value: restoPct,
        raw: restoValue,
      });
      return items;
    }
    // Margen %: eje = margen % crudo
    return visibleItems.map((i) => ({
      name: i.name,
      value: i.margen_pct,
      raw: i.margen_pct,
    }));
  }, [visibleItems, metric, restoValue, restoPct, isAdditive]); // eslint-disable-line react-hooks/exhaustive-deps

  const radarMax = useMemo(() => {
    const vals = radarData.map((d) => d.value);
    const max = vals.length > 0 ? Math.max(...vals) : 0;
    // Redondear arriba al siguiente múltiplo de 10
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [radarData]);

  // ============== Stats panel (adaptativo según métrica) ==============
  // Para aditivas: % del universo, top dependencia, etc.
  // Para margen_pct: promedio ponderado de items, mejor margen, etc.
  const stats = useMemo(() => {
    if (!data) {
      return {
        universeLabel: "Universo total",
        universeValue: "—",
        universeSub: "",
        itemsLabel: "Items en análisis",
        itemsValue: "0",
        itemsSub: METRIC_LABEL[metric],
        coverLabel: "Cubren del universo",
        coverValue: "—",
        coverSub: "",
        topLabel: "Top dependencia",
        topValue: "—",
        topSub: "—",
      };
    }
    if (isAdditive) {
      const cubrenPct =
        universeValue > 0 ? (visibleSum / universeValue) * 100 : 0;
      const topItem = visibleItems[0];
      const topItemPct =
        topItem && universeValue > 0
          ? (valueOf(topItem) / universeValue) * 100
          : 0;
      return {
        universeLabel: "Universo total",
        universeValue: formatMetricValue(universeValue),
        universeSub: `${data.total_items} ${DIMENSION_LABEL[dimension].pl.toLowerCase()}`,
        itemsLabel: "Items en análisis",
        itemsValue: String(visibleItems.length),
        itemsSub: METRIC_LABEL[metric],
        coverLabel: "Cubren del universo",
        coverValue: `${cubrenPct.toFixed(1)}%`,
        coverSub: `Resto: ${(100 - cubrenPct).toFixed(1)}%`,
        topLabel: "Top dependencia",
        topValue: topItem ? `${topItemPct.toFixed(1)}%` : "—",
        topSub: topItem?.name ?? "—",
      };
    }
    // Margen %: stats distintos
    // Margen ponderado de los items = sum(margen items) / sum(venta items)
    const sumMargen = visibleItems.reduce((s, i) => s + i.margen, 0);
    const sumVenta = visibleItems.reduce((s, i) => s + i.venta, 0);
    const marginPonderado = sumVenta > 0 ? (sumMargen / sumVenta) * 100 : 0;
    // Mejor margen = item con mayor margen_pct entre visibles
    const mejor =
      visibleItems.length > 0
        ? visibleItems.reduce((best, i) =>
            i.margen_pct > best.margen_pct ? i : best
          )
        : null;
    return {
      universeLabel: "Margen % universo",
      universeValue: `${data.universe.margen_pct.toFixed(1)}%`,
      universeSub: `${data.total_items} ${DIMENSION_LABEL[dimension].pl.toLowerCase()} · prom. ponderado`,
      itemsLabel: "Items en análisis",
      itemsValue: String(visibleItems.length),
      itemsSub: METRIC_LABEL[metric],
      coverLabel: "Margen items (ponderado)",
      coverValue: `${marginPonderado.toFixed(1)}%`,
      coverSub: `Δ ${(marginPonderado - data.universe.margen_pct).toFixed(1)} pp vs universo`,
      topLabel: "Mejor margen",
      topValue: mejor ? `${mejor.margen_pct.toFixed(1)}%` : "—",
      topSub: mejor?.name ?? "—",
    };
  }, [data, visibleItems, metric, isAdditive, universeValue, visibleSum, dimension]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============== Tabla Pareto data ==============
  const tableRows = useMemo(() => {
    let acum = 0;
    return visibleItems.map((i, idx) => {
      const valActiva = valueOf(i);
      const pct = shareOf(i);
      if (isAdditive) acum += pct;
      const deltaPp = i.margen_pct - (data?.universe.margen_pct ?? 0);
      return {
        rank: idx + 1,
        name: i.name,
        valActiva,
        venta: i.venta,
        kg: i.kg,
        margen: i.margen,
        margen_pct: i.margen_pct,
        pct,
        acumPct: acum,
        deltaPp,
      };
    });
  }, [visibleItems, metric, isAdditive, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============== Estado de filas expandidas ==============
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<Map<string, DetailResponse>>(
    new Map()
  );
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [errorDetails, setErrorDetails] = useState<Map<string, string>>(
    new Map()
  );

  async function toggleExpand(itemName: string) {
    if (expandedItems.has(itemName)) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.delete(itemName);
        return next;
      });
      return;
    }
    setExpandedItems((prev) => new Set(prev).add(itemName));
    if (detailCache.has(itemName)) return;
    if (loadingDetails.has(itemName)) return;
    setLoadingDetails((prev) => new Set(prev).add(itemName));
    setErrorDetails((prev) => {
      const next = new Map(prev);
      next.delete(itemName);
      return next;
    });
    try {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        dimension,
        name: itemName,
      });
      const r = await fetch(
        `/api/insights/item-detail?${params.toString()}`,
        { credentials: "include" }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as DetailResponse;
      setDetailCache((prev) => new Map(prev).set(itemName, j));
    } catch (e) {
      setErrorDetails((prev) =>
        new Map(prev).set(
          itemName,
          e instanceof Error ? e.message : "Error desconocido"
        )
      );
    } finally {
      setLoadingDetails((prev) => {
        const next = new Set(prev);
        next.delete(itemName);
        return next;
      });
    }
  }

  // ============== Render ==============
  return (
    <div className="space-y-4">
      {/* ============ Toolbar superior ============ */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <ChipToggle
          label="Vista"
          options={[
            { value: "treemap", label: "Treemap", icon: <LayoutGrid size={11} /> },
            { value: "radar", label: "Radar", icon: <RadarIcon size={11} /> },
          ]}
          value={chartKind}
          onChange={(v) => persistChart(v as ChartKind)}
        />
        <ChipToggle
          label="Top N"
          options={TOP_N_OPTIONS.map((n) => ({
            value: String(n),
            label: `Top ${n}`,
          }))}
          value={String(topN)}
          onChange={(v) => persistTopN(Number(v) as TopN)}
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
            : `Top ${Math.min(topN, visibleItems.length)} default`}
        </span>
        <MultiSelectChips
          options={availableItems}
          selected={isCustom ? selectedItems : visibleItems.map((i) => i.name)}
          onChange={onMultiSelectChange}
          maxItems={9999}
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
            Volver al Top {topN}
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
        <StatCell label={stats.universeLabel} value={stats.universeValue} sub={stats.universeSub} />
        <StatCell label={stats.itemsLabel} value={stats.itemsValue} sub={stats.itemsSub} />
        <StatCell label={stats.coverLabel} value={stats.coverValue} sub={stats.coverSub} />
        <StatCell label={stats.topLabel} value={stats.topValue} sub={stats.topSub} subTruncate />
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
        ) : !isAdditive && chartKind === "treemap" ? (
          <div
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            El treemap no aplica para <strong>Margen %</strong> (no es una métrica aditiva).
            Usa la vista <strong>Radar</strong> para ver el margen % de cada item, o cambia a
            otra métrica para ver bloques proporcionales.
          </div>
        ) : chartKind === "treemap" ? (
          <ResponsiveContainer width="100%" height={520}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="var(--bg-page)"
              fill="var(--accent)"
              isAnimationActive={false}
              content={
                <TreemapBlock
                  formatValue={formatMetricValue}
                  maxValue={Math.max(...treemapData.map((d) => d.size))}
                />
              }
            >
              <Tooltip
                content={<TreemapTooltip formatValue={formatMetricValue} />}
              />
            </Treemap>
          </ResponsiveContainer>
        ) : (
          // Radar adaptativo: ajusta font y truncado según cantidad de ejes
          // para que con 10-15 items sigan siendo legibles los labels.
          (() => {
            const n = radarData.length;
            const labelFont = n <= 8 ? 11 : n <= 11 ? 10 : 9;
            const truncLen = n <= 8 ? 24 : n <= 11 ? 18 : 14;
            // Más margen horizontal cuando hay muchos ejes para no cortar labels
            const horizMargin = n <= 8 ? 60 : n <= 11 ? 80 : 100;
            return (
              <ResponsiveContainer width="100%" height={n <= 8 ? 520 : 580}>
                <RadarChart
                  data={radarData.map((d) => ({
                    ...d,
                    name: truncate(d.name, truncLen),
                    fullName: d.name,
                  }))}
                  margin={{
                    top: 30,
                    right: horizMargin,
                    bottom: 30,
                    left: horizMargin,
                  }}
                >
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{
                      fontSize: labelFont,
                      fill: "var(--text-secondary)",
                    }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, radarMax]}
                    tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Radar
                    name={
                      isAdditive
                        ? `${METRIC_LABEL[metric]} (% del universo)`
                        : "Margen %"
                    }
                    dataKey="value"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.35}
                    strokeWidth={2}
                  />
                  <Tooltip
                    content={
                      <RadarTooltip
                        formatValue={formatMetricValue}
                        metricLabel={METRIC_LABEL[metric]}
                        isAdditive={isAdditive}
                      />
                    }
                  />
                </RadarChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </div>

      {/* ============ Tabla Pareto expandida ============ */}
      {tableRows.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Hint sobre filas expandibles */}
          {dimension === "clientes" && (
            <div
              className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface-muted)",
                color: "var(--text-muted)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                ⓘ Click en la flecha para expandir y ver las facturas del cliente en el rango
              </span>
            </div>
          )}
          {(dimension === "grupos" || dimension === "productos") && (
            <div
              className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface-muted)",
                color: "var(--text-muted)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                ⓘ Click en la flecha para expandir y ver qué clientes compraron en el rango
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th></Th>
                  <Th align="center">#</Th>
                  <Th>{DIMENSION_LABEL[dimension].sg}</Th>
                  <Th align="right">Venta</Th>
                  <Th align="right">Kilos</Th>
                  <Th align="right">Margen $</Th>
                  <Th align="right">Margen %</Th>
                  {isAdditive ? (
                    <>
                      <Th align="right">% Universo</Th>
                      <Th align="right">Acumulado</Th>
                    </>
                  ) : (
                    <Th align="right">Δ pp vs universo</Th>
                  )}
                  <Th align="center"></Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const isExpanded = expandedItems.has(r.name);
                  const detail = detailCache.get(r.name);
                  const isLoadingDetail = loadingDetails.has(r.name);
                  const detailError = errorDetails.get(r.name);
                  return (
                    <Fragment key={r.name}>
                      <tr
                        style={{
                          background:
                            i % 2 === 0
                              ? "var(--bg-surface)"
                              : "var(--bg-surface-muted)",
                          cursor: "pointer",
                        }}
                        onClick={() => toggleExpand(r.name)}
                      >
                        <Td align="center">
                          <ChevronRight
                            size={12}
                            style={{
                              color: "var(--text-secondary)",
                              transform: isExpanded ? "rotate(90deg)" : "none",
                              transition: "transform 0.15s ease",
                            }}
                          />
                        </Td>
                        <Td align="center" subtle>
                          {r.rank}
                        </Td>
                        <Td>{r.name}</Td>
                        <Td align="right" bold={metric === "venta"}>
                          {formatMoney(r.venta)}
                        </Td>
                        <Td align="right" bold={metric === "kg"}>
                          {formatKilos(r.kg)}
                        </Td>
                        <Td align="right" bold={metric === "margen"}>
                          {formatMoney(r.margen)}
                        </Td>
                        <Td align="right" bold={metric === "margen_pct"}>
                          {r.margen_pct.toFixed(1)}%
                        </Td>
                        {isAdditive ? (
                          <>
                            <Td align="right" subtle>
                              {r.pct.toFixed(1)}%
                            </Td>
                            <Td align="right" subtle>
                              {r.acumPct.toFixed(1)}%
                            </Td>
                          </>
                        ) : (
                          <Td
                            align="right"
                            bold
                            color={
                              r.deltaPp >= 0 ? "var(--success)" : "var(--danger)"
                            }
                          >
                            {r.deltaPp >= 0 ? "+" : ""}
                            {r.deltaPp.toFixed(1)} pp
                          </Td>
                        )}
                        <Td align="center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(r.name);
                            }}
                            title="Quitar del análisis"
                            className="rounded-full p-1 transition-colors hover:bg-[var(--bg-surface-muted)]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <X size={11} />
                          </button>
                        </Td>
                      </tr>
                      {/* Sub-tabla de detalle (facturas o clientes según dimensión) */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={isAdditive ? 10 : 9}
                            style={{
                              background: "var(--bg-surface-muted)",
                              borderTop: "1px solid var(--border)",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <div className="px-6 py-3">
                              {isLoadingDetail && (
                                <div
                                  className="flex items-center gap-2 text-xs"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <Loader2 size={12} className="animate-spin" />
                                  Cargando detalle…
                                </div>
                              )}
                              {detailError && (
                                <div
                                  className="text-xs"
                                  style={{ color: "var(--danger)" }}
                                >
                                  Error: {detailError}
                                </div>
                              )}
                              {detail && <DetailTable detail={detail} />}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {/* Fila Resto del universo (solo aditivas) */}
                {isAdditive && restoValue > 0 && (
                  <tr style={{ background: "var(--bg-surface-muted)" }}>
                    <Td></Td>
                    <Td align="center" subtle>
                      —
                    </Td>
                    <Td>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        Resto del universo (
                        {(data?.total_items ?? 0) - visibleItems.length}{" "}
                        {DIMENSION_LABEL[dimension].pl.toLowerCase()})
                      </span>
                    </Td>
                    <Td align="right" subtle>
                      {metric === "venta"
                        ? formatMoney(restoValue)
                        : formatMoney(
                            (data?.universe.venta ?? 0) -
                              visibleItems.reduce((s, i) => s + i.venta, 0)
                          )}
                    </Td>
                    <Td align="right" subtle>
                      {metric === "kg"
                        ? formatKilos(restoValue)
                        : formatKilos(
                            (data?.universe.kg ?? 0) -
                              visibleItems.reduce((s, i) => s + i.kg, 0)
                          )}
                    </Td>
                    <Td align="right" subtle>
                      {metric === "margen"
                        ? formatMoney(restoValue)
                        : formatMoney(
                            (data?.universe.margen ?? 0) -
                              visibleItems.reduce((s, i) => s + i.margen, 0)
                          )}
                    </Td>
                    <Td align="right" subtle>
                      —
                    </Td>
                    <Td align="right" subtle>
                      {restoPct.toFixed(1)}%
                    </Td>
                    <Td align="right" subtle>
                      100.0%
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
                  <Td></Td>
                  <Td></Td>
                  <Td bold>TOTAL universo</Td>
                  <Td align="right" bold>
                    {formatMoney(data?.universe.venta ?? 0)}
                  </Td>
                  <Td align="right" bold>
                    {formatKilos(data?.universe.kg ?? 0)}
                  </Td>
                  <Td align="right" bold>
                    {formatMoney(data?.universe.margen ?? 0)}
                  </Td>
                  <Td align="right" bold>
                    {(data?.universe.margen_pct ?? 0).toFixed(1)}%
                  </Td>
                  {isAdditive ? (
                    <>
                      <Td align="right" bold>
                        100.0%
                      </Td>
                      <Td></Td>
                    </>
                  ) : (
                    <Td align="right" subtle>
                      —
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
// DetailTable — sub-tabla de filas expandidas
// ============================================================
function DetailTable({ detail }: { detail: DetailResponse }) {
  if (detail.kind === "facturas_por_fecha") {
    if (detail.items.length === 0) {
      return (
        <div
          className="py-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Sin facturas en el rango.
        </div>
      );
    }
    return (
      <div>
        <div
          className="mb-1 text-[10px] uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {detail.total_records} {detail.total_records === 1 ? "factura" : "facturas"} en el rango
        </div>
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr>
              <SubTh>Fecha</SubTh>
              <SubTh>Territorio</SubTh>
              <SubTh>Vendedor</SubTh>
              <SubTh align="right">SKUs</SubTh>
              <SubTh align="right">Venta</SubTh>
              <SubTh align="right">Kilos</SubTh>
              <SubTh align="right">Margen $</SubTh>
              <SubTh align="right">Margen %</SubTh>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((row, idx) => (
              <tr
                key={`${row.fecha}|${row.territorio}|${idx}`}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <SubTd>{row.fecha}</SubTd>
                <SubTd>{row.territorio}</SubTd>
                <SubTd subtle>{row.vendedor || "—"}</SubTd>
                <SubTd align="right" subtle>
                  {row.sku_count}
                </SubTd>
                <SubTd align="right">{formatMoney(row.venta)}</SubTd>
                <SubTd align="right">{formatKilos(row.kg)}</SubTd>
                <SubTd align="right">{formatMoney(row.margen)}</SubTd>
                <SubTd align="right">{row.margen_pct.toFixed(1)}%</SubTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  // clientes_por_dim (cuando dimensión es grupo o producto)
  if (detail.items.length === 0) {
    return (
      <div className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Sin clientes que compraron en el rango.
      </div>
    );
  }
  return (
    <div>
      <div
        className="mb-1 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {detail.total_records} clientes que compraron en el rango
      </div>
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr>
            <SubTh align="center">#</SubTh>
            <SubTh>Cliente</SubTh>
            <SubTh align="right">Venta</SubTh>
            <SubTh align="right">Kilos</SubTh>
            <SubTh align="right">Margen $</SubTh>
            <SubTh align="right">Margen %</SubTh>
          </tr>
        </thead>
        <tbody>
          {detail.items.map((row, idx) => (
            <tr
              key={`${row.cliente}|${idx}`}
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <SubTd align="center" subtle>
                {idx + 1}
              </SubTd>
              <SubTd>{row.cliente}</SubTd>
              <SubTd align="right">{formatMoney(row.venta)}</SubTd>
              <SubTd align="right">{formatKilos(row.kg)}</SubTd>
              <SubTd align="right">{formatMoney(row.margen)}</SubTd>
              <SubTd align="right">{row.margen_pct.toFixed(1)}%</SubTd>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Subcomponentes UI
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
// Treemap custom block — diseño moderno con tipografía top-left,
// padding interno, esquinas redondeadas y badge translúcido para %.
// El "Resto del universo" se distingue con un patrón diagonal sutil
// y color diferenciado para ser perfectamente visible.
// ============================================================
interface TreemapPayload {
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

/** Estima cuántos caracteres caben en un ancho dado a un fontSize dado.
 *  Aproximación: 0.55 × fontSize por carácter para Helvetica/Inter. */
function maxCharsForWidth(widthPx: number, fontSize: number): number {
  return Math.max(3, Math.floor(widthPx / (fontSize * 0.55)));
}

/** Trunca con elipsis si el texto excede maxChars. */
function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(1, maxChars - 1)) + "…";
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

  const isResto = name === "Resto del universo";

  // Color/intensidad del bloque
  const intensity =
    maxValue && maxValue > 0 ? Math.min(1, (value ?? 0) / maxValue) : 0;

  // Fill principal:
  //  - Items: gradient naranja Susazón, opacidad 0.65 → 1.0 por importancia
  //  - Resto: gris-azulado distintivo (NO el bg-surface-muted que se mezcla con el fondo)
  const fill = isResto
    ? "rgba(100, 116, 139, 0.85)" // slate-500 sólido — claramente visible
    : `rgba(237, 104, 8, ${0.65 + intensity * 0.35})`;

  // Estilo de texto
  const titleColor = "#ffffff";
  const subtleColor = isResto ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.82)";
  const badgeBg = isResto ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.22)";
  const badgeText = "#ffffff";

  // Padding interno para que el texto no se pegue al borde
  const padding = Math.max(6, Math.min(14, Math.min(width, height) * 0.08));
  const innerLeft = x + padding;
  const innerTop = y + padding;
  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

  // Decisión qué mostrar según área disponible
  const showTitle = innerW > 40 && innerH > 16;
  const showValue = innerW > 60 && innerH > 38;
  const showBadge = innerW > 50 && innerH > 50;

  // Font size dinámico para el título: proporcional al ancho pero acotado.
  // Bloques grandes → fuente grande; chicos → fuente pequeña.
  const baseFont = Math.sqrt(width * height) * 0.13;
  const titleFontSize = Math.max(10, Math.min(20, baseFont));
  const valueFontSize = Math.max(9, Math.min(13, titleFontSize * 0.7));
  const badgeFontSize = Math.max(10, Math.min(14, titleFontSize * 0.75));

  const displayName = truncate(
    name ?? "",
    maxCharsForWidth(innerW, titleFontSize)
  );

  // Badge para el % (esquina inferior derecha)
  const badgeText_ = `${(pct ?? 0).toFixed(1)}%`;
  const badgeFontWidth = badgeText_.length * badgeFontSize * 0.55;
  const badgePaddingX = 6;
  const badgePaddingY = 3;
  const badgeW = badgeFontWidth + badgePaddingX * 2;
  const badgeH = badgeFontSize + badgePaddingY * 2;
  const badgeX = x + width - padding - badgeW;
  const badgeY = y + height - padding - badgeH;

  return (
    <g>
      {/* Background con esquinas redondeadas */}
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={5}
        ry={5}
        style={{
          fill,
          stroke: isResto
            ? "rgba(100, 116, 139, 0.4)"
            : "rgba(255,255,255,0.18)",
          strokeWidth: 1,
        }}
      />
      {/* Highlight superior sutil para profundidad */}
      {!isResto && height > 30 && (
        <rect
          x={x + 1}
          y={y + 1}
          width={Math.max(0, width - 2)}
          height={Math.min(6, height / 6)}
          rx={5}
          ry={5}
          style={{
            fill: "rgba(255,255,255,0.12)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Título (esquina superior izquierda) */}
      {showTitle && (
        <text
          x={innerLeft}
          y={innerTop + titleFontSize}
          textAnchor="start"
          style={{
            fontSize: titleFontSize,
            fontWeight: 700,
            fill: titleColor,
            letterSpacing: "0.01em",
            pointerEvents: "none",
          }}
        >
          {displayName}
        </text>
      )}

      {/* Valor (debajo del título) */}
      {showValue && (
        <text
          x={innerLeft}
          y={innerTop + titleFontSize + valueFontSize + 6}
          textAnchor="start"
          style={{
            fontSize: valueFontSize,
            fontWeight: 500,
            fill: subtleColor,
            pointerEvents: "none",
          }}
        >
          {formatValue ? formatValue(value ?? 0) : (value ?? 0).toFixed(0)}
        </text>
      )}

      {/* Badge con % (esquina inferior derecha) */}
      {showBadge && (
        <g>
          <rect
            x={badgeX}
            y={badgeY}
            width={badgeW}
            height={badgeH}
            rx={3}
            ry={3}
            style={{ fill: badgeBg, pointerEvents: "none" }}
          />
          <text
            x={badgeX + badgeW / 2}
            y={badgeY + badgeH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontSize: badgeFontSize,
              fontWeight: 700,
              fill: badgeText,
              letterSpacing: "0.02em",
              pointerEvents: "none",
            }}
          >
            {badgeText_}
          </text>
        </g>
      )}
    </g>
  );
}

interface TooltipPayloadItem {
  payload?: {
    name?: string;
    fullName?: string;
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
      <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
        {d.name}
      </div>
      <div
        className="mt-1 tabular-nums"
        style={{ color: "var(--text-secondary)" }}
      >
        {formatValue(d.value ?? 0)}
      </div>
      <div
        className="tabular-nums"
        style={{ color: "var(--accent)", fontWeight: 600 }}
      >
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
  isAdditive,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  formatValue: (n: number) => string;
  metricLabel: string;
  isAdditive: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  // Mostrar nombre completo (fullName) si está disponible (es decir, si
  // el name del eje fue truncado), si no usar name.
  const displayName = d.fullName ?? d.name;
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
        {displayName}
      </div>
      {isAdditive ? (
        <>
          <div
            className="mt-1 tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {metricLabel}: {formatValue(d.raw ?? 0)}
          </div>
          <div
            className="tabular-nums"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            {(d.value ?? 0).toFixed(1)}% del universo
          </div>
        </>
      ) : (
        <div
          className="mt-1 tabular-nums"
          style={{ color: "var(--accent)", fontWeight: 600 }}
        >
          Margen: {(d.value ?? 0).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ============================================================
// Tabla helpers
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
      style={{ textAlign: align, color: "var(--text-secondary)" }}
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
  color,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  bold?: boolean;
  subtle?: boolean;
  color?: string;
}) {
  return (
    <td
      className="px-3 py-2"
      style={{
        textAlign: align,
        fontWeight: bold ? 600 : 400,
        color: color ?? (subtle ? "var(--text-muted)" : "var(--text-primary)"),
      }}
    >
      {children}
    </td>
  );
}

function SubTh({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider"
      style={{ textAlign: align, color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function SubTd({
  children,
  align = "left",
  subtle = false,
}: {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  subtle?: boolean;
}) {
  return (
    <td
      className="px-2 py-1"
      style={{
        textAlign: align,
        color: subtle ? "var(--text-muted)" : "var(--text-primary)",
      }}
    >
      {children}
    </td>
  );
}
