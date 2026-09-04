"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";
import { ClienteDesglose } from "@/components/dashboard/ClienteDesglose";
import { ProductoDesglose } from "@/components/dashboard/ProductoDesglose";
import {
  GroupedBarChart,
  type GroupedBarSeries,
} from "@/components/dashboard/GroupedBarChart";
import { MultiSelectChips } from "@/components/dashboard/MultiSelectChips";
import { ClientesEvolutionChart } from "@/components/dashboard/ClientesEvolutionChart";
import { ClientesTresAniosChart } from "@/components/dashboard/ClientesTresAniosChart";
import {
  ClientesTableViews,
  type TableViewsContext,
} from "@/components/dashboard/ClientesTableViews";
import { MesesHistTable } from "@/components/dashboard/MesesHistTable";
import { ExportExcelButton } from "@/components/dashboard/ExportExcelButton";
import { ReportButton } from "@/components/dashboard/ReportButton";
import type { BuildReportInput } from "@/lib/report-pdf/data";
import type {
  ExcelColumn,
  ExcelSummaryRow,
} from "@/lib/export-excel";

type DimensionViewMode = "pesos" | "kg";

export interface DimensionRow {
  name: string;
  // Cierre del mes (mes completo de cada año). 2026 = mes en curso.
  v24: number;
  v25: number;
  v26: number;
  // Opcionales — Productos los popula con kg y margen.
  k24?: number;
  k25?: number;
  k26?: number;
  m24?: number;
  m25?: number;
  m26?: number;
  // ===== Acumulado al "mismo día laboral" del mes 2026 actual (Mejora 2) =====
  // Para 2026 = lo facturado hasta hoy (igual que v26 cuando el mes está
  // en curso; igual que cierre cuando ya pasó).
  // Para 2024 y 2025: acumulado al día calendario equivalente al día hábil
  // que llevamos en 2026. Permite comparativos día-vs-día equitativos.
  v24_alDia?: number;
  v25_alDia?: number;
  v26_alDia?: number;
  k24_alDia?: number;
  k25_alDia?: number;
  k26_alDia?: number;
  m24_alDia?: number;
  m25_alDia?: number;
  m26_alDia?: number;
  // Tab Vendedores y Clientes pueden traer info extra
  empresa?: string; // "Sus" | "Suve" para Vendedores
}

interface Props {
  rows: DimensionRow[];
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
  /** Header/columna: "Grupo" / "Cliente" / "Vendedor" */
  dimensionLabel: string;
  /** Plural usado en titulo del chart: "Grupos" / "Clientes" / "Vendedores" */
  dimensionLabelPlural: string;
  /** Cuantos en chart (resto en tabla). Si null, muestra TODOS en chart. Default 10. */
  topNChart?: number | null;
  /** Cuantos en tabla. Si null, muestra TODOS. Default null (todos). */
  topNTable?: number | null;
  /** Si true, agrega 4 columnas extra de KG en la tabla (kg24, kg25, kg26, var % kg).
   *  Solo se activa cuando los rows traen k24/k25/k26 poblados. Default false. */
  showKg?: boolean;
  /** Si true, agrega un buscador con multi-select arriba del chart. La selección
   *  override el Top N (sólo afecta el chart, la tabla mantiene Top N). */
  enableMultiSelect?: boolean;
  /** Key de localStorage para persistir la selección entre sesiones. Requerido
   *  cuando enableMultiSelect=true. */
  selectionStorageKey?: string;
  /** Máximo de items seleccionables en el multi-select. Default 15. */
  multiSelectMaxItems?: number;
  /** Placeholder del buscador (ej. "Buscar cliente…"). */
  multiSelectPlaceholder?: string;
  /** Si está definido, se renderiza el botón "Exportar Excel" arriba del chart.
   *  El nombre se usa para filename + sheet name. Ej: "GrupoProducto",
   *  "Clientes", "Vendedores_Sus". */
  exportTabName?: string;
  /** Etiqueta corta del periodo para el resumen. Ej: "Mayo 2026". */
  exportPeriodLabel?: string;
  /** Territorio activo para resumen + filename del Excel. "" = "Todos". */
  exportTerritory?: string;
  /** Permiso para descargar Excel (default false). */
  canExportExcel?: boolean;
  /** Input para el reporte PDF "Avance Comercial". Si null, el botón se
   *  renderiza disabled (sin data, ej. modo agregado vacío). */
  reportInput?: BuildReportInput | null;
  /** Si se pasa, habilita el toggle Pesos/Kilos en este tab y usa esta key
   *  para persistir el modo en localStorage. Cada tab que use DimensionTab
   *  debe pasar una key distinta (ej. "grupo-tab-mode", "clientes-tab-mode",
   *  "vendedores-tab-mode") para que los toggles sean independientes.
   *  Si NO se pasa, no se muestra el toggle (modo Pesos hardcoded). */
  modeStorageKey?: string;
  /** Si true, habilita el toggle "Mismo mes (3 años) | Evolución {año}" en la
   *  gráfica superior. Solo lo usa el tab Clientes (Mejora 2). Requiere
   *  evolutionContext + evolutionStorageKey. */
  enableEvolution?: boolean;
  /** Contexto para el fetch lazy de evolución mensual. */
  evolutionContext?: {
    year: number;
    month: number;
    territorios: string[] | null;
  };
  /** Key de localStorage para persistir la vista de la gráfica
   *  ("mismo-mes" | "evolucion"). */
  evolutionStorageKey?: string;
  /** Si true, agrega un toggle "Buscar por: Clientes | Productos" al buscador.
   *  En modo Productos, seleccionar SKUs muestra los clientes que más los
   *  compran. Solo lo usa el tab Clientes (Mejora 3). */
  enableProductSearch?: boolean;
  /** Lista de SKUs disponibles para el buscador en modo Productos. */
  productOptions?: string[];
  /** Contexto para el fetch lazy de clientes-por-producto. */
  productSearchContext?: {
    year: number;
    month: number;
    daysCurrent: number;
    territorios: string[] | null;
  };
  /** Si true, agrega un toggle de vistas a la tabla inferior:
   *  "Año vs Año" | "Meses 2026" | "vs Prom. 90d" (Mejora 4). Solo Clientes. */
  enableTableViews?: boolean;
  /** Contexto para las vistas alternativas de tabla (sin currentByClient,
   *  que se arma internamente desde tableRows). */
  tableViewsContext?: Omit<TableViewsContext, "currentByClient">;
  /** Si true, cada fila de la tabla (vista Año vs Año) se expande para mostrar
   *  el desglose por línea de producto (grupo → SKU) del cliente (Mejora 5).
   *  Solo lo usa el tab Clientes. */
  enableRowExpand?: boolean;
  /** Contexto para el fetch lazy del desglose por cliente. */
  rowExpandContext?: {
    year: number;
    month: number;
    daysCurrent: number;
    territorios: string[] | null;
  };
  /** Si se pasa, el buscador (multi-select) usa el UNIVERSO DEL AÑO COMPLETO
   *  (todos los SKUs/clientes con venta en el año, no solo los del mes
   *  seleccionado). Resuelve el caso de un item que vendió en otro mes pero 0
   *  en el mes en curso. Se busca vía /api/dashboard/dim-universe. */
  fullYearSearchContext?: {
    year: number;
    territorios: string[] | null;
    agrupadorId: string | null;
  };
  /** Dimensión de los datos: "cliente" (default) | "sku". Determina a qué
   *  endpoints llaman las features ricas (evolución / meses / prom 90d).
   *  Permite reutilizar el motor para Productos (Fase 2). */
  dimension?: "cliente" | "sku";
  /** Modo Pesos/Kilos controlado externamente. Si se pasa, se usa este en vez
   *  del estado interno y se oculta el ModeToggle propio (el contenedor
   *  unificado lo controla una sola vez para gráfica + tabla). */
  controlledMode?: DimensionViewMode;
  /** Si false, oculta la sección gráfica (toolbar de modo + chart + buscador).
   *  Default true. El contenedor lo usa para mostrar solo una sección por
   *  instancia (gráfica de una dimensión, tabla de otra). */
  showChart?: boolean;
  /** Si false, oculta la sección tabla. Default true. */
  showTable?: boolean;
}

