"use client";

/**
 * ConcentracionAnalysis — primer sub-análisis del tab "Insights".
 *
 * Permite al usuario dimensionar la concentración / dependencia del negocio
 * sobre clientes, grupos, productos o territorios en distintas métricas
 * (Pesos, Kilos, Margen $, Margen %) en un rango de fechas libre.
 *
 * Visualización dual:
 *   - Treemap: bloques proporcionales al valor de cada item (área = valor)
 *   - Pareto: barras por item ordenadas de mayor a menor (valor de la métrica)
 *     + línea de % ACUMULADO del universo (eje derecho). Es el estándar para
 *     leer concentración: "el top N cubre X% del total".
 *
 * Importante sobre Margen %:
 *   El Margen % NO es aditivo. No tiene sentido hablar de "% del universo"
 *   ni "acumulado" para esta métrica (un cliente con 30% de margen NO es
 *   "30% del universo del margen"). Para Margen %:
 *     - Pareto: barras del margen % crudo de cada item (sin línea acumulada)
 *     - Treemap: no aplica (se muestra mensaje de cambiar a Pareto)
 *     - Tabla: se reemplaza "% Universo" y "Acumulado" por "Δ pp vs universo"
 *     - Stats: "Cubren" → "Margen ponderado de los items"
 *             "Top dependencia" → "Mejor margen"
 *
 * El usuario empieza con Top 7 + "Resto del universo" y puede borrar items
 * o agregar otros sin límite. La tabla Pareto debajo da los
 * números exactos. Las filas son expandibles para ver el detalle (facturas
 * por día del cliente, o clientes que compraron del grupo/producto).
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  Loader2,
  LayoutGrid,
  BarChart3,
  ChevronRight,
  Ban,
  RotateCcw,
} from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/dashboard/DateRangePicker";
import { MultiSelectChips } from "@/components/dashboard/MultiSelectChips";

type Dimension = "clientes" | "grupos" | "productos" | "territorios";
type Metric = "venta" | "kg" | "margen" | "margen_pct";
type ChartKind = "treemap" | "pareto";

const DIMENSION_LABEL: Record<Dimension, { sg: string; pl: string }> = {
  clientes: { sg: "Cliente", pl: "Clientes" },
  grupos: { sg: "Grupo", pl: "Grupos" },
  productos: { sg: "Producto (SKU)", pl: "Productos" },
  territorios: { sg: "Territorio", pl: "Territorios" },
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
const STORAGE_KEY_EXCLUDED = "insights-concentracion-excluded";

type ExcludedMap = Record<Dimension, string[]>;
const EMPTY_EXCLUDED: ExcludedMap = {
  clientes: [],
  grupos: [],
  productos: [],
  territorios: [],
};

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
  /** Territorios efectivos del sidebar (null = todos visibles). */
  territorios: string[] | null;
  /** Etiqueta del contexto para mostrar al usuario qué está viendo. */
  contextLabel: string;
  /** Modo agrupador (Fase 2b): acota el scope a los miembros del agrupador. */
  agrupadorId?: string | null;
}

export function ConcentracionAnalysis({
  today,
  territorios,
  contextLabel,
  agrupadorId = null,
}: Props) {
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
  // Items EXCLUIDOS del cálculo del universo (no cuentan como 100%).
  // Por dimensión, para que cuando cambies de Clientes → Grupos, las
  // exclusiones de cada dimensión sean independientes.
  const [excluded, setExcluded] = useState<ExcludedMap>(EMPTY_EXCLUDED);

  // Cargar preferencias persistidas
  useEffect(() => {
    try {
      const dim = window.localStorage.getItem(STORAGE_KEY_DIMENSION);
      if (
        dim === "clientes" ||
        dim === "grupos" ||
        dim === "productos" ||
        dim === "territorios"
      ) {
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
      if (chart === "treemap" || chart === "pareto") setChartKind(chart);
      // Migración: "radar" quedó deprecado (reemplazado por Pareto).
      else if (chart === "radar") setChartKind("pareto");
      const tn = window.localStorage.getItem(STORAGE_KEY_TOPN);
      const parsed = tn ? Number(tn) : NaN;
      if (parsed === 7 || parsed === 10 || parsed === 15) setTopN(parsed);
      // Excluded items por dimensión
      const exc = window.localStorage.getItem(STORAGE_KEY_EXCLUDED);
      if (exc) {
        const parsedExc = JSON.parse(exc) as Partial<ExcludedMap>;
        setExcluded({
          clientes: Array.isArray(parsedExc.clientes) ? parsedExc.clientes : [],
          grupos: Array.isArray(parsedExc.grupos) ? parsedExc.grupos : [],
          productos: Array.isArray(parsedExc.productos)
            ? parsedExc.productos
            : [],
          territorios: Array.isArray(parsedExc.territorios)
            ? parsedExc.territorios
            : [],
        });
      }
    } catch {
      // ignore
    }
  }, []);

  // Persistir excluded a localStorage cada vez que cambia
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_EXCLUDED,
        JSON.stringify(excluded)
      );
    } catch {
      // ignore
    }
  }, [excluded]);

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

  // Serializar territorios al CSV que espera el endpoint. Usamos memo
  // estable para evitar refetches innecesarios cuando el array es
  // referencialmente distinto pero idéntico en contenido.
  const territoriosKey = useMemo(() => {
    if (territorios === null) return "__ALL__";
    if (territorios.length === 0) return "__NONE__";
    return [...territorios].sort().join("|");
  }, [territorios]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      dimension,
    });
    // Modo agrupador: solo mandamos &agrupador (el backend acota por miembros
    // e ignora territorios). Modo normal: null = no param (todos visibles via
    // RLS), [] = param vacío ("") = 0 resultados, [X,Y] = CSV.
    if (agrupadorId) {
      params.set("agrupador", agrupadorId);
    } else if (territoriosKey === "__NONE__") {
      params.set("territorios", "");
    } else if (territoriosKey !== "__ALL__") {
      params.set("territorios", territoriosKey.split("|").join(","));
    }
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
  }, [range.from, range.to, dimension, territoriosKey, agrupadorId]);

  // ============== Items EXCLUIDOS del universo ==============
  // Set de los excluidos para la dimensión actual. Estos items NO se
  // cuentan en el universo (el 100% se recalcula sin ellos).
  const excludedSet = useMemo(
    () => new Set(excluded[dimension] ?? []),
    [excluded, dimension]
  );

  // Lista de items efectivos (data.items SIN los excluidos)
  const effectiveItems = useMemo(() => {
    if (!data) return [];
    if (excludedSet.size === 0) return data.items;
    return data.items.filter((i) => !excludedSet.has(i.name));
  }, [data, excludedSet]);

  // Universo efectivo (recalculado quitando los excluidos)
  const effectiveUniverse = useMemo(() => {
    if (!data)
      return { venta: 0, kg: 0, margen: 0, margen_pct: 0 };
    if (excludedSet.size === 0) return data.universe;
    let v = 0,
      k = 0,
      m = 0;
    for (const i of effectiveItems) {
      v += i.venta;
      k += i.kg;
      m += i.margen;
    }
    return {
      venta: v,
      kg: k,
      margen: m,
      margen_pct: v > 0 ? (m / v) * 100 : 0,
    };
  }, [data, effectiveItems, excludedSet]);

  const effectiveTotalItems = data
    ? data.total_items - excludedSet.size
    : 0;

  // Lookup de items excluidos con su data original (para mostrar en la
  // sección "excluidos" con sus valores)
  const excludedItemsData = useMemo(() => {
    if (!data || excludedSet.size === 0) return [];
    return data.items.filter((i) => excludedSet.has(i.name));
  }, [data, excludedSet]);

  // Handlers de exclusión
  const excludeFromUniverse = (name: string) => {
    setExcluded((prev) => {
      const dimList = prev[dimension] ?? [];
      if (dimList.includes(name)) return prev;
      return { ...prev, [dimension]: [...dimList, name] };
    });
    // Si estaba en la selección custom, quitarlo
    if (selectedItems.includes(name)) {
      setSelectedItems((prev) => prev.filter((n) => n !== name));
      if (selectedItems.length === 1) setIsCustom(false);
    }
  };
  const reincludeToUniverse = (name: string) => {
    setExcluded((prev) => ({
      ...prev,
      [dimension]: (prev[dimension] ?? []).filter((n) => n !== name),
    }));
  };
  const clearAllExclusions = () => {
    setExcluded((prev) => ({ ...prev, [dimension]: [] }));
  };

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

  // El "universo total" según métrica seleccionada (usa el efectivo,
  // que ya quita los items excluidos del cálculo).
  const universeValue = useMemo(() => {
    if (!data) return 0;
    if (metric === "venta") return effectiveUniverse.venta;
    if (metric === "kg") return effectiveUniverse.kg;
    if (metric === "margen") return effectiveUniverse.margen;
    return effectiveUniverse.margen_pct;
  }, [data, metric, effectiveUniverse]);

  // ============== shareOf: % del universo SOLO si la métrica es aditiva ==============
  // Para margen_pct NO aplica (sumarías porcentajes).
  const isAdditive = metric !== "margen_pct";
  const shareOf = (item: ApiItem): number => {
    if (!isAdditive) return item.margen_pct; // devuelve el % crudo
    return universeValue > 0 ? (valueOf(item) / universeValue) * 100 : 0;
  };

  // Items ordenados por la métrica activa (descendente). Ya sin excluidos.
  const sortedItems = useMemo(() => {
    return [...effectiveItems].sort((a, b) => valueOf(b) - valueOf(a));
  }, [effectiveItems, metric]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ============== Pareto data ==============
  // Aditivas: cada item es una barra (valor de la métrica) ordenada de mayor
  //   a menor + una línea de % ACUMULADO del universo (eje derecho 0–100).
  //   Incluye la barra "Resto" al final → la línea cierra en ~100%.
  // Margen %: cada item es una barra de margen % crudo (no aditivo → sin
  //   acumulado; la línea no se dibuja).
  type ParetoRow = {
    name: string;
    value: number;
    share: number;
    cumPct: number | null;
    isResto: boolean;
  };
  const paretoData = useMemo<ParetoRow[]>(() => {
    if (isAdditive) {
      let cum = 0;
      const rows: ParetoRow[] = visibleItems.map((i) => {
        const raw = valueOf(i);
        const share = shareOf(i); // % del universo
        cum += share;
        return {
          name: i.name,
          value: raw,
          share,
          cumPct: Math.min(100, cum),
          isResto: false,
        };
      });
      if (restoValue > 0) {
        cum += restoPct;
        rows.push({
          name: "Resto",
          value: restoValue,
          share: restoPct,
          cumPct: Math.min(100, cum),
          isResto: true,
        });
      }
      return rows;
    }
    // Margen %: barras de margen % por item (sin acumulado).
    return visibleItems.map((i) => ({
      name: i.name,
      value: i.margen_pct,
      share: i.margen_pct,
      cumPct: null,
      isResto: false,
    }));
  }, [visibleItems, metric, restoValue, restoPct, isAdditive]); // eslint-disable-line react-hooks/exhaustive-deps

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
        universeSub: `${effectiveTotalItems} ${DIMENSION_LABEL[dimension].pl.toLowerCase()}${
          excludedSet.size > 0 ? ` · ${excludedSet.size} excluido${excludedSet.size === 1 ? "" : "s"}` : ""
        }`,
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
      universeValue: `${effectiveUniverse.margen_pct.toFixed(1)}%`,
      universeSub: `${effectiveTotalItems} ${DIMENSION_LABEL[dimension].pl.toLowerCase()} · prom. ponderado${
        excludedSet.size > 0 ? ` · ${excludedSet.size} excl.` : ""
      }`,
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
  }, [data, visibleItems, metric, isAdditive, universeValue, visibleSum, dimension, effectiveUniverse, effectiveTotalItems, excludedSet]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============== Tabla Pareto data ==============
  const tableRows = useMemo(() => {
    let acum = 0;
    return visibleItems.map((i, idx) => {
      const valActiva = valueOf(i);
      const pct = shareOf(i);
      if (isAdditive) acum += pct;
      const deltaPp = i.margen_pct - effectiveUniverse.margen_pct;
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
  }, [visibleItems, metric, isAdditive, data, effectiveUniverse]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Mismo filtro que el endpoint principal (agrupador tiene prioridad)
      if (agrupadorId) {
        params.set("agrupador", agrupadorId);
      } else if (territoriosKey === "__NONE__") {
        params.set("territorios", "");
      } else if (territoriosKey !== "__ALL__") {
        params.set("territorios", territoriosKey.split("|").join(","));
      }
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
      {/* Banner del contexto activo — muestra qué territorios se están
          analizando. Consistente con el filtro del sidebar del dashboard. */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
        style={{
          background: "var(--accent-soft)",
          borderColor: "var(--accent)",
          color: "var(--text-primary)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--accent)" }}
          >
            Analizando:
          </span>
          <span
            className="font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {contextLabel}
          </span>
          {territorios !== null && territorios.length > 0 && (
            <span
              className="text-[10px]"
              style={{ color: "var(--text-secondary)" }}
            >
              · El universo del 100% incluye solo este filtro
            </span>
          )}
        </div>
      </div>

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
            { value: "territorios", label: "Territorios" },
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
            { value: "pareto", label: "Pareto", icon: <BarChart3 size={11} /> },
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

      {/* ============ Banner de exclusión activa ============ */}
      {excludedSet.size > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
          style={{
            background: "var(--warning-soft)",
            borderColor: "var(--warning)",
            color: "var(--text-primary)",
          }}
        >
          <div className="flex items-center gap-2">
            <Ban size={14} style={{ color: "var(--warning)" }} />
            <span>
              <strong>{excludedSet.size}</strong>{" "}
              {DIMENSION_LABEL[dimension].pl.toLowerCase()} excluido
              {excludedSet.size === 1 ? "" : "s"} del universo · El 100% se
              recalculó sin ellos
            </span>
          </div>
          <button
            type="button"
            onClick={clearAllExclusions}
            className="flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface)]"
            style={{
              borderColor: "var(--warning)",
              color: "var(--warning)",
              background: "transparent",
            }}
          >
            <RotateCcw size={11} />
            Re-incluir todos
          </button>
        </div>
      )}

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
            Usa la vista <strong>Pareto</strong> para ver el margen % de cada item, o cambia a
            otra métrica para ver bloques proporcionales.
          </div>
        ) : chartKind === "treemap" ? (
          <ConcentracionGrid
            items={visibleItems}
            restoValue={restoValue}
            restoPct={restoPct}
            restoItemsCount={effectiveTotalItems - visibleItems.length}
            restoLabel={DIMENSION_LABEL[dimension].pl.toLowerCase()}
            metric={metric}
            universeValue={universeValue}
            formatValue={formatMetricValue}
            valueOf={valueOf}
          />
        ) : (
          // Pareto: barras (valor de la métrica) ordenadas de mayor a menor +
          // línea de % ACUMULADO del universo (eje derecho) para métricas
          // aditivas. Margen % → solo barras (no aditivo). Estándar para leer
          // concentración: "el top N cubre X% del total".
          (() => {
            const n = paretoData.length;
            const truncLen = n <= 8 ? 16 : n <= 12 ? 12 : 9;
            const labelFont = n <= 12 ? 11 : 9;
            // Formateador compacto para el eje izquierdo (valores grandes).
            const fmtCompact = (v: number) => {
              if (metric === "margen_pct") return `${Math.round(v)}%`;
              const abs = Math.abs(v);
              const sign = v < 0 ? "-" : "";
              let s: string;
              if (abs >= 1_000_000) s = `${(abs / 1_000_000).toFixed(1)}M`;
              else if (abs >= 1_000) s = `${Math.round(abs / 1_000)}K`;
              else s = `${Math.round(abs)}`;
              return metric === "kg" ? `${sign}${s}` : `${sign}$${s}`;
            };
            const chartData = paretoData.map((d) => ({
              ...d,
              shortName: truncate(d.name, truncLen),
              fullName: d.name,
            }));
            return (
              <ResponsiveContainer width="100%" height={n <= 8 ? 460 : 520}>
                <ComposedChart
                  data={chartData}
                  margin={{
                    top: 20,
                    right: isAdditive ? 12 : 8,
                    bottom: 96,
                    left: 8,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortName"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={96}
                    tick={{
                      fontSize: labelFont,
                      fill: "var(--text-secondary)",
                    }}
                    tickLine={false}
                    stroke="var(--border)"
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={fmtCompact}
                    tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                  />
                  {isAdditive && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 10, fill: "var(--text-primary)" }}
                      tickLine={false}
                      axisLine={false}
                      width={42}
                    />
                  )}
                  <Tooltip
                    content={
                      <ParetoTooltip
                        formatValue={formatMetricValue}
                        metricLabel={METRIC_LABEL[metric]}
                        isAdditive={isAdditive}
                      />
                    }
                    cursor={{ fill: "var(--bg-surface-muted)", opacity: 0.5 }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="value"
                    name={isAdditive ? METRIC_LABEL[metric] : "Margen %"}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={64}
                    isAnimationActive={false}
                  >
                    {chartData.map((d, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          d.isResto ? "var(--text-muted)" : "var(--accent)"
                        }
                        fillOpacity={d.isResto ? 0.35 : 0.9}
                      />
                    ))}
                  </Bar>
                  {isAdditive && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumPct"
                      name="% acumulado"
                      stroke="var(--text-primary)"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                      dot={{
                        r: 3,
                        strokeWidth: 1.5,
                        stroke: "var(--text-primary)",
                        fill: "var(--bg-surface)",
                      }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </ComposedChart>
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
          {(dimension === "grupos" ||
            dimension === "productos" ||
            dimension === "territorios") && (
            <div
              className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface-muted)",
                color: "var(--text-muted)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>
                {dimension === "territorios"
                  ? "ⓘ Click en la flecha para expandir y ver qué clientes facturaron en ese territorio"
                  : "ⓘ Click en la flecha para expandir y ver qué clientes compraron en el rango"}
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
                  <Th align="center">Acciones</Th>
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
                              excludeFromUniverse(r.name);
                            }}
                            title="Excluir del universo (recalcula el 100% sin este item, el Top N sigue funcionando con el siguiente)"
                            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium transition-colors"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-secondary)",
                              background: "var(--bg-surface)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                "var(--danger-soft)";
                              e.currentTarget.style.borderColor =
                                "var(--danger)";
                              e.currentTarget.style.color = "var(--danger)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background =
                                "var(--bg-surface)";
                              e.currentTarget.style.borderColor =
                                "var(--border)";
                              e.currentTarget.style.color =
                                "var(--text-secondary)";
                            }}
                          >
                            <Ban size={10} />
                            Excluir
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
                        {effectiveTotalItems - visibleItems.length}{" "}
                        {DIMENSION_LABEL[dimension].pl.toLowerCase()})
                      </span>
                    </Td>
                    <Td align="right" subtle>
                      {metric === "venta"
                        ? formatMoney(restoValue)
                        : formatMoney(
                            effectiveUniverse.venta -
                              visibleItems.reduce((s, i) => s + i.venta, 0)
                          )}
                    </Td>
                    <Td align="right" subtle>
                      {metric === "kg"
                        ? formatKilos(restoValue)
                        : formatKilos(
                            effectiveUniverse.kg -
                              visibleItems.reduce((s, i) => s + i.kg, 0)
                          )}
                    </Td>
                    <Td align="right" subtle>
                      {metric === "margen"
                        ? formatMoney(restoValue)
                        : formatMoney(
                            effectiveUniverse.margen -
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
                  <Td bold>
                    TOTAL universo
                    {excludedSet.size > 0 && (
                      <span
                        className="ml-2 text-[10px] font-normal"
                        style={{ color: "var(--text-muted)" }}
                      >
                        (sin {excludedSet.size} excluido
                        {excludedSet.size === 1 ? "" : "s"})
                      </span>
                    )}
                  </Td>
                  <Td align="right" bold>
                    {formatMoney(effectiveUniverse.venta)}
                  </Td>
                  <Td align="right" bold>
                    {formatKilos(effectiveUniverse.kg)}
                  </Td>
                  <Td align="right" bold>
                    {formatMoney(effectiveUniverse.margen)}
                  </Td>
                  <Td align="right" bold>
                    {effectiveUniverse.margen_pct.toFixed(1)}%
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

      {/* ============ Sección de items EXCLUIDOS del universo ============ */}
      {excludedItemsData.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--warning)",
          }}
        >
          <div
            className="flex items-center justify-between gap-2 border-b px-3 py-2"
            style={{
              borderColor: "var(--border)",
              background: "var(--warning-soft)",
            }}
          >
            <div className="flex items-center gap-2">
              <Ban size={14} style={{ color: "var(--warning)" }} />
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-primary)" }}
              >
                Excluidos del universo · {excludedItemsData.length}{" "}
                {DIMENSION_LABEL[dimension].pl.toLowerCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={clearAllExclusions}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface)]"
              style={{
                borderColor: "var(--warning)",
                color: "var(--warning)",
                background: "transparent",
              }}
            >
              <RotateCcw size={11} />
              Re-incluir todos
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th>{DIMENSION_LABEL[dimension].sg}</Th>
                  <Th align="right">Venta</Th>
                  <Th align="right">Kilos</Th>
                  <Th align="right">Margen $</Th>
                  <Th align="right">Margen %</Th>
                  <Th align="center">Acción</Th>
                </tr>
              </thead>
              <tbody>
                {excludedItemsData.map((i, idx) => (
                  <tr
                    key={i.name}
                    style={{
                      background:
                        idx % 2 === 0
                          ? "var(--bg-surface)"
                          : "var(--bg-surface-muted)",
                      opacity: 0.7,
                    }}
                  >
                    <Td>
                      <span
                        style={{
                          textDecoration: "line-through",
                          textDecorationColor: "var(--text-muted)",
                        }}
                      >
                        {i.name}
                      </span>
                    </Td>
                    <Td align="right" subtle>
                      {formatMoney(i.venta)}
                    </Td>
                    <Td align="right" subtle>
                      {formatKilos(i.kg)}
                    </Td>
                    <Td align="right" subtle>
                      {formatMoney(i.margen)}
                    </Td>
                    <Td align="right" subtle>
                      {i.margen_pct.toFixed(1)}%
                    </Td>
                    <Td align="center">
                      <button
                        type="button"
                        onClick={() => reincludeToUniverse(i.name)}
                        title="Re-incluir en el universo"
                        className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-[var(--bg-surface-muted)]"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <RotateCcw size={10} />
                        Re-incluir
                      </button>
                    </Td>
                  </tr>
                ))}
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
// ConcentracionGrid — treemap real con algoritmo "squarify".
//
// Cada bloque tiene ÁREA PROPORCIONAL a su valor (correcto matemáticamente).
// El algoritmo squarify (Van Wijk 2000, mismo que usa D3) minimiza el
// aspect ratio de cada bloque para que tiendan a ser cuadrados, evitando
// los rectángulos amorfos super delgados que Recharts producía.
//
// Características:
//  - Bloque grande del top = MUCHO espacio + tipografía grande
//  - Bloques chicos = pequeños PERO cuadrados (no franjas delgadas)
//  - Tipografía adaptativa por tier (FULL / COMPACT / MINI / MICRO)
//  - "Resto del universo" es un bloque más del treemap, con look neutral
// ============================================================

interface TileInput {
  data: ApiItem | { isResto: true; name: string; value: number };
  value: number;
}

interface PositionedTile {
  data: ApiItem | { isResto: true; name: string; value: number };
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Algoritmo Squarify: distribuye items en un rectángulo (width × height)
 * tal que el área de cada uno sea proporcional a su valor, intentando
 * que el aspect ratio (lado largo / lado corto) sea lo más cercano a 1
 * posible en TODOS los items.
 *
 * Funciona en "strips" recursivos: toma items hasta que agregar el
 * siguiente empeore el aspect ratio del peor de los actuales. Cuando
 * empeora, cierra la strip y empieza una nueva en el espacio restante.
 */
function squarifyLayout(
  tiles: TileInput[],
  width: number,
  height: number
): PositionedTile[] {
  if (tiles.length === 0) return [];
  const sorted = [...tiles].sort((a, b) => b.value - a.value);
  const totalValue = sorted.reduce((s, t) => s + t.value, 0);
  if (totalValue === 0 || width <= 0 || height <= 0) return [];

  // Convertir valores a "áreas" escaladas al espacio total
  const totalArea = width * height;
  const queue = sorted.map((t) => ({
    data: t.data,
    value: t.value,
    area: (t.value / totalValue) * totalArea,
  }));

  const result: PositionedTile[] = [];
  let x = 0,
    y = 0,
    w = width,
    h = height;

  // Worst aspect ratio para una fila candidata
  // (formula clásica de squarified treemaps, Bruls et al. 2000)
  const worstRatio = (areas: number[], shortSide: number): number => {
    const s = shortSide;
    const total = areas.reduce((sum, a) => sum + a, 0);
    if (total === 0) return Infinity;
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    const s2 = s * s;
    const total2 = total * total;
    return Math.max((s2 * max) / total2, total2 / (s2 * min));
  };

  while (queue.length > 0) {
    const shortSide = Math.min(w, h);
    const row: typeof queue = [];
    let prevWorst = Infinity;

    // Greedy: agregamos items mientras mejore el aspect ratio
    while (queue.length > 0) {
      const tentativeAreas = [...row.map((r) => r.area), queue[0].area];
      const newWorst = worstRatio(tentativeAreas, shortSide);
      if (row.length === 0 || newWorst <= prevWorst) {
        row.push(queue.shift()!);
        prevWorst = newWorst;
      } else {
        break;
      }
    }

    // Layout esta strip
    const rowArea = row.reduce((s, r) => s + r.area, 0);
    const isHorizontalStrip = w >= h;

    if (isHorizontalStrip) {
      // Strip vertical (columna) en el lado izquierdo
      const stripW = rowArea / h;
      let curY = y;
      for (const tile of row) {
        const tileH = tile.area / stripW;
        result.push({
          data: tile.data,
          value: tile.value,
          x,
          y: curY,
          w: stripW,
          h: tileH,
        });
        curY += tileH;
      }
      x += stripW;
      w -= stripW;
    } else {
      // Strip horizontal (fila) arriba
      const stripH = rowArea / w;
      let curX = x;
      for (const tile of row) {
        const tileW = tile.area / stripH;
        result.push({
          data: tile.data,
          value: tile.value,
          x: curX,
          y,
          w: tileW,
          h: stripH,
        });
        curX += tileW;
      }
      y += stripH;
      h -= stripH;
    }
  }

  return result;
}

interface ConcentracionGridProps {
  items: ApiItem[];
  restoValue: number;
  restoPct: number;
  restoItemsCount: number;
  restoLabel: string;
  metric: Metric;
  universeValue: number;
  formatValue: (n: number) => string;
  valueOf: (item: ApiItem) => number;
}

// Estado del tooltip flotante del treemap
interface HoverState {
  rank: number | null;
  name: string;
  value: number;
  pct: number;
  isResto: boolean;
  // Posición del cursor RELATIVA al container del treemap (en px)
  cursorX: number;
  cursorY: number;
  // Tamaño del container para clamp dentro de límites
  containerW: number;
  containerH: number;
}

function ConcentracionGrid({
  items,
  restoValue,
  restoPct,
  restoItemsCount,
  restoLabel,
  metric,
  universeValue,
  formatValue,
  valueOf,
}: ConcentracionGridProps) {
  const isAdditive = metric !== "margen_pct";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  // Move handler común: actualiza cursor + dimensiones del container
  const handleTileMove = (
    e: React.MouseEvent<HTMLDivElement>,
    tile: {
      rank: number | null;
      name: string;
      value: number;
      pct: number;
      isResto: boolean;
    }
  ) => {
    const cont = containerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    setHover({
      ...tile,
      cursorX: e.clientX - rect.left,
      cursorY: e.clientY - rect.top,
      containerW: rect.width,
      containerH: rect.height,
    });
  };

  const handleTileLeave = () => setHover(null);

  // Build tiles: items + Resto del universo como un tile más (si aplica)
  const tiles: TileInput[] = useMemo(() => {
    const ts: TileInput[] = items.map((i) => ({
      data: i,
      value: Math.max(0, valueOf(i)),
    }));
    if (isAdditive && restoValue > 0) {
      ts.push({
        data: {
          isResto: true,
          name: `Resto del universo (${restoItemsCount} ${restoLabel})`,
          value: restoValue,
        },
        value: restoValue,
      });
    }
    return ts;
  }, [items, restoValue, restoItemsCount, restoLabel, isAdditive, valueOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxValue = useMemo(
    () => (items.length > 0 ? Math.max(...items.map(valueOf)) : 0),
    [items, valueOf] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Aspect ratio del contenedor: 2:1 funciona bien para treemaps con muchos items
  // (más ancho que alto, más como dashboards profesionales)
  const ASPECT_W = 2;
  const ASPECT_H = 1;
  // Coordenadas virtuales — el render usa porcentajes para responsive
  const virtualW = 1000;
  const virtualH = (virtualW * ASPECT_H) / ASPECT_W;

  const layout = useMemo(
    () => squarifyLayout(tiles, virtualW, virtualH),
    [tiles, virtualW, virtualH]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-[var(--radius-lg)]"
      style={{
        aspectRatio: `${ASPECT_W} / ${ASPECT_H}`,
        background: "var(--bg-page)",
      }}
      onMouseLeave={handleTileLeave}
    >
      {layout.map((tile, idx) => {
        const isResto = "isResto" in tile.data;
        const name = tile.data.name;
        const value = tile.value;
        const pct = isAdditive && universeValue > 0
          ? (value / universeValue) * 100
          : (tile.data as ApiItem).margen_pct ?? 0;
        const rank = isResto ? null : idx + 1;
        const intensity = !isResto && maxValue > 0 ? Math.min(1, value / maxValue) : 0;

        // Posición y tamaño en %
        const leftPct = (tile.x / virtualW) * 100;
        const topPct = (tile.y / virtualH) * 100;
        const widthPct = (tile.w / virtualW) * 100;
        const heightPct = (tile.h / virtualH) * 100;

        return (
          <TreemapTile
            key={isResto ? "__resto__" : (tile.data as ApiItem).name}
            isResto={isResto}
            rank={rank}
            name={name}
            value={value}
            pct={pct}
            intensity={intensity}
            formatValue={formatValue}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
            }}
            onMove={(e) =>
              handleTileMove(e, { rank, name, value, pct, isResto })
            }
          />
        );
      })}

      {/* Tooltip flotante — se renderiza en hover, posicionado cerca
          del cursor (con auto-flip al lado opuesto si está cerca del
          borde para no recortarse). */}
      {hover && (
        <TreemapHoverTooltip
          hover={hover}
          metricLabel={METRIC_LABEL[metric]}
          isAdditive={isAdditive}
          formatValue={formatValue}
        />
      )}
    </div>
  );
}

/** Tooltip flotante del treemap. Se posiciona absolute dentro del container
 *  del grid, con auto-flip si está cerca de los bordes para no recortarse. */
function TreemapHoverTooltip({
  hover,
  metricLabel,
  isAdditive,
  formatValue,
}: {
  hover: HoverState;
  metricLabel: string;
  isAdditive: boolean;
  formatValue: (n: number) => string;
}) {
  const tipRef = useRef<HTMLDivElement | null>(null);
  // Tamaño estimado del tooltip (se ajusta si ya midió)
  const [size, setSize] = useState({ w: 260, h: 130 });

  useEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      setSize({ w: r.width, h: r.height });
    }
  }, [hover.name]);

  const OFFSET = 14;
  // Posición inicial: a la derecha-abajo del cursor
  let left = hover.cursorX + OFFSET;
  let top = hover.cursorY + OFFSET;
  // Flip horizontal si se sale por la derecha
  if (left + size.w > hover.containerW - 4) {
    left = hover.cursorX - size.w - OFFSET;
  }
  // Flip vertical si se sale por abajo
  if (top + size.h > hover.containerH - 4) {
    top = hover.cursorY - size.h - OFFSET;
  }
  // Clamp dentro del container (defensivo)
  left = Math.max(4, Math.min(hover.containerW - size.w - 4, left));
  top = Math.max(4, Math.min(hover.containerH - size.h - 4, top));

  return (
    <div
      ref={tipRef}
      className="pointer-events-none absolute z-20 overflow-hidden rounded-[var(--radius-lg)] border text-xs tabular-nums"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        boxShadow:
          "0 14px 50px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.12)",
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      <div className="flex">
        {/* Accent bar */}
        <div
          style={{
            width: 3,
            background: hover.isResto ? "var(--text-muted)" : "var(--accent)",
          }}
        />
        <div className="flex-1 p-3">
          {/* Header: rank + nombre */}
          <div className="mb-2 flex items-baseline gap-1.5">
            {hover.rank !== null && (
              <span
                className="text-[9px] font-bold tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                #{hover.rank}
              </span>
            )}
            <span
              className="truncate text-[11px] font-bold uppercase tracking-wider"
              style={{
                color: "var(--text-primary)",
                wordBreak: "break-word",
              }}
              title={hover.name}
            >
              {hover.name}
            </span>
          </div>

          {/* Valor grande */}
          <div className="mb-2">
            <div
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {hover.isResto ? "Restante del universo" : metricLabel}
            </div>
            <div
              className="text-lg font-bold leading-tight"
              style={{
                color: hover.isResto
                  ? "var(--text-secondary)"
                  : "var(--accent)",
              }}
            >
              {formatValue(hover.value)}
            </div>
          </div>

          {/* Pill con %  */}
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: hover.isResto
                  ? "var(--bg-surface-muted)"
                  : "var(--accent-soft)",
                color: hover.isResto
                  ? "var(--text-secondary)"
                  : "var(--accent)",
              }}
            >
              {hover.pct.toFixed(1)}%
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {isAdditive ? "del universo total" : "margen real"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cada tile del treemap. Posicionado absolutamente con porcentajes.
 *  Tipografía adaptativa según el tamaño REAL renderizado del tile.
 *  Usa container queries vía useRef + measurements para decidir el tier.
 *  Reporta hover al padre via onMove para que renderice el tooltip custom. */
function TreemapTile({
  isResto,
  rank,
  name,
  value,
  pct,
  intensity,
  formatValue,
  style,
  onMove,
}: {
  isResto: boolean;
  rank: number | null;
  name: string;
  value: number;
  pct: number;
  intensity: number;
  formatValue: (n: number) => string;
  style: React.CSSProperties;
  onMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const tileRef = useRef<HTMLDivElement | null>(null);
  const [tier, setTier] = useState<"full" | "compact" | "mini" | "micro">("full");

  // Medir el tile renderizado para decidir el tier
  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        const next: typeof tier =
          w > 140 && h > 90
            ? "full"
            : w > 90 && h > 50
              ? "compact"
              : w > 50 && h > 28
                ? "mini"
                : "micro";
        setTier(next);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Color: items con gradient naranja por importancia, Resto neutro
  const fill = isResto
    ? "var(--bg-surface-muted)"
    : `rgba(237, 104, 8, ${0.62 + intensity * 0.38})`;
  const titleColor = isResto ? "var(--text-primary)" : "#ffffff";
  const valueColor = isResto
    ? "var(--text-secondary)"
    : "rgba(255,255,255,0.92)";
  const badgeBg = isResto
    ? "var(--bg-page)"
    : "rgba(255, 255, 255, 0.96)";
  const badgeText = isResto ? "var(--text-primary)" : "#9a3412";
  const badgeBorder = isResto ? "1px solid var(--border-strong)" : "none";

  return (
    <div
      ref={tileRef}
      className="absolute overflow-hidden rounded-md transition-transform hover:z-10 hover:scale-[1.02]"
      style={{
        ...style,
        padding: 2, // gap entre tiles via padding del wrapper
      }}
      onMouseMove={onMove}
    >
      <div
        className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-md p-2"
        style={{
          background: fill,
          border: isResto
            ? "1px solid var(--border)"
            : "1px solid rgba(255,255,255,0.12)",
          boxShadow: isResto
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.14)",
        }}
      >
        {/* === Tier FULL: todo === */}
        {tier === "full" && (
          <>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                {rank && (
                  <span
                    className="shrink-0 text-[10px] font-bold tabular-nums"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    #{rank}
                  </span>
                )}
                <span
                  className="line-clamp-2 text-[12px] font-bold uppercase leading-tight tracking-wide"
                  style={{
                    color: titleColor,
                    overflowWrap: "anywhere",
                  }}
                >
                  {name}
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span
                className="text-sm font-semibold leading-tight tabular-nums"
                style={{ color: valueColor }}
              >
                {formatValue(value)}
              </span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                style={{
                  background: badgeBg,
                  color: badgeText,
                  border: badgeBorder,
                }}
              >
                {pct.toFixed(1)}%
              </span>
            </div>
          </>
        )}

        {/* === Tier COMPACT: nombre + badge === */}
        {tier === "compact" && (
          <>
            <div className="flex items-baseline gap-1">
              {rank && (
                <span
                  className="shrink-0 text-[9px] font-bold tabular-nums"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  #{rank}
                </span>
              )}
              <span
                className="line-clamp-2 text-[10px] font-bold uppercase leading-tight"
                style={{
                  color: titleColor,
                  overflowWrap: "anywhere",
                }}
              >
                {name}
              </span>
            </div>
            <div className="flex items-end justify-between gap-1">
              <span
                className="text-[10px] font-medium tabular-nums"
                style={{ color: valueColor }}
              >
                {formatValue(value)}
              </span>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                style={{
                  background: badgeBg,
                  color: badgeText,
                  border: badgeBorder,
                }}
              >
                {pct.toFixed(1)}%
              </span>
            </div>
          </>
        )}

        {/* === Tier MINI: solo badge % centrado === */}
        {tier === "mini" && (
          <div className="flex h-full items-center justify-center">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: badgeBg,
                color: badgeText,
                border: badgeBorder,
              }}
            >
              {pct.toFixed(1)}%
            </span>
          </div>
        )}

        {/* === Tier MICRO: solo color, border más visible === */}
        {/* (No agregamos nada — el wrapper ya tiene background y border) */}
      </div>
    </div>
  );
}