/**
 * Componente generico para tabs basados en una dimension (grupo, cliente,
 * vendedor) con la misma estructura: bar chart top N + tabla con
 * comparacion 3 anos + Var %.
 *
 * Usado por:
 *  - Tab Grupo Producto (cambio funcional #1 + #2)
 *  - Tab Clientes (cambio #3)
 *  - Tab Vendedores
 *
 * El bug del V2.2 ("$0, $1, $2..." en eje X) se resuelve usando Recharts
 * con XAxis dataKey="name" en GroupedBarChart.
 */
export function DimensionTab({
  rows,
  monthLabel24,
  monthLabel25,
  monthLabel26,
  dimensionLabel,
  dimensionLabelPlural,
  topNChart = 10,
  topNTable = null,
  showKg = false,
  enableMultiSelect = false,
  selectionStorageKey,
  multiSelectMaxItems = 15,
  multiSelectPlaceholder = "Buscar…",
  exportTabName,
  exportPeriodLabel,
  exportTerritory = "",
  canExportExcel = false,
  reportInput = null,
  modeStorageKey,
  enableEvolution = false,
  evolutionContext,
  evolutionStorageKey,
  enableProductSearch = false,
  productOptions,
  productSearchContext,
  enableTableViews = false,
  tableViewsContext,
  enableRowExpand = false,
  rowExpandContext,
  fullYearSearchContext,
  dimension = "cliente",
  controlledMode,
  showChart = true,
  showTable = true,
}: Props) {
  // ============ Filas expandibles (Mejora 5) ============
  // Cada cliente se expande para ver su desglose por grupo → SKU.
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set()
  );
  const toggleClientExpand = (name: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  // ============ Toggle de vistas de tabla (Mejora 4) ============
  // "anio" (default) | "meses" (12 meses del año en curso + Total YTD) |
  // "meses-hist" (matriz Años×Meses, 3 años, Mejora 3 V4.3) | "prom90".
  const [tableView, setTableView] = useState<
    "anio" | "meses" | "meses-hist" | "prom90"
  >("anio");
  useEffect(() => {
    if (!enableTableViews) return;
    try {
      const saved = window.localStorage.getItem("clientes-table-view");
      if (
        saved === "anio" ||
        saved === "meses" ||
        saved === "meses-hist" ||
        saved === "prom90"
      ) {
        setTableView(saved);
      }
    } catch {
      // ignore
    }
  }, [enableTableViews]);
  const switchTableView = (
    next: "anio" | "meses" | "meses-hist" | "prom90"
  ) => {
    setTableView(next);
    try {
      window.localStorage.setItem("clientes-table-view", next);
    } catch {
      // ignore
    }
  };
  // ============ Modo de búsqueda: Clientes / Productos (Mejora 3) ============
  // Solo se activa con enableProductSearch (tab Clientes). En modo Productos,
  // seleccionar SKUs muestra los clientes que más los compran (fetch lazy).
  const [searchMode, setSearchMode] = useState<"clientes" | "productos">(
    "clientes"
  );
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productClientRows, setProductClientRows] = useState<DimensionRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const productMode = enableProductSearch && searchMode === "productos";

  // ===== Universo de búsqueda del AÑO COMPLETO (fix: SKU/cliente sin venta en
  // el mes seleccionado no aparecía en el buscador). Fetch lazy vía
  // /api/dashboard/dim-universe cuando se pasa fullYearSearchContext. =====
  const [yearUniverse, setYearUniverse] = useState<string[]>([]);
  const fyTerritoriosKey =
    fullYearSearchContext == null
      ? ""
      : fullYearSearchContext.territorios === null
        ? "__ALL__"
        : fullYearSearchContext.territorios.slice().sort().join("|");
  useEffect(() => {
    let cancelled = false;
    if (!fullYearSearchContext) {
      setYearUniverse([]);
      return;
    }
    const params = new URLSearchParams();
    params.set("dimension", dimension === "sku" ? "productos" : "clientes");
    params.set("year", String(fullYearSearchContext.year));
    if (fullYearSearchContext.territorios !== null) {
      params.set("territorios", fullYearSearchContext.territorios.join(","));
    }
    if (fullYearSearchContext.agrupadorId) {
      params.set("agrupador", fullYearSearchContext.agrupadorId);
    }
    fetch(`/api/dashboard/dim-universe?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: { names?: string[] }) => {
        if (!cancelled) setYearUniverse(json.names ?? []);
      })
      .catch(() => {
        if (!cancelled) setYearUniverse([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, fullYearSearchContext?.year, fyTerritoriosKey, fullYearSearchContext?.agrupadorId]);
  // Cliente elegido para la vista Evolución en modo Productos (1 a la vez).
  const [evolutionClient, setEvolutionClient] = useState<string | null>(null);
  // ============ Toggle vista gráfica: Mismo mes (3 años) / Evolución ============
  // Solo se activa con enableEvolution (tab Clientes). Persiste en localStorage.
  const [chartView, setChartView] = useState<"mismo-mes" | "evolucion">(
    "mismo-mes"
  );
  useEffect(() => {
    if (!evolutionStorageKey) return;
    try {
      const saved = window.localStorage.getItem(evolutionStorageKey);
      if (saved === "evolucion" || saved === "mismo-mes") setChartView(saved);
    } catch {
      // ignore
    }
  }, [evolutionStorageKey]);
  const switchChartView = (next: "mismo-mes" | "evolucion") => {
    setChartView(next);
    if (!evolutionStorageKey) return;
    try {
      window.localStorage.setItem(evolutionStorageKey, next);
    } catch {
      // ignore
    }
  };
  // ============ Toggle Pesos / Kilos ============
  // Solo se renderiza si se pasa modeStorageKey. Cada tab tiene su propio
  // key para que el modo sea independiente: Grupo en Pesos, Clientes en Kg
  // si quieren. Las LÍNEAS DE MARGEN % siempre se mantienen fijas en el
  // eje Y derecho — el toggle solo afecta las barras y el eje Y izquierdo.
  const [mode, setMode] = useState<DimensionViewMode>("pesos");
  useEffect(() => {
    if (!modeStorageKey) return;
    try {
      const saved = window.localStorage.getItem(modeStorageKey);
      if (saved === "kg" || saved === "pesos") setMode(saved);
    } catch {
      // ignore
    }
  }, [modeStorageKey]);
  const switchMode = (next: DimensionViewMode) => {
    setMode(next);
    if (!modeStorageKey) return;
    try {
      window.localStorage.setItem(modeStorageKey, next);
    } catch {
      // ignore
    }
  };
  // Modo efectivo: el controlado externamente (contenedor unificado) o el
  // interno. isKg y los hijos usan effectiveMode.
  const effectiveMode = controlledMode ?? mode;
  const isKg = effectiveMode === "kg";
  // Selección custom (multi-select). Vacía = comportamiento default Top N.
  // Persistencia en localStorage si selectionStorageKey está definido.
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  useEffect(() => {
    if (!enableMultiSelect || !selectionStorageKey) return;
    try {
      const raw = window.localStorage.getItem(selectionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSelectedItems(parsed.filter((s) => typeof s === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, [enableMultiSelect, selectionStorageKey]);
  const updateSelected = (next: string[]) => {
    const trimmed = next.slice(0, multiSelectMaxItems);
    setSelectedItems(trimmed);
    if (!selectionStorageKey) return;
    try {
      window.localStorage.setItem(
        selectionStorageKey,
        JSON.stringify(trimmed)
      );
    } catch {
      // ignore
    }
  };

  // Handler de selección de productos (modo Productos).
  const updateSelectedProducts = (next: string[]) => {
    setSelectedProducts(next.slice(0, multiSelectMaxItems));
  };

  // Fetch lazy de clientes-por-producto cuando hay SKUs seleccionados.
  const productKey = selectedProducts.slice().sort().join("|");
  const territoriosKey =
    productSearchContext == null
      ? ""
      : productSearchContext.territorios === null
        ? "__ALL__"
        : productSearchContext.territorios.slice().sort().join("|");
  useEffect(() => {
    let cancelled = false;
    if (!productMode || !productSearchContext) return;
    if (selectedProducts.length === 0) {
      setProductClientRows([]);
      return;
    }
    setLoadingProducts(true);
    const params = new URLSearchParams();
    params.set("year", String(productSearchContext.year));
    params.set("month", String(productSearchContext.month));
    params.set("daysCurrent", String(productSearchContext.daysCurrent));
    params.set("skus", selectedProducts.join(","));
    // Traemos todos los clientes que compran esos SKUs (el dropdown de
    // Evolución los lista completos; chart/tabla aplican su propio top).
    params.set("topN", "2000");
    if (productSearchContext.territorios !== null) {
      params.set("territorios", productSearchContext.territorios.join(","));
    }
    fetch(`/api/dashboard/clientes-por-producto?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { rows?: DimensionRow[] }) => {
        if (!cancelled) setProductClientRows(json.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setProductClientRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productMode, productKey, territoriosKey]);

  // Source de filas según el modo: en modo Productos usamos los clientes que
  // compran los SKUs (fetched); en modo Clientes, los rows del server.
  const sourceRows = productMode ? productClientRows : rows;

  const sorted = useMemo(
    () => [...sourceRows].sort((a, b) => b.v26 - a.v26),
    [sourceRows]
  );

  // Items disponibles para el multi-select:
  //  - modo Clientes: nombres de clientes
  //  - modo Productos: lista de SKUs (productOptions)
  const availableItems = useMemo(() => {
    if (productMode) return productOptions ?? [];
    const monthNames = sorted.map((r) => r.name);
    // Con universo de año completo: unimos los del mes (orden por venta) con
    // los del año que no estén ya (fix del buscador). NO quitamos ninguno de
    // los del mes (incluye items que solo vendieron en el mes de años previos).
    if (!fullYearSearchContext || yearUniverse.length === 0) return monthNames;
    const seen = new Set(monthNames);
    const extras = yearUniverse.filter((n) => !seen.has(n));
    return [...monthNames, ...extras];
  }, [productMode, productOptions, sorted, fullYearSearchContext, yearUniverse]);

  // Selección activa según modo (clientes vs productos).
  const activeSelected = productMode ? selectedProducts : selectedItems;
  const activeUpdate = productMode ? updateSelectedProducts : updateSelected;

  // isCustomMode: solo aplica en modo Clientes (la selección filtra rows).
  // En modo Productos los rows YA vienen filtrados/rankeados del endpoint.
  const isCustomMode =
    !productMode && enableMultiSelect && selectedItems.length > 0;

  // Items del chart:
  //  - Custom: respeta orden de selección del usuario, mapea a rows reales
  //  - Default: top N por venta del mes actual
  const top = useMemo(() => {
    if (isCustomMode) {
      const byName = new Map(rows.map((r) => [r.name, r]));
      return selectedItems
        .map(
          (name) =>
            byName.get(name) ??
            // Item seleccionado del universo anual que NO vendió en el mes
            // seleccionado → fila-cero. Las vistas de mes (Año vs Año, gráfica)
            // lo muestran en 0; "Meses {año}" trae su desglose real por nombre.
            (fullYearSearchContext
              ? ({ name, v24: 0, v25: 0, v26: 0 } as DimensionRow)
              : null)
        )
        .filter((r): r is DimensionRow => r != null);
    }
    return topNChart == null ? sorted : sorted.slice(0, topNChart);
  }, [isCustomMode, selectedItems, rows, sorted, topNChart, fullYearSearchContext]);

  // Tabla:
  //  - Si está en modo personalizado (con selección custom) → tabla muestra
  //    SOLO los items seleccionados (mismo orden que el chart, coherente).
  //  - Si modo default → topNTable como antes.
  const tableRows = useMemo(() => {
    if (isCustomMode) {
      return top;
    }
    return topNTable == null ? sorted : sorted.slice(0, topNTable);
  }, [isCustomMode, top, sorted, topNTable]);

  // ===== Orden por columna de la tabla "Año vs Año" (click en header). =====
  const [anioSortKey, setAnioSortKey] = useState<string | null>(null);
  const [anioSortDir, setAnioSortDir] = useState<"asc" | "desc">("desc");
  function toggleAnioSort(key: string) {
    if (anioSortKey === key) setAnioSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setAnioSortKey(key);
      setAnioSortDir("desc");
    }
  }
  useEffect(() => {
    setAnioSortKey(null);
    setAnioSortDir("desc");
  }, [dimension]);

  const sortedTableRows = useMemo(() => {
    if (!anioSortKey) return tableRows;
    const val = (r: (typeof tableRows)[number]): number => {
      const v24 = r.v24_alDia ?? r.v24;
      const v25 = r.v25_alDia ?? r.v25;
      const v26 = r.v26_alDia ?? r.v26;
      const k24 = r.k24_alDia ?? r.k24 ?? 0;
      const k25 = r.k25_alDia ?? r.k25 ?? 0;
      const k26 = r.k26_alDia ?? r.k26 ?? 0;
      const m26 = r.m26_alDia ?? r.m26 ?? 0;
      const m25 = r.m25_alDia ?? r.m25 ?? 0;
      switch (anioSortKey) {
        case "v24": return v24;
        case "v25": return v25;
        case "v26": return v26;
        case "varv": return v25 > 0 ? (v26 - v25) / v25 : 0;
        case "k24": return k24;
        case "k25": return k25;
        case "k26": return k26;
        case "varkg": return k25 > 0 ? (k26 - k25) / k25 : 0;
        case "mg26": return m26;
        case "mgpct26": return v26 > 0 ? m26 / v26 : 0;
        case "mgpct25": return v25 > 0 ? m25 / v25 : 0;
        case "dpp": return (v26 > 0 ? m26 / v26 : 0) - (v25 > 0 ? m25 / v25 : 0);
        default: return 0;
      }
    };
    return [...tableRows].sort((a, b) =>
      anioSortDir === "desc" ? val(b) - val(a) : val(a) - val(b)
    );
  }, [tableRows, anioSortKey, anioSortDir]);

  // Series de barras (cambian según modo Pesos/Kilos).
  // Las labels son los meses (Abr 24/25/26). El título "Venta" vs "Kilos"
  // lo decide barSeriesTitle del GroupedBarChart.
  const series: GroupedBarSeries[] = isKg
    ? [
        { key: "k24", label: monthLabel24, color: "#94a3b8" },
        { key: "k25", label: monthLabel25, color: "#3b82f6" },
        { key: "k26", label: monthLabel26, color: "#10b981" },
      ]
    : [
        { key: "v24", label: monthLabel24, color: "#94a3b8" },
        { key: "v25", label: monthLabel25, color: "#3b82f6" },
        { key: "v26", label: monthLabel26, color: "#10b981" },
      ];

  // Series de margen para tooltip + chart — NO dependen del modo del
  // toggle. Las líneas de margen % se mantienen fijas en el eje Y derecho,
  // que es el insight clave: leer la evolución del margen vs el volumen
  // (sea pesos o kilos).
  const marginAmountSeries: GroupedBarSeries[] = [
    { key: "m24", label: `Margen ${monthLabel24}`, color: "#94a3b8" },
    { key: "m25", label: `Margen ${monthLabel25}`, color: "#3b82f6" },
    { key: "m26", label: `Margen ${monthLabel26}`, color: "#10b981" },
  ];
  const marginPctSeries: GroupedBarSeries[] = [
    { key: "mp24", label: `Margen % ${monthLabel24}`, color: "#94a3b8" },
    { key: "mp25", label: `Margen % ${monthLabel25}`, color: "#3b82f6" },
    { key: "mp26", label: `Margen % ${monthLabel26}`, color: "#10b981" },
  ];

  // Mapeo de cierre → al-día según modo (para barras apiladas).
  const alDiaKeyByCierre: Record<string, string> = isKg
    ? {
        k24: "k24_alDia",
        k25: "k25_alDia",
        k26: "k26_alDia",
      }
    : {
        v24: "v24_alDia",
        v25: "v25_alDia",
        v26: "v26_alDia",
      };

  // ============ Export Excel ============
  // Lazy import (exceljs ~700KB se carga solo al click). WYSIWYG: respeta
  // el multi-select activo (tableRows ya viene filtrado).
  const handleExportExcel = exportTabName
    ? async () => {
        const { exportToExcel, sanitizeFileName, todayISO } = await import(
          "@/lib/export-excel"
        );

        const territorioLabel =
          exportTerritory && exportTerritory !== ""
            ? exportTerritory
            : "Todos";

        const totalCierre = tableRows.reduce(
          (acc, r) => ({
            v24: acc.v24 + r.v24,
            v25: acc.v25 + r.v25,
            v26: acc.v26 + r.v26,
            k24: acc.k24 + (r.k24 ?? 0),
            k25: acc.k25 + (r.k25 ?? 0),
            k26: acc.k26 + (r.k26 ?? 0),
            m24: acc.m24 + (r.m24 ?? 0),
            m25: acc.m25 + (r.m25 ?? 0),
            m26: acc.m26 + (r.m26 ?? 0),
            v24_alDia: acc.v24_alDia + (r.v24_alDia ?? r.v24),
            v25_alDia: acc.v25_alDia + (r.v25_alDia ?? r.v25),
            v26_alDia: acc.v26_alDia + (r.v26_alDia ?? r.v26),
            k24_alDia: acc.k24_alDia + (r.k24_alDia ?? r.k24 ?? 0),
            k25_alDia: acc.k25_alDia + (r.k25_alDia ?? r.k25 ?? 0),
            k26_alDia: acc.k26_alDia + (r.k26_alDia ?? r.k26 ?? 0),
            m24_alDia: acc.m24_alDia + (r.m24_alDia ?? r.m24 ?? 0),
            m25_alDia: acc.m25_alDia + (r.m25_alDia ?? r.m25 ?? 0),
            m26_alDia: acc.m26_alDia + (r.m26_alDia ?? r.m26 ?? 0),
          }),
          {
            v24: 0, v25: 0, v26: 0,
            k24: 0, k25: 0, k26: 0,
            m24: 0, m25: 0, m26: 0,
            v24_alDia: 0, v25_alDia: 0, v26_alDia: 0,
            k24_alDia: 0, k25_alDia: 0, k26_alDia: 0,
            m24_alDia: 0, m25_alDia: 0, m26_alDia: 0,
          }
        );

        const summary: ExcelSummaryRow[] = [
          ...(exportPeriodLabel
            ? [{ label: "Periodo", value: exportPeriodLabel }]
            : []),
          { label: "Territorio", value: territorioLabel },
          { label: "Dimensión", value: dimensionLabelPlural },
          {
            label: isCustomMode ? "Modo" : "Modo",
            value: isCustomMode
              ? `Selección custom (${tableRows.length} items)`
              : topNTable == null
                ? "Default (todos)"
                : `Default (Top ${topNTable})`,
          },
          {
            label: `# ${dimensionLabelPlural} exportados`,
            value: tableRows.length,
            numFmt: "#,##0",
          },
          {
            label: `Venta total ${monthLabel26}`,
            value: totalCierre.v26,
            numFmt: "$#,##0",
          },
          {
            label: `Venta total ${monthLabel25}`,
            value: totalCierre.v25,
            numFmt: "$#,##0",
          },
          {
            label: `Venta total ${monthLabel24}`,
            value: totalCierre.v24,
            numFmt: "$#,##0",
          },
        ];

        // Columnas: dim + venta cierre 24/25/26 + venta al-día 24/25/26 +
        // kg + margen + margen % + var %
        const columns: ExcelColumn[] = [
          { header: dimensionLabel, key: "name", width: 38 },
          // Pesos cierre
          { header: `Venta ${monthLabel24} cierre`, key: "v24", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel25} cierre`, key: "v25", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel26} cierre`, key: "v26", width: 16, numFmt: "$#,##0" },
          // Pesos al-día (comparativos día-vs-día)
          { header: `Venta ${monthLabel24} al-día`, key: "v24_alDia", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel25} al-día`, key: "v25_alDia", width: 16, numFmt: "$#,##0" },
          { header: `Venta ${monthLabel26} al-día`, key: "v26_alDia", width: 16, numFmt: "$#,##0" },
          // Var %
          { header: "Var Venta % (cierre 26 vs 25)", key: "varVentaPct", width: 18, numFmt: "0.0%" },
          // KG cierre
          { header: `KG ${monthLabel24} cierre`, key: "k24", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel25} cierre`, key: "k25", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel26} cierre`, key: "k26", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel24} al-día`, key: "k24_alDia", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel25} al-día`, key: "k25_alDia", width: 14, numFmt: "#,##0" },
          { header: `KG ${monthLabel26} al-día`, key: "k26_alDia", width: 14, numFmt: "#,##0" },
          { header: "Var KG %", key: "varKgPct", width: 14, numFmt: "0.0%" },
          // Margen
          { header: `Margen ${monthLabel24}`, key: "m24", width: 16, numFmt: "$#,##0" },
          { header: `Margen ${monthLabel25}`, key: "m25", width: 16, numFmt: "$#,##0" },
          { header: `Margen ${monthLabel26}`, key: "m26", width: 16, numFmt: "$#,##0" },
          { header: `Margen % ${monthLabel24}`, key: "mp24", width: 14, numFmt: "0.0%" },
          { header: `Margen % ${monthLabel25}`, key: "mp25", width: 14, numFmt: "0.0%" },
          { header: `Margen % ${monthLabel26}`, key: "mp26", width: 14, numFmt: "0.0%" },
        ];

        const xlsxRows = tableRows.map((r) => {
          const k24 = r.k24 ?? 0;
          const k25 = r.k25 ?? 0;
          const k26 = r.k26 ?? 0;
          const m24 = r.m24 ?? 0;
          const m25 = r.m25 ?? 0;
          const m26 = r.m26 ?? 0;
          return {
            name: r.name,
            v24: r.v24,
            v25: r.v25,
            v26: r.v26,
            v24_alDia: r.v24_alDia ?? r.v24,
            v25_alDia: r.v25_alDia ?? r.v25,
            v26_alDia: r.v26_alDia ?? r.v26,
            varVentaPct: r.v25 > 0 ? (r.v26 - r.v25) / r.v25 : 0,
            k24,
            k25,
            k26,
            k24_alDia: r.k24_alDia ?? k24,
            k25_alDia: r.k25_alDia ?? k25,
            k26_alDia: r.k26_alDia ?? k26,
            varKgPct: k25 > 0 ? (k26 - k25) / k25 : 0,
            m24,
            m25,
            m26,
            mp24: r.v24 > 0 ? m24 / r.v24 : 0,
            mp25: r.v25 > 0 ? m25 / r.v25 : 0,
            mp26: r.v26 > 0 ? m26 / r.v26 : 0,
          };
        });

        const totalRow: Record<string, unknown> = {
          name: `TOTAL (${tableRows.length} ${dimensionLabelPlural.toLowerCase()})`,
          v24: totalCierre.v24,
          v25: totalCierre.v25,
          v26: totalCierre.v26,
          v24_alDia: totalCierre.v24_alDia,
          v25_alDia: totalCierre.v25_alDia,
          v26_alDia: totalCierre.v26_alDia,
          varVentaPct:
            totalCierre.v25 > 0
              ? (totalCierre.v26 - totalCierre.v25) / totalCierre.v25
              : 0,
          k24: totalCierre.k24,
          k25: totalCierre.k25,
          k26: totalCierre.k26,
          k24_alDia: totalCierre.k24_alDia,
          k25_alDia: totalCierre.k25_alDia,
          k26_alDia: totalCierre.k26_alDia,
          varKgPct:
            totalCierre.k25 > 0
              ? (totalCierre.k26 - totalCierre.k25) / totalCierre.k25
              : 0,
          m24: totalCierre.m24,
          m25: totalCierre.m25,
          m26: totalCierre.m26,
          mp24: totalCierre.v24 > 0 ? totalCierre.m24 / totalCierre.v24 : 0,
          mp25: totalCierre.v25 > 0 ? totalCierre.m25 / totalCierre.v25 : 0,
          mp26: totalCierre.v26 > 0 ? totalCierre.m26 / totalCierre.v26 : 0,
        };

        const territoriosForFile =
          territorioLabel.length > 30 ? "varios" : territorioLabel;
        const fileName = `${sanitizeFileName(exportTabName)}_${sanitizeFileName(territoriosForFile)}_${todayISO()}`;

        await exportToExcel({
          fileName,
          sheetName: exportTabName.slice(0, 31),
          title: `Tab ${exportTabName} · ${monthLabel26}`,
          subtitle: `${territorioLabel}${
            exportPeriodLabel ? ` · ${exportPeriodLabel}` : ""
          } · ${tableRows.length} ${dimensionLabelPlural.toLowerCase()}`,
          summary,
          columns,
          rows: xlsxRows,
          totalRow,
        });
      }
    : null;

  // Cliente efectivo para la vista Evolución en modo Productos: el elegido en
  // el dropdown si sigue en la lista completa; si no, el #1 por default.
  // Usa `sorted` (TODOS los clientes que compran el SKU, mayor a menor), no
  // solo el top del chart.
  const effectiveEvolutionClient =
    evolutionClient && sorted.some((r) => r.name === evolutionClient)
      ? evolutionClient
      : (sorted[0]?.name ?? null);

  // Venta/kg al-día del mes actual por cliente (para la vista "vs Prom. 90d").
  const currentByClient = useMemo(() => {
    const map: Record<string, { venta: number; kg: number }> = {};
    for (const r of tableRows) {
      map[r.name] = {
        venta: r.v26_alDia ?? r.v26,
        kg: r.k26_alDia ?? r.k26 ?? 0,
      };
    }
    return map;
  }, [tableRows]);

  return (
    <div className="space-y-4">
      {/* Toolbar superior: toggle Pesos/Kilos (si aplica y NO es controlado por
          el contenedor) + botones de exportación. */}
      {((modeStorageKey && !controlledMode) ||
        (canExportExcel && (handleExportExcel || reportInput !== undefined))) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {modeStorageKey && !controlledMode && (
            <ModeToggle mode={effectiveMode} onChange={switchMode} />
          )}
          {canExportExcel && handleExportExcel && (
            <ExportExcelButton
              onExport={handleExportExcel}
              disabled={tableRows.length === 0}
              canExport={canExportExcel}
              title={
                tableRows.length === 0
                  ? "Sin filas para exportar"
                  : `Exportar ${tableRows.length} fila${tableRows.length === 1 ? "" : "s"} a Excel`
              }
            />
          )}
          {canExportExcel && (
            <ReportButton reportInput={reportInput} canExport={canExportExcel} />
          )}
        </div>
      )}

      {/* Chart top N — gateado por showChart (contenedor unificado) */}
      {showChart && (
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {top.length === 0 && !enableMultiSelect ? (
          <p
            className="py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin data del mes actual.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {productMode
                    ? selectedProducts.length === 0
                      ? `Clientes por producto · ${monthLabel26}`
                      : `Top ${top.length} Clientes que compran ${selectedProducts.length} producto${selectedProducts.length === 1 ? "" : "s"} · ${monthLabel26}`
                    : isCustomMode
                      ? `${top.length} ${dimensionLabelPlural} seleccionado${top.length === 1 ? "" : "s"} · ${monthLabel26}`
                      : topNChart == null
                        ? `${dimensionLabelPlural} · ${monthLabel26}`
                        : `Top ${top.length} ${dimensionLabelPlural} · ${monthLabel26}`}
                </h3>
                {isCustomMode && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Modo personalizado · selección custom override Top default
                  </span>
                )}
                {productMode && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Clientes rankeados por su compra de los productos seleccionados
                  </span>
                )}
                {/* Toggle vista: Mismo mes (3 años) / Evolución {año} (Mejora 2).
                    En modo Productos solo aplica si hay productos seleccionados
                    (la evolución muestra 1 cliente comprando esos SKUs). */}
                {enableEvolution &&
                  evolutionContext &&
                  (!productMode || selectedProducts.length > 0) && (
                  <div
                    className="mt-1.5 inline-flex w-fit items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
                    style={{
                      background: "var(--bg-surface-muted)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => switchChartView("mismo-mes")}
                      className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        background:
                          chartView === "mismo-mes"
                            ? "var(--bg-surface)"
                            : "transparent",
                        color:
                          chartView === "mismo-mes"
                            ? "var(--accent)"
                            : "var(--text-muted)",
                        boxShadow:
                          chartView === "mismo-mes"
                            ? "0 1px 2px rgba(0,0,0,0.05)"
                            : "none",
                      }}
                    >
                      Meses (3 años)
                    </button>
                    <button
                      type="button"
                      onClick={() => switchChartView("evolucion")}
                      className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        background:
                          chartView === "evolucion"
                            ? "var(--bg-surface)"
                            : "transparent",
                        color:
                          chartView === "evolucion"
                            ? "var(--accent)"
                            : "var(--text-muted)",
                        boxShadow:
                          chartView === "evolucion"
                            ? "0 1px 2px rgba(0,0,0,0.05)"
                            : "none",
                      }}
                    >
                      Evolución {evolutionContext.year}
                    </button>
                  </div>
                )}
              </div>
              {enableMultiSelect && (
                <div className="flex flex-col items-end gap-1.5">
                  {/* Toggle de modo: Clientes / Productos (Mejora 3) */}
                  {enableProductSearch && (
                    <div
                      className="inline-flex w-fit items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
                      style={{
                        background: "var(--bg-surface-muted)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSearchMode("clientes")}
                        className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                        style={{
                          background:
                            searchMode === "clientes"
                              ? "var(--bg-surface)"
                              : "transparent",
                          color:
                            searchMode === "clientes"
                              ? "var(--accent)"
                              : "var(--text-muted)",
                          boxShadow:
                            searchMode === "clientes"
                              ? "0 1px 2px rgba(0,0,0,0.05)"
                              : "none",
                        }}
                      >
                        Clientes
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchMode("productos")}
                        className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                        style={{
                          background:
                            searchMode === "productos"
                              ? "var(--bg-surface)"
                              : "transparent",
                          color:
                            searchMode === "productos"
                              ? "var(--accent)"
                              : "var(--text-muted)",
                          boxShadow:
                            searchMode === "productos"
                              ? "0 1px 2px rgba(0,0,0,0.05)"
                              : "none",
                        }}
                      >
                        Productos
                      </button>
                    </div>
                  )}
                  <MultiSelectChips
                    options={availableItems}
                    selected={activeSelected}
                    onChange={activeUpdate}
                    maxItems={multiSelectMaxItems}
                    placeholder={
                      productMode ? "Buscar producto (SKU)…" : multiSelectPlaceholder
                    }
                    emptyLabel={productMode ? "Sin selección" : "Top default"}
                  />
                </div>
              )}
            </div>
            {productMode && loadingProducts ? (
              <div className="flex h-[520px] items-center justify-center">
                <Loader2
                  className="animate-spin"
                  size={28}
                  style={{ color: "var(--accent)" }}
                />
              </div>
            ) : productMode && selectedProducts.length === 0 ? (
              <p
                className="py-12 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Selecciona uno o más productos (SKU) en el buscador para ver los
                clientes que más los compran.
              </p>
            ) : top.length === 0 ? (
              <p
                className="py-12 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {productMode
                  ? "Ningún cliente compró los productos seleccionados en este periodo."
                  : isCustomMode
                    ? "Sin data para los items seleccionados en este mes."
                    : "Sin data del mes actual."}
              </p>
            ) : enableEvolution &&
              evolutionContext &&
              chartView === "evolucion" ? (
              productMode ? (
                /* Modo Productos: evolución de 1 cliente comprando los SKUs. */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Cliente:
                    </span>
                    <select
                      value={effectiveEvolutionClient ?? ""}
                      onChange={(e) => setEvolutionClient(e.target.value)}
                      className="max-w-md rounded-[var(--radius)] border px-2 py-1 text-sm"
                      style={{
                        background: "var(--bg-surface)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {/* TODOS los clientes que compran el SKU en el/los
                          territorio(s), ordenados de mayor a menor compra. */}
                      {sorted.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name} · {(isKg ? formatKilos : formatMoney)(isKg ? r.k26 ?? 0 : r.v26)}
                        </option>
                      ))}
                    </select>
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {sorted.length} cliente{sorted.length === 1 ? "" : "s"} ·
                      comprando {selectedProducts.length} producto
                      {selectedProducts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {effectiveEvolutionClient && (
                    <ClientesEvolutionChart
                      year={evolutionContext.year}
                      month={evolutionContext.month}
                      territorios={evolutionContext.territorios}
                      clientes={[effectiveEvolutionClient]}
                      skus={selectedProducts}
                      mode={effectiveMode}
                    />
                  )}
                </div>
              ) : (
                /* Modo agregado: evolución de las entidades visibles
                   (clientes o SKUs según la dimensión). */
                <ClientesEvolutionChart
                  year={evolutionContext.year}
                  month={evolutionContext.month}
                  territorios={evolutionContext.territorios}
                  clientes={top.map((r) => r.name)}
                  mode={effectiveMode}
                  dim={dimension}
                />
              )
            ) : enableEvolution &&
              evolutionContext &&
              chartView === "mismo-mes" ? (
              /* NUEVO: 12 meses × 3 años (agregado), solo tab Clientes/Productos */
              <ClientesTresAniosChart
                year={evolutionContext.year}
                month={evolutionContext.month}
                territorios={evolutionContext.territorios}
                clientes={top.map((r) => r.name)}
                mode={effectiveMode}
                dim={dimension}
              />
            ) : (
              <GroupedBarChart
                data={top.map((r) => {
                  const m24 = r.m24 ?? 0;
                  const m25 = r.m25 ?? 0;
                  const m26 = r.m26 ?? 0;
                  // Acumulados al día N (Mejora 2). Si por alguna razón
                  // al-día > cierre (no debería), nos quedamos con cierre.
                  const v24AlDia = Math.min(r.v24, r.v24_alDia ?? r.v24);
                  const v25AlDia = Math.min(r.v25, r.v25_alDia ?? r.v25);
                  const v26AlDia = Math.min(r.v26, r.v26_alDia ?? r.v26);
                  const k24Raw = r.k24 ?? 0;
                  const k25Raw = r.k25 ?? 0;
                  const k26Raw = r.k26 ?? 0;
                  const k24AlDia = Math.min(k24Raw, r.k24_alDia ?? k24Raw);
                  const k25AlDia = Math.min(k25Raw, r.k25_alDia ?? k25Raw);
                  const k26AlDia = Math.min(k26Raw, r.k26_alDia ?? k26Raw);
                  return {
                    name: r.name,
                    // ===== Pesos (cierre + al-día + resto) =====
                    v24: r.v24,
                    v25: r.v25,
                    v26: r.v26,
                    v24_alDia: v24AlDia,
                    v25_alDia: v25AlDia,
                    v26_alDia: v26AlDia,
                    __rest_v24: Math.max(0, r.v24 - v24AlDia),
                    __rest_v25: Math.max(0, r.v25 - v25AlDia),
                    __rest_v26: Math.max(0, r.v26 - v26AlDia),
                    // ===== Kilos (cierre + al-día + resto) =====
                    k24: k24Raw,
                    k25: k25Raw,
                    k26: k26Raw,
                    k24_alDia: k24AlDia,
                    k25_alDia: k25AlDia,
                    k26_alDia: k26AlDia,
                    __rest_k24: Math.max(0, k24Raw - k24AlDia),
                    __rest_k25: Math.max(0, k25Raw - k25AlDia),
                    __rest_k26: Math.max(0, k26Raw - k26AlDia),
                    // ===== Margen $ y margen % (líneas + tooltip) =====
                    m24,
                    m25,
                    m26,
                    mp24: r.v24 > 0 ? (m24 / r.v24) * 100 : 0,
                    mp25: r.v25 > 0 ? (m25 / r.v25) * 100 : 0,
                    mp26: r.v26 > 0 ? (m26 / r.v26) * 100 : 0,
                  };
                })}
                series={series}
                marginAmountSeries={marginAmountSeries}
                marginPctSeries={marginPctSeries}
                alDiaKeyByCierre={alDiaKeyByCierre}
                barSeriesTitle={isKg ? "Kilos" : "Venta"}
                yFormatter={isKg ? formatKilos : formatMoney}
                height={520}
                xAngle={-30}
                xLabelHeight={130}
              />
            )}
          </>
        )}
      </div>
      )}

      {/* Tabla — gateada por showTable (contenedor unificado) */}
      {showTable && tableRows.length > 0 && (
        <div className="space-y-2">
          {/* Header de la tabla: toggle de vistas (Mejora 4) a la izquierda +
              buscador propio a la derecha cuando la tabla es standalone
              (showChart=false). En modo monolítico el buscador vive en la
              gráfica y ya filtra ambas secciones, por eso no se duplica. */}
          {((enableTableViews && tableViewsContext) ||
            (enableMultiSelect && !showChart)) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {enableTableViews && tableViewsContext ? (
                <div
                  className="inline-flex w-fit items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
                  style={{
                    background: "var(--bg-surface-muted)",
                    borderColor: "var(--border)",
                  }}
                >
                  {(
                    [
                      ["anio", "Año vs Año"],
                      ["meses", `Meses ${tableViewsContext.year}`],
                      ["meses-hist", "Meses Hist."],
                      ["prom90", "vs Prom. 90d"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => switchTableView(key)}
                      className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                      style={{
                        background:
                          tableView === key
                            ? "var(--bg-surface)"
                            : "transparent",
                        color:
                          tableView === key
                            ? "var(--accent)"
                            : "var(--text-muted)",
                        boxShadow:
                          tableView === key
                            ? "0 1px 2px rgba(0,0,0,0.05)"
                            : "none",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <div />
              )}
              {/* Buscador propio de la tabla (solo cuando es standalone). Usa el
                  mismo estado de selección que ya filtra tableRows
                  (isCustomMode): seleccionar fija esas filas en la tabla. */}
              {enableMultiSelect && !showChart && (
                <MultiSelectChips
                  options={availableItems}
                  selected={selectedItems}
                  onChange={updateSelected}
                  maxItems={multiSelectMaxItems}
                  placeholder={multiSelectPlaceholder}
                  emptyLabel="Top default"
                />
              )}
            </div>
          )}

          {/* Vista Meses Hist. (matriz Años×Meses, Mejora 3) */}
          {enableTableViews &&
          tableViewsContext &&
          tableView === "meses-hist" ? (
            <div
              className="rounded-[var(--radius-lg)] border"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <MesesHistTable
                clientes={tableRows.map((r) => r.name)}
                context={tableViewsContext}
                mode={effectiveMode}
                dimensionLabel={dimensionLabel}
                dim={dimension}
                agrupadorId={fullYearSearchContext?.agrupadorId ?? null}
              />
            </div>
          ) : /* Vistas alternativas (Meses / Prom 90d) */
          enableTableViews &&
          tableViewsContext &&
          tableView !== "anio" ? (
            <div
              className="rounded-[var(--radius-lg)] border"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <ClientesTableViews
                view={tableView as "meses" | "prom90"}
                clientes={tableRows.map((r) => r.name)}
                context={{ ...tableViewsContext, currentByClient }}
                mode={effectiveMode}
                dimensionLabel={dimensionLabel}
                dim={dimension}
              />
            </div>
          ) : (
        <div
          className="rounded-[var(--radius-lg)] border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Leyenda explícita: la tabla muestra acumulado AL MISMO DÍA
              (consistente con el chart). Antes mostraba cierre completo,
              causando incongruencia con tooltips del chart. */}
          <div
            className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface-muted)",
              color: "var(--text-muted)",
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              ⓘ Valores al mismo día laboral
            </span>
            <span className="ml-2">
              (comparativos día-vs-día equitativos entre años)
            </span>
          </div>
          {/* Paneles congelados (V4.3): la tabla tiene su propio scroll
              (alto máx 70vh) para que el encabezado (top) y la primera columna
              (left) queden fijos en ambos ejes, como en Excel. */}
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr style={{ background: "var(--bg-surface-muted)" }}>
                  <Th sticky="corner">{dimensionLabel}</Th>
                  {/* Pesos — al-día */}
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("v24")} active={anioSortKey === "v24"} dir={anioSortDir}>{monthLabel24}</Th>
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("v25")} active={anioSortKey === "v25"} dir={anioSortDir}>{monthLabel25}</Th>
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("v26")} active={anioSortKey === "v26"} dir={anioSortDir}>{monthLabel26}</Th>
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("varv")} active={anioSortKey === "varv"} dir={anioSortDir}>Var %</Th>
                  {/* KG (opcional) — al-día */}
                  {showKg && (
                    <>
                      <Th sticky="top" align="right"subtle onClick={() => toggleAnioSort("k24")} active={anioSortKey === "k24"} dir={anioSortDir}>{`KG ${monthLabel24}`}</Th>
                      <Th sticky="top" align="right"subtle onClick={() => toggleAnioSort("k25")} active={anioSortKey === "k25"} dir={anioSortDir}>{`KG ${monthLabel25}`}</Th>
                      <Th sticky="top" align="right"subtle onClick={() => toggleAnioSort("k26")} active={anioSortKey === "k26"} dir={anioSortDir}>{`KG ${monthLabel26}`}</Th>
                      <Th sticky="top" align="right"subtle onClick={() => toggleAnioSort("varkg")} active={anioSortKey === "varkg"} dir={anioSortDir}>Var % KG</Th>
                    </>
                  )}
                  {/* Margen del mes actual (siempre visible, no depende del
                      toggle ni de showKg). 4 columnas: Mg $ / Mg % / Mg % prev
                      / Δ pp para leer evolución del margen vs año anterior. */}
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("mg26")} active={anioSortKey === "mg26"} dir={anioSortDir}>{`Mg $ ${monthLabel26}`}</Th>
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("mgpct26")} active={anioSortKey === "mgpct26"} dir={anioSortDir}>{`Mg % ${monthLabel26}`}</Th>
                  <Th sticky="top" align="right"subtle onClick={() => toggleAnioSort("mgpct25")} active={anioSortKey === "mgpct25"} dir={anioSortDir}>{`Mg % ${monthLabel25}`}</Th>
                  <Th sticky="top" align="right"onClick={() => toggleAnioSort("dpp")} active={anioSortKey === "dpp"} dir={anioSortDir}>Δ pp</Th>
                </tr>
              </thead>
              <tbody>
                {sortedTableRows.map((r, i) => {
                  // === Mostrar SIEMPRE al-día (coherente con tooltip del chart) ===
                  // Si al-día no existe (data vieja sin Mejora 2), fallback a cierre.
                  const v24Show = r.v24_alDia ?? r.v24;
                  const v25Show = r.v25_alDia ?? r.v25;
                  const v26Show = r.v26_alDia ?? r.v26;
                  const k24Show = r.k24_alDia ?? r.k24 ?? 0;
                  const k25Show = r.k25_alDia ?? r.k25 ?? 0;
                  const k26Show = r.k26_alDia ?? r.k26 ?? 0;
                  const m26Show = r.m26_alDia ?? r.m26 ?? 0;
                  const m25Show = r.m25_alDia ?? r.m25 ?? 0;
                  const varPct =
                    v25Show > 0 ? ((v26Show - v25Show) / v25Show) * 100 : null;
                  const varKgPct =
                    k25Show > 0 ? ((k26Show - k25Show) / k25Show) * 100 : null;
                  // Margen % al-día por año (con base la venta al-día del año)
                  const mgPct26 =
                    v26Show > 0 ? (m26Show / v26Show) * 100 : null;
                  const mgPct25 =
                    v25Show > 0 ? (m25Show / v25Show) * 100 : null;
                  const deltaPp =
                    mgPct26 != null && mgPct25 != null
                      ? mgPct26 - mgPct25
                      : null;
                  const isExpanded =
                    enableRowExpand && expandedClients.has(r.name);
                  return (
                    <Fragment key={r.name + i}>
                    <tr
                      style={{
                        background:
                          i % 2 === 0
                            ? "var(--bg-surface)"
                            : "var(--bg-surface-muted)",
                      }}
                    >
                      <Td
                        sticky
                        bg={i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-muted)"}
                      >
                        {enableRowExpand && rowExpandContext ? (
                          <button
                            type="button"
                            onClick={() => toggleClientExpand(r.name)}
                            className="flex items-center gap-1.5 text-left"
                            style={{ color: "var(--text-primary)" }}
                            title={
                              dimension === "sku"
                                ? "Ver clientes que compran este SKU"
                                : "Ver desglose por línea de producto"
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown
                                size={14}
                                style={{ color: "var(--text-secondary)" }}
                              />
                            ) : (
                              <ChevronRight
                                size={14}
                                style={{ color: "var(--text-secondary)" }}
                              />
                            )}
                            {r.name}
                          </button>
                        ) : (
                          r.name
                        )}
                      </Td>
                      <Td align="right">{formatMoney(v24Show)}</Td>
                      <Td align="right">{formatMoney(v25Show)}</Td>
                      <Td align="right">{formatMoney(v26Show)}</Td>
                      <Td
                        align="right"
                        bold
                        color={
                          varPct == null
                            ? "var(--text-muted)"
                            : varPct >= 0
                              ? "var(--success)"
                              : "var(--danger)"
                        }
                      >
                        {varPct == null
                          ? "—"
                          : `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                      </Td>
                      {showKg && (
                        <>
                          <Td align="right" subtle>{formatKilos(k24Show)}</Td>
                          <Td align="right" subtle>{formatKilos(k25Show)}</Td>
                          <Td align="right" subtle>{formatKilos(k26Show)}</Td>
                          <Td
                            align="right"
                            bold
                            color={
                              varKgPct == null
                                ? "var(--text-muted)"
                                : varKgPct >= 0
                                  ? "var(--success)"
                                  : "var(--danger)"
                            }
                          >
                            {varKgPct == null
                              ? "—"
                              : `${varKgPct >= 0 ? "+" : ""}${varKgPct.toFixed(1)}%`}
                          </Td>
                        </>
                      )}
                      {/* Margen del mes actual + comparativo % vs año ant. */}
                      <Td align="right">{formatMoney(m26Show)}</Td>
                      <Td align="right" bold>
                        {mgPct26 == null ? "—" : `${mgPct26.toFixed(1)}%`}
                      </Td>
                      <Td align="right" subtle>
                        {mgPct25 == null ? "—" : `${mgPct25.toFixed(1)}%`}
                      </Td>
                      <Td
                        align="right"
                        bold
                        color={
                          deltaPp == null
                            ? "var(--text-muted)"
                            : deltaPp >= 0
                              ? "var(--success)"
                              : "var(--danger)"
                        }
                      >
                        {deltaPp == null
                          ? "—"
                          : `${deltaPp >= 0 ? "+" : ""}${deltaPp.toFixed(1)} pp`}
                      </Td>
                    </tr>
                    {isExpanded &&
                      rowExpandContext &&
                      (dimension === "sku" ? (
                        <ProductoDesglose
                          sku={r.name}
                          context={rowExpandContext}
                          colSpan={9 + (showKg ? 4 : 0)}
                          monthLabel24={monthLabel24}
                          monthLabel25={monthLabel25}
                          monthLabel26={monthLabel26}
                          showKg={showKg}
                        />
                      ) : (
                        <ClienteDesglose
                          cliente={r.name}
                          context={rowExpandContext}
                          colSpan={9 + (showKg ? 4 : 0)}
                          monthLabel24={monthLabel24}
                          monthLabel25={monthLabel25}
                          monthLabel26={monthLabel26}
                          showKg={showKg}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {topNTable != null && sorted.length > tableRows.length && (
            <div
              className="border-t px-3 py-2 text-center text-[11px]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Mostrando top {tableRows.length} de {sorted.length}{" "}
              {dimensionLabelPlural.toLowerCase()}
            </div>
          )}
        </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Toggle Pesos / Kilos — mismo look que Ventas/Productos/TrackingDiario
// ============================================================
function ModeToggle({
  mode,
  onChange,
}: {
  mode: DimensionViewMode;
  onChange: (next: DimensionViewMode) => void;
}) {
  const baseBtn =
    "flex items-center justify-center px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors";
  return (
    <div
      role="tablist"
      aria-label="Modo de vista"
      className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "pesos"}
        onClick={() => onChange("pesos")}
        className={`${baseBtn} rounded-[var(--radius-sm)]`}
        style={{
          background: mode === "pesos" ? "var(--bg-surface)" : "transparent",
          color:
            mode === "pesos" ? "var(--accent)" : "var(--text-secondary)",
          boxShadow: mode === "pesos" ? "var(--shadow-card)" : "none",
        }}
      >
        Pesos
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "kg"}
        onClick={() => onChange("kg")}
        className={`${baseBtn} rounded-[var(--radius-sm)]`}
        style={{
          background: mode === "kg" ? "var(--bg-surface)" : "transparent",
          color: mode === "kg" ? "var(--accent)" : "var(--text-secondary)",
          boxShadow: mode === "kg" ? "var(--shadow-card)" : "none",
        }}
      >
        Kilos
      </button>
    </div>
  );
}

function Th({
  children,
  align = "left",
  subtle = false,
  onClick,
  active = false,
  dir,
  sticky,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  /** Si true, color más tenue + borde izquierdo sutil para separar grupo de columnas. */
  subtle?: boolean;
  /** Si se pasa, el header es clickeable para ordenar. */
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  /** Paneles congelados: "top" = encabezado fijo al bajar; "corner" = además
   *  fijo a la izquierda (celda esquina, primera columna). Requiere que la
   *  tabla viva en un contenedor con overflow-auto. */
  sticky?: "top" | "corner";
}) {
  const stickyCls =
    sticky === "corner"
      ? "sticky top-0 left-0 z-30"
      : sticky === "top"
        ? "sticky top-0 z-20"
        : "";
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align} ${stickyCls}`}
      style={{
        borderColor: "var(--border)",
        color: active
          ? "var(--accent)"
          : subtle
            ? "var(--text-muted)"
            : "var(--text-secondary)",
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        // Fondo opaco: una celda sticky se despega de su fila y dejaría ver
        // el contenido que pasa por debajo.
        background: sticky ? "var(--bg-surface-muted)" : undefined,
        boxShadow: sticky === "corner" ? "1px 0 0 var(--border)" : undefined,
      }}
      onClick={onClick}
    >
      <span
        className="inline-flex items-center gap-1"
        style={{ justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start" }}
      >
        {children}
        {active && <span style={{ fontSize: "9px" }}>{dir === "desc" ? "▼" : "▲"}</span>}
      </span>
    </th>
  );
}

function Td({
  children,
  align = "left",
  color,
  bold = false,
  subtle = false,
  sticky = false,
  bg,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  color?: string;
  bold?: boolean;
  /** Si true, color más tenue + borde izquierdo sutil. */
  subtle?: boolean;
  /** Paneles congelados: primera columna fija a la izquierda al desplazarse. */
  sticky?: boolean;
  /** Fondo opaco de la celda sticky — debe coincidir con el de su fila. */
  bg?: string;
}) {
  return (
    <td
      className={`px-3 py-2 text-${align} ${sticky ? "sticky left-0 z-10" : ""}`}
      style={{
        color: color ?? (subtle ? "var(--text-secondary)" : "var(--text-primary)"),
        fontWeight: bold ? 600 : 400,
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
        background: sticky ? (bg ?? "var(--bg-surface)") : undefined,
        boxShadow: sticky ? "1px 0 0 var(--border)" : undefined,
      }}
    >
      {children}
    </td>
  );
}