// ============================================================
// (Legacy) TreemapPayload — mantenido por si en el futuro se reactiva
// el modo Treemap algorítmico. No se usa en el render actual.
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

  // Intensidad por importancia (0–1)
  const intensity =
    maxValue && maxValue > 0 ? Math.min(1, (value ?? 0) / maxValue) : 0;

  // Fill principal:
  //  - Items: naranja Susazón con opacidad creciente por importancia (0.78 → 1.0).
  //    Funciona en ambos themes (light y dark) porque el naranja es vibrante.
  //  - Resto: usa CSS var → se adapta automáticamente al theme activo.
  //    En "Susazón Moderno" (dark) será #1f1f1f, en "Clean" (light) será #f1f5f9.
  const fill = isResto
    ? "var(--bg-surface-muted)"
    : `rgba(237, 104, 8, ${0.78 + intensity * 0.22})`;

  // Stroke: usa el bg-page como "gutter" entre bloques (gap visual limpio).
  // En dark theme = negro casi total, en light = casi blanco. Universal.
  const strokeColor = "var(--bg-page)";
  const strokeWidth = 3;

  // Inset para no recortar el border-radius con el stroke
  const inset = strokeWidth / 2;
  const rectX = x + inset;
  const rectY = y + inset;
  const rectW = Math.max(0, width - strokeWidth);
  const rectH = Math.max(0, height - strokeWidth);

  // Texto:
  //  - Items: blanco puro (legible sobre naranja saturado)
  //  - Resto: var(--text-primary) (se adapta al theme)
  const titleColor = isResto ? "var(--text-primary)" : "#ffffff";
  const valueColor = isResto
    ? "var(--text-secondary)"
    : "rgba(255,255,255,0.85)";

  // Badge del %: pill blanco semi-translúcido con texto del color del bloque.
  // En items: pill blanco + texto naranja oscuro (orange-900 #9a3412)
  // En resto: pill var(--bg-page) + texto var(--text-primary) → adapta a theme
  const badgeBg = isResto ? "var(--bg-page)" : "rgba(255, 255, 255, 0.96)";
  const badgeText = isResto ? "var(--text-primary)" : "#9a3412";
  const badgeBorder = isResto ? "var(--border-strong)" : "transparent";

  // Padding adaptativo: pequeño para bloques chicos, generoso para grandes
  const padding = Math.max(5, Math.min(18, Math.min(width, height) * 0.09));
  const innerLeft = x + padding;
  const innerTop = y + padding;
  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

  // ===== Sistema de tiers según área disponible =====
  // Tier FULL: bloque grande, muestra todo (título + valor + badge esquina)
  // Tier COMPACT: mediano, título corto + badge esquina
  // Tier BADGE_ONLY: pequeño pero útil → solo el % centrado (legible)
  // Tier MICRO: muy pequeño → solo color, sin texto (hover muestra info)
  const tier: "full" | "compact" | "badge_only" | "micro" =
    innerW > 70 && innerH > 60
      ? "full"
      : innerW > 50 && innerH > 30
        ? "compact"
        : innerW > 24 && innerH > 14
          ? "badge_only"
          : "micro";

  // Font size dinámico — más sensible al área para bloques chicos
  const baseFont = Math.sqrt(width * height) * 0.12;
  const titleFontSize = Math.max(10, Math.min(22, baseFont));
  const valueFontSize = Math.max(9, Math.min(14, titleFontSize * 0.68));
  const badgeFontSize = Math.max(9, Math.min(13, titleFontSize * 0.62));

  const displayName = truncate(
    name ?? "",
    maxCharsForWidth(innerW, titleFontSize)
  );

  // Badge del % (esquina inferior derecha en FULL/COMPACT)
  const badgeLabel = `${(pct ?? 0).toFixed(1)}%`;
  const badgeFontWidth = badgeLabel.length * badgeFontSize * 0.58;
  const badgePadX = 7;
  const badgePadY = 3;
  const badgeW = badgeFontWidth + badgePadX * 2;
  const badgeH = badgeFontSize + badgePadY * 2;
  const badgeX = x + width - padding - badgeW;
  const badgeY = y + height - padding - badgeH;

  // Para tier BADGE_ONLY: mini-badge centrado con solo el %
  const miniBadgeFontSize = Math.max(8, Math.min(11, Math.min(width, height) * 0.15));
  const miniBadgeLabel = `${(pct ?? 0).toFixed(1)}%`;
  const miniBadgeFontWidth = miniBadgeLabel.length * miniBadgeFontSize * 0.58;
  const miniBadgePadX = 5;
  const miniBadgePadY = 2;
  const miniBadgeW = miniBadgeFontWidth + miniBadgePadX * 2;
  const miniBadgeH = miniBadgeFontSize + miniBadgePadY * 2;
  const miniBadgeX = x + width / 2 - miniBadgeW / 2;
  const miniBadgeY = y + height / 2 - miniBadgeH / 2;

  return (
    <g>
      {/* Bloque principal */}
      <rect
        x={rectX}
        y={rectY}
        width={rectW}
        height={rectH}
        rx={6}
        ry={6}
        style={{
          fill,
          stroke: strokeColor,
          strokeWidth,
        }}
      />

      {/* Highlight superior translúcido (profundidad) — solo items, no resto */}
      {!isResto && height > 36 && (
        <rect
          x={rectX}
          y={rectY}
          width={rectW}
          height={Math.min(8, height / 8)}
          rx={6}
          ry={6}
          style={{
            fill: "rgba(255,255,255,0.13)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Borde sutil interno (separa la "luz" del fill) */}
      {!isResto && (
        <rect
          x={rectX + 1}
          y={rectY + 1}
          width={Math.max(0, rectW - 2)}
          height={Math.max(0, rectH - 2)}
          rx={5}
          ry={5}
          fill="none"
          style={{
            stroke: "rgba(255,255,255,0.10)",
            strokeWidth: 1,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Patrón diagonal sutil para el "Resto del universo" (sin pattern SVG,
          solo una franja decorativa horizontal para diferenciar visualmente) */}
      {isResto && height > 30 && (
        <rect
          x={rectX}
          y={rectY + rectH / 2 - 0.5}
          width={rectW}
          height={1}
          style={{
            fill: "var(--border)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* === Tier FULL: título + valor + badge esquina === */}
      {tier === "full" && (
        <>
          <text
            x={innerLeft}
            y={innerTop + titleFontSize}
            textAnchor="start"
            stroke="none"
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
          <text
            x={innerLeft}
            y={innerTop + titleFontSize + valueFontSize + 8}
            textAnchor="start"
            stroke="none"
            style={{
              fontSize: valueFontSize,
              fontWeight: 500,
              fill: valueColor,
              pointerEvents: "none",
            }}
          >
            {formatValue ? formatValue(value ?? 0) : (value ?? 0).toFixed(0)}
          </text>
          {/* Badge pill esquina inferior derecha */}
          <rect
            x={badgeX}
            y={badgeY}
            width={badgeW}
            height={badgeH}
            rx={badgeH / 2}
            ry={badgeH / 2}
            style={{
              fill: badgeBg,
              stroke: isResto ? badgeBorder : "none",
              strokeWidth: isResto ? 1 : 0,
              pointerEvents: "none",
            }}
          />
          <text
            x={badgeX + badgeW / 2}
            y={badgeY + badgeH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            style={{
              fontSize: badgeFontSize,
              fontWeight: 700,
              fill: badgeText,
              letterSpacing: "0.02em",
              pointerEvents: "none",
            }}
          >
            {badgeLabel}
          </text>
        </>
      )}

      {/* === Tier COMPACT: título truncado + badge esquina === */}
      {tier === "compact" && (
        <>
          <text
            x={innerLeft}
            y={innerTop + titleFontSize}
            textAnchor="start"
            stroke="none"
            style={{
              fontSize: Math.max(9, titleFontSize * 0.85),
              fontWeight: 700,
              fill: titleColor,
              letterSpacing: "0.01em",
              pointerEvents: "none",
            }}
          >
            {truncate(
              name ?? "",
              maxCharsForWidth(innerW, titleFontSize * 0.85)
            )}
          </text>
          {/* Badge pill abajo-derecha (más chico) */}
          <rect
            x={badgeX}
            y={badgeY}
            width={badgeW}
            height={badgeH}
            rx={badgeH / 2}
            ry={badgeH / 2}
            style={{
              fill: badgeBg,
              stroke: isResto ? badgeBorder : "none",
              strokeWidth: isResto ? 1 : 0,
              pointerEvents: "none",
            }}
          />
          <text
            x={badgeX + badgeW / 2}
            y={badgeY + badgeH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            style={{
              fontSize: badgeFontSize,
              fontWeight: 700,
              fill: badgeText,
              letterSpacing: "0.02em",
              pointerEvents: "none",
            }}
          >
            {badgeLabel}
          </text>
        </>
      )}

      {/* === Tier BADGE_ONLY: solo el % centrado en bloque pequeño === */}
      {tier === "badge_only" && (
        <>
          <rect
            x={miniBadgeX}
            y={miniBadgeY}
            width={miniBadgeW}
            height={miniBadgeH}
            rx={miniBadgeH / 2}
            ry={miniBadgeH / 2}
            style={{
              fill: badgeBg,
              stroke: isResto ? badgeBorder : "none",
              strokeWidth: isResto ? 1 : 0,
              pointerEvents: "none",
            }}
          />
          <text
            x={miniBadgeX + miniBadgeW / 2}
            y={miniBadgeY + miniBadgeH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            stroke="none"
            style={{
              fontSize: miniBadgeFontSize,
              fontWeight: 700,
              fill: badgeText,
              letterSpacing: "0.02em",
              pointerEvents: "none",
            }}
          >
            {miniBadgeLabel}
          </text>
        </>
      )}

      {/* === Tier MICRO: nada de texto, solo color/border bien visible.
          El usuario ve % al hover. Aumentamos el strokeWidth del borde
          interno para que el bloque sea identificable como tal. === */}
      {tier === "micro" && !isResto && (
        <rect
          x={rectX + 0.5}
          y={rectY + 0.5}
          width={Math.max(0, rectW - 1)}
          height={Math.max(0, rectH - 1)}
          rx={5}
          ry={5}
          fill="none"
          style={{
            stroke: "rgba(255,255,255,0.35)",
            strokeWidth: 1,
            pointerEvents: "none",
          }}
        />
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
    // Pareto: % del total (share), % acumulado, y bandera de "Resto".
    share?: number;
    cumPct?: number | null;
    isResto?: boolean;
  };
}

/** Wrapper común para los tooltips: card moderna con accent bar a la izquierda,
 *  shadow rica y backdrop sutil. */
function TooltipCard({
  children,
  isResto = false,
}: {
  children: React.ReactNode;
  isResto?: boolean;
}) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border text-xs tabular-nums"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        boxShadow:
          "0 10px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        minWidth: 220,
        maxWidth: 320,
      }}
    >
      {/* Accent bar a la izquierda — naranja para items, gris para Resto */}
      <div className="flex">
        <div
          style={{
            width: 3,
            background: isResto ? "var(--text-muted)" : "var(--accent)",
          }}
        />
        <div className="flex-1 p-3">{children}</div>
      </div>
    </div>
  );
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
  const isResto = d.name === "Resto del universo";
  return (
    <TooltipCard isResto={isResto}>
      {/* Header con nombre */}
      <div
        className="mb-2 truncate text-[11px] font-bold uppercase tracking-wider"
        style={{ color: "var(--text-primary)" }}
        title={d.name}
      >
        {d.name}
      </div>

      {/* Valor grande */}
      <div className="mb-1.5">
        <div
          className="text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {isResto ? "Restante en el universo" : "Valor en el periodo"}
        </div>
        <div
          className="text-base font-bold leading-tight"
          style={{ color: isResto ? "var(--text-secondary)" : "var(--accent)" }}
        >
          {formatValue(d.value ?? 0)}
        </div>
      </div>

      {/* Pill con % del universo */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{
            background: isResto
              ? "var(--bg-surface-muted)"
              : "var(--accent-soft)",
            color: isResto ? "var(--text-secondary)" : "var(--accent)",
          }}
        >
          {(d.pct ?? 0).toFixed(1)}%
        </span>
        <span
          className="text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          del universo total
        </span>
      </div>
    </TooltipCard>
  );
}

function ParetoTooltip({
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
  const displayName = d.fullName ?? d.name ?? "";
  const isResto = d.isResto ?? displayName === "Resto";
  return (
    <TooltipCard isResto={isResto}>
      {/* Header con nombre completo (sin truncar) */}
      <div
        className="mb-2 text-[11px] font-bold uppercase tracking-wider"
        style={{
          color: "var(--text-primary)",
          wordBreak: "break-word",
        }}
      >
        {displayName}
      </div>

      {isAdditive ? (
        <>
          {/* Valor de la métrica */}
          <div className="mb-1.5">
            <div
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {metricLabel}
            </div>
            <div
              className="text-base font-bold leading-tight"
              style={{ color: "var(--accent)" }}
            >
              {formatValue(d.value ?? 0)}
            </div>
          </div>
          {/* Pills: % del total + % acumulado */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{
                background: isResto
                  ? "var(--bg-surface-muted)"
                  : "var(--accent-soft)",
                color: isResto ? "var(--text-secondary)" : "var(--accent)",
              }}
            >
              {(d.share ?? 0).toFixed(1)}% del total
            </span>
            {d.cumPct != null && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                style={{
                  background: "var(--bg-surface-muted)",
                  color: "var(--text-primary)",
                }}
              >
                {(d.cumPct ?? 0).toFixed(1)}% acum.
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Para Margen %: valor grande sin "% del universo" */}
          <div>
            <div
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Margen %
            </div>
            <div
              className="text-base font-bold leading-tight"
              style={{ color: "var(--accent)" }}
            >
              {(d.value ?? 0).toFixed(1)}%
            </div>
          </div>
        </>
      )}
    </TooltipCard>
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
