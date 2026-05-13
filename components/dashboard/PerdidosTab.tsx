"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  TrendingDown,
  AlertTriangle,
  Search,
  X,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatMoney, formatKilos } from "@/lib/format";
import { ExportExcelButton } from "@/components/dashboard/ExportExcelButton";
import { ReportButton } from "@/components/dashboard/ReportButton";
import type { BuildReportInput } from "@/lib/report-pdf/data";
import type {
  ExcelColumn,
  ExcelSummaryRow,
} from "@/lib/export-excel";

export type PerdidoStatus =
  | "perdido"
  | "declive"
  | "nuevo"
  | "recuperado"
  | "estable";
export type PerdidoDim = "mes" | "ytd";
export type PerdidoMetric = "pesos" | "kilos";

const PERDIDOS_METRIC_KEY = "perdidos-metric-mode";
const PERDIDOS_STATUS_FILTER_KEY = "perdidos-status-filter";

const STATUS_CONFIG: Record<
  PerdidoStatus,
  { label: string; bg: string; color: string; bgInactive: string; emoji: string }
> = {
  perdido: {
    label: "Perdido",
    bg: "var(--danger-soft)",
    color: "var(--danger)",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🔴",
  },
  declive: {
    label: "Declive",
    bg: "var(--warning-soft)",
    color: "var(--warning)",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🟠",
  },
  estable: {
    label: "Estable",
    bg: "var(--success-soft)",
    color: "var(--success)",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🟢",
  },
  nuevo: {
    label: "Nuevo",
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🔵",
  },
  recuperado: {
    label: "Recuperado",
    bg: "rgba(139, 92, 246, 0.15)",
    color: "#8b5cf6", // violeta
    bgInactive: "var(--bg-surface-muted)",
    emoji: "🟣",
  },
};

// Default chips activos: focus en accionables (Perdido + Declive + Recuperado).
// Nuevo y Estable se pueden activar manualmente si interesa.
const DEFAULT_STATUS_FILTER: PerdidoStatus[] = [
  "perdido",
  "declive",
  "recuperado",
];

export interface PerdidoRow {
  no_cliente: string;
  cliente: string;
  vendedor: string;
  // ===== 2024 (informativo) — cierre completo y al-día =====
  mes_venta_2024?: number;
  mes_kg_2024?: number;
  mes_margen_2024?: number;
  ytd_venta_2024?: number;
  ytd_kg_2024?: number;
  ytd_margen_2024?: number;
  mes_venta_alDia_2024?: number;
  mes_kg_alDia_2024?: number;
  mes_margen_alDia_2024?: number;
  // ===== 2025 (referencia base para status) =====
  // Mes cierre completo
  mes_venta_2025: number;
  mes_kg_2025: number;
  mes_margen_2025?: number;
  // YTD cierre completo (Ene-mes_actual 2025)
  ytd_venta_2025: number;
  ytd_kg_2025: number;
  ytd_margen_2025?: number;
  // Al MISMO DÍA LABORAL del 2026 (acumulado del mes 2025 hasta el día
  // calendario equivalente). Permite comparativos día-vs-día equitativos.
  mes_venta_alDia_2025?: number;
  mes_kg_alDia_2025?: number;
  mes_margen_alDia_2025?: number;
  // ===== 2026 (mes actual / YTD parcial) =====
  mes_venta_2026: number;
  mes_kg_2026: number;
  mes_margen_2026?: number;
  ytd_venta_2026: number;
  ytd_kg_2026: number;
  ytd_margen_2026?: number;
  mes_venta_alDia_2026?: number;
  mes_kg_alDia_2026?: number;
  mes_margen_alDia_2026?: number;
  /** Fecha ISO YYYY-MM-DD de la primera compra histórica del cliente
   *  (across todas las empresas y territorios). Si null, el cliente
   *  no aparece en kpi_cliente_lifecycle (raro). */
  first_purchase_date?: string | null;
}

interface Props {
  rows: PerdidoRow[];
  monthShortYY: string; // "May 26"
  prevMonthShortYY: string; // "May 25"
  topNTable?: number; // default 100
  /** Etiqueta del territorio actual (proviene del sidebar global ya
   *  agregado). Usado en el resumen del Excel y en la etiqueta de
   *  cada cliente cuando hay multi-territorio. */
  currentTerritory?: string;
  /** Permiso para descargar Excel (default false). */
  canExportExcel?: boolean;
  /** Fecha ISO "hoy - 90 días" (CDMX). Cliente es "Nuevo" si su
   *  first_purchase_date >= esta fecha. */
  newCustomerCutoffDate?: string;
  /** Input para el reporte PDF "Avance Comercial". */
  reportInput?: BuildReportInput | null;
}

interface Computed {
  cliente: string;
  vendedor: string;
  no_cliente: string;
  status: PerdidoStatus;
  v24: number; // 2024 al-día/ytd según dim — solo informativo
  k24: number;
  v25: number;
  v26: number;
  k25: number;
  k26: number;
  m25: number; // margen 2025 al-día (referencia)
  m26: number; // margen 2026 al-día (actual)
  declinePct: number;
}

function computeStatus(
  v25: number,
  v26: number,
  opts: {
    /** Primera fecha de compra del cliente (cualquier territorio/empresa) */
    firstPurchaseDate?: string | null;
    /** Cutoff ISO YYYY-MM-DD: clientes con first_purchase_date >= cutoff
     *  son considerados "Nuevo" (90 días desde hoy CDMX). */
    cutoffDate?: string;
  }
): {
  status: PerdidoStatus | null;
  declinePct: number;
} {
  // === REGLA 1 (precedencia): cliente con primera compra ≤ 90 días → NUEVO ===
  // Cubre el caso "compró por primera vez con nosotros recientemente",
  // independiente de su comportamiento v25/v26.
  const isReallyNew = !!(
    opts.firstPurchaseDate &&
    opts.cutoffDate &&
    opts.firstPurchaseDate >= opts.cutoffDate
  );
  if (isReallyNew) {
    return { status: "nuevo", declinePct: 0 };
  }

  // === REGLA 2: Perdido — tenía venta en 2025 pero CERO en 2026 ===
  if (v25 > 0 && v26 === 0) return { status: "perdido", declinePct: 100 };

  // === REGLA 3: Declive — tenía venta en 2025 y BAJÓ en 2026 ===
  if (v25 > 0 && v26 < v25) {
    return { status: "declive", declinePct: ((v25 - v26) / v25) * 100 };
  }

  // === REGLA 4: Recuperado — cliente con historial (NO nuevo) que
  //     no tenía venta en 2025 al-día pero AHORA sí en 2026.
  //     Antes esto se etiquetaba "Nuevo"; ahora reconocemos que es
  //     un recovery (cliente que regresa, más valioso). ===
  if (v25 === 0 && v26 > 0 && !isReallyNew) {
    return { status: "recuperado", declinePct: 0 };
  }

  // === REGLA 5: Estable o creciendo — v26 >= v25 ===
  if (v26 >= v25 && (v25 > 0 || v26 > 0)) {
    return { status: "estable", declinePct: 0 };
  }

  // Sin venta en ambos años → no incluir
  return { status: null, declinePct: 0 };
}

/**
 * Tab Perdidos con toggle "Mes Actual" / "YTD":
 *  - Toggle decide qué dimensión analizar (mes corriente o year-to-date).
 *  - 3 stats cards basadas en dimensión activa.
 *  - Tabla con columnas: Cliente · Vendedor · Status · $ 25 · $ 26 · Var $ %
 *    · Kg 25 · Kg 26 · Var Kg %.
 *  - Status (perdido/declive) computado server-side basado en venta $:
 *      perdido = v25 > 0 AND v26 = 0
 *      declive = v26 < v25 (strict, excluye perdidos)
 */
export function PerdidosTab({
  rows: rowsProp,
  monthShortYY,
  prevMonthShortYY,
  topNTable = 100,
  currentTerritory = "",
  canExportExcel = false,
  newCustomerCutoffDate,
  reportInput = null,
}: Props) {
  // Mejora 7: multi-select de territorios ahora vive en el sidebar global.
  // Aquí solo recibimos los rows ya agregados (DashboardClient hace la
  // agregación con `aggregatePerdidoRows`). Esto simplifica mucho el tab
  // y elimina la duplicación de UI.
  const rows: PerdidoRow[] = rowsProp;

  const [dim, setDim] = useState<PerdidoDim>("mes");
  // Buscador: filtra por substring en cliente y/o vendedor (case-insensitive).
  // Vacío = comportamiento default (Top 100 perdidos+declive).
  // Con texto = muestra TODOS los clientes que matchean (incluye estables y
  // nuevos, no solo perdidos/declive).
  const [search, setSearch] = useState("");

  // Toggle Pesos / Kilos (Mejora 2 Commit C). Persistencia localStorage.
  const [metric, setMetric] = useState<PerdidoMetric>("pesos");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PERDIDOS_METRIC_KEY);
      if (saved === "kilos" || saved === "pesos") setMetric(saved);
    } catch {
      // ignore
    }
  }, []);
  const switchMetric = (next: PerdidoMetric) => {
    setMetric(next);
    try {
      window.localStorage.setItem(PERDIDOS_METRIC_KEY, next);
    } catch {
      // ignore
    }
  };

  // Filtro multi-select por status (Mejora). Default: Perdido + Declive
  // (mantiene comportamiento original del tab). Persiste en localStorage.
  const [activeStatuses, setActiveStatuses] = useState<Set<PerdidoStatus>>(
    () => new Set(DEFAULT_STATUS_FILTER)
  );
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PERDIDOS_STATUS_FILTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((s): s is PerdidoStatus =>
            ["perdido", "declive", "estable", "nuevo", "recuperado"].includes(
              s as string
            )
          );
          setActiveStatuses(new Set(valid));
        }
      }
    } catch {
      // ignore
    }
  }, []);
  const toggleStatus = (s: PerdidoStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      try {
        window.localStorage.setItem(
          PERDIDOS_STATUS_FILTER_KEY,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Compute TODOS los clientes con status (incluye estables y nuevos).
  //
  // Mejora 2 Commit C: comparativo DÍA-VS-DÍA equitativo.
  //   - Modo Mes: usar acumulado al mismo día laboral (mes_venta_alDia_*)
  //   - Modo YTD: ytd_2025_alDia ≈ ytd_2025_cierre - mes_2025_cierre + mes_2025_alDia
  //     (al ytd cerrado le restamos el mes 2025 cerrado y le sumamos el
  //      mes 2025 al-día — quedamos con Ene-(mismo día actual) de 2025)
  //   - Para 2026: mes_alDia_2026 ≈ mes_2026 (ambos parciales hasta hoy)
  //                ytd_alDia_2026 = ytd_2026 (ya es Ene-hoy)
  const computed: Computed[] = useMemo(() => {
    const out: Computed[] = [];
    for (const r of rows) {
      const mesAlDia24 = r.mes_venta_alDia_2024 ?? 0;
      const mesAlDia25 = r.mes_venta_alDia_2025 ?? 0;
      const mesAlDia26 = r.mes_venta_alDia_2026 ?? r.mes_venta_2026;
      const mesKgAlDia24 = r.mes_kg_alDia_2024 ?? 0;
      const mesKgAlDia25 = r.mes_kg_alDia_2025 ?? 0;
      const mesKgAlDia26 = r.mes_kg_alDia_2026 ?? r.mes_kg_2026;
      const mesMargenAlDia25 = r.mes_margen_alDia_2025 ?? 0;
      const mesMargenAlDia26 = r.mes_margen_alDia_2026 ?? r.mes_margen_2026 ?? 0;

      // YTD al-día (al ytd cerrado le quito mes 2025 cierre y le pongo mes
      // 2025 al-día → quedo con Ene-(mismo día actual) de 2025/2024)
      const ytdAlDia24 = Math.max(
        0,
        (r.ytd_venta_2024 ?? 0) - (r.mes_venta_2024 ?? 0) + mesAlDia24
      );
      const ytdAlDia25 = Math.max(
        0,
        r.ytd_venta_2025 - r.mes_venta_2025 + mesAlDia25
      );
      const ytdAlDia26 = r.ytd_venta_2026; // ya es Ene-hoy
      const ytdKgAlDia24 = Math.max(
        0,
        (r.ytd_kg_2024 ?? 0) - (r.mes_kg_2024 ?? 0) + mesKgAlDia24
      );
      const ytdKgAlDia25 = Math.max(
        0,
        r.ytd_kg_2025 - r.mes_kg_2025 + mesKgAlDia25
      );
      const ytdKgAlDia26 = r.ytd_kg_2026;
      const ytdMargenAlDia25 = Math.max(
        0,
        (r.ytd_margen_2025 ?? 0) - (r.mes_margen_2025 ?? 0) + mesMargenAlDia25
      );
      const ytdMargenAlDia26 = r.ytd_margen_2026 ?? 0;

      const v24 = dim === "mes" ? mesAlDia24 : ytdAlDia24;
      const v25 = dim === "mes" ? mesAlDia25 : ytdAlDia25;
      const v26 = dim === "mes" ? mesAlDia26 : ytdAlDia26;
      const k24 = dim === "mes" ? mesKgAlDia24 : ytdKgAlDia24;
      const k25 = dim === "mes" ? mesKgAlDia25 : ytdKgAlDia25;
      const k26 = dim === "mes" ? mesKgAlDia26 : ytdKgAlDia26;
      const m25 = dim === "mes" ? mesMargenAlDia25 : ytdMargenAlDia25;
      const m26 = dim === "mes" ? mesMargenAlDia26 : ytdMargenAlDia26;

      // Status calculado en la métrica activa (pesos o kilos)
      const baseRef = metric === "pesos" ? v25 : k25;
      const baseCur = metric === "pesos" ? v26 : k26;
      const { status, declinePct } = computeStatus(baseRef, baseCur, {
        firstPurchaseDate: r.first_purchase_date,
        cutoffDate: newCustomerCutoffDate,
      });
      if (!status) continue;
      out.push({
        no_cliente: r.no_cliente,
        cliente: r.cliente,
        vendedor: r.vendedor,
        status,
        v24,
        k24,
        v25,
        v26,
        k25,
        k26,
        m25,
        m26,
        declinePct,
      });
    }
    // Ordenar por la métrica activa (pesos o kilos) para que el "Top" sea coherente
    return out.sort((a, b) =>
      metric === "pesos" ? b.v25 - a.v25 : b.k25 - a.k25
    );
  }, [rows, dim, metric]);

  // Búsqueda activa = al menos 2 caracteres (evita re-renders de cada letra
  // sin propósito y match accidental con strings de 1 char muy comunes).
  const searchActive = search.trim().length >= 2;

  const tableRows = useMemo(() => {
    // Primer filtro: status activos (multi-select). Si NO hay status activos,
    // la tabla queda vacía y mostramos un mensaje claro.
    if (activeStatuses.size === 0) return [];

    const byStatus = computed.filter((r) => activeStatuses.has(r.status));

    if (searchActive) {
      // Modo búsqueda: filtra por substring en cliente/vendedor sobre los
      // status activos. SIN límite Top N.
      const q = search.trim().toLowerCase();
      return byStatus.filter(
        (r) =>
          r.cliente.toLowerCase().includes(q) ||
          r.vendedor.toLowerCase().includes(q)
      );
    }
    // Modo default: status activos + Top N (preservar el comportamiento
    // original cuando solo "perdido + declive" están activos).
    return byStatus.slice(0, topNTable);
  }, [computed, search, searchActive, topNTable, activeStatuses]);

  // Counts por status (para mostrar contador en cada chip).
  // Se calcula sobre `computed` SIN filtro de búsqueda — orientativo.
  const countByStatus = useMemo(() => {
    const c: Record<PerdidoStatus, number> = {
      perdido: 0, declive: 0, estable: 0, nuevo: 0, recuperado: 0,
    };
    for (const r of computed) c[r.status]++;
    return c;
  }, [computed]);

  // Stats SIEMPRE basadas en perdidos+declive+recuperados (accionables).
  // No se afectan por el buscador.
  const stats = useMemo(() => {
    const perdidos = computed.filter((r) => r.status === "perdido").length;
    const declives = computed.filter((r) => r.status === "declive");
    const declive30 = declives.filter((r) => r.declinePct > 30).length;
    const recuperados = computed.filter(
      (r) => r.status === "recuperado"
    ).length;
    const nuevos = computed.filter((r) => r.status === "nuevo").length;
    return {
      perdidos,
      declive30,
      totalDeclive: declives.length,
      recuperados,
      nuevos,
    };
  }, [computed]);

  // ============ Datos para la Dona + Loss Cards ============
  // - Dona: 3 segmentos (Estable + Declive + Nuevo) sobre venta 2026 al-día
  //   (Perdido NO va en dona porque su valor 2026 = 0).
  // - Loss Perdido: venta perdida = venta 2025 al-día de los Perdidos
  // - Loss Declive: venta perdida = (v25 - v26) de los Declive (la porción
  //   que dejaron de vender)
  // - pctVenta = pérdida / total venta 2025 al-día (todos los clientes)
  const donutData = useMemo(() => {
    let estVal = 0, decVal = 0, nuevoVal = 0, recuperadoVal = 0;
    let estCount = 0, decCount = 0, nuevoCount = 0, perdidoCount = 0;
    let recuperadoCount = 0;
    // Acumuladores de pérdidas (Perdido + Declive) en la métrica activa
    let perdidoLossVenta = 0, perdidoLossMargen = 0, perdidoLossKg = 0;
    let decliveLossVenta = 0, decliveLossMargen = 0, decliveLossKg = 0;
    // Total venta 2025 al-día — base para el % de pérdida
    let total2025Venta = 0;

    for (const r of computed) {
      total2025Venta += r.v25;
      if (r.status === "estable") {
        estVal += metric === "pesos" ? r.v26 : r.k26;
        estCount++;
      } else if (r.status === "declive") {
        decVal += metric === "pesos" ? r.v26 : r.k26;
        decCount++;
        decliveLossVenta += Math.max(0, r.v25 - r.v26);
        decliveLossMargen += Math.max(0, r.m25 - r.m26);
        decliveLossKg += Math.max(0, r.k25 - r.k26);
      } else if (r.status === "nuevo") {
        nuevoVal += metric === "pesos" ? r.v26 : r.k26;
        nuevoCount++;
      } else if (r.status === "recuperado") {
        recuperadoVal += metric === "pesos" ? r.v26 : r.k26;
        recuperadoCount++;
      } else if (r.status === "perdido") {
        perdidoCount++;
        perdidoLossVenta += r.v25;
        perdidoLossMargen += r.m25;
        perdidoLossKg += r.k25;
      }
    }

    const segmentsAll: DonutSegment[] = [
      { status: "estable" as PerdidoStatus, value: estVal, count: estCount },
      { status: "declive" as PerdidoStatus, value: decVal, count: decCount },
      { status: "recuperado" as PerdidoStatus, value: recuperadoVal, count: recuperadoCount },
      { status: "nuevo" as PerdidoStatus, value: nuevoVal, count: nuevoCount },
    ];
    const segments: DonutSegment[] = segmentsAll.filter((s) => s.value > 0);

    return {
      segments,
      lossPerdido: {
        count: perdidoCount,
        venta: perdidoLossVenta,
        margen: perdidoLossMargen,
        kg: perdidoLossKg,
        pctVenta: total2025Venta > 0
          ? (perdidoLossVenta / total2025Venta) * 100
          : 0,
      },
      lossDeclive: {
        count: decCount,
        venta: decliveLossVenta,
        margen: decliveLossMargen,
        kg: decliveLossKg,
        pctVenta: total2025Venta > 0
          ? (decliveLossVenta / total2025Venta) * 100
          : 0,
      },
    };
  }, [computed, metric]);

  const dimLabel =
    dim === "mes"
      ? `Mes ${monthShortYY}`
      : `YTD (Ene–${monthShortYY.split(" ")[0]} ${monthShortYY.split(" ")[1]})`;
  const labelPrev = dim === "mes" ? prevMonthShortYY : "Ene–Abr 25";
  const labelCurr = dim === "mes" ? monthShortYY : "Ene–Abr 26";

  // ============ Export Excel ============
  // WYSIWYG: respeta filtros activos en pantalla (territorios + status +
  // buscador + dim + métrica). Incluye TODAS las métricas (al-día y cierre,
  // venta/margen/kg, los 3 años) para permitir tablas dinámicas a posteriori.
  // Lazy-importa exceljs (~700KB) solo al click.
  const handleExportExcel = async () => {
    const { exportToExcel, sanitizeFileName, todayISO } = await import(
      "@/lib/export-excel"
    );

    // Map original PerdidoRow por no_cliente (para sacar campos cierre completos
    // que `computed` no carga, ej. mes_venta_2025 cierre).
    const fullRowByClient = new Map<string, PerdidoRow>();
    for (const r of rows) fullRowByClient.set(r.no_cliente, r);

    // Etiqueta de territorios — viene del sidebar global ya formateada.
    const territorioLabel =
      currentTerritory && currentTerritory !== "" ? currentTerritory : "Todos";

    const statusActiveLabel =
      Array.from(activeStatuses)
        .map((s) => STATUS_CONFIG[s].label)
        .sort()
        .join(", ") || "(ninguno)";

    // Pérdidas (de la dona) — yáreflejan métrica activa y dim activa
    const lossPerdido = donutData.lossPerdido;
    const lossDeclive = donutData.lossDeclive;

    // Bloque resumen
    const summary: ExcelSummaryRow[] = [
      { label: "Periodo", value: dimLabel },
      {
        label: "Métrica",
        value: metric === "pesos" ? "Pesos ($)" : "Kilos (KG)",
      },
      { label: "Territorio(s)", value: territorioLabel },
      { label: "Status filtrados", value: statusActiveLabel },
      {
        label: "# Clientes Perdido",
        value: countByStatus.perdido,
        numFmt: "#,##0",
      },
      {
        label: "# Clientes Declive",
        value: countByStatus.declive,
        numFmt: "#,##0",
      },
      {
        label: "# Clientes Estable",
        value: countByStatus.estable,
        numFmt: "#,##0",
      },
      {
        label: "# Clientes Nuevo",
        value: countByStatus.nuevo,
        numFmt: "#,##0",
      },
      {
        label: "$ Pérdida Perdidos (vs 25 al-día)",
        value: lossPerdido.venta,
        numFmt: "$#,##0",
      },
      {
        label: "$ Pérdida Declive (vs 25 al-día)",
        value: lossDeclive.venta,
        numFmt: "$#,##0",
      },
      {
        label: "$ Pérdida Total",
        value: lossPerdido.venta + lossDeclive.venta,
        numFmt: "$#,##0",
      },
      {
        label: "# Filas exportadas",
        value: tableRows.length,
        numFmt: "#,##0",
      },
    ];

    // Columnas — exhaustivas para tablas dinámicas
    const columns: ExcelColumn[] = [
      { header: "Status", key: "status", width: 12, align: "center" },
      { header: "Territorio", key: "territorio", width: 22 },
      { header: "No. Cliente", key: "no_cliente", width: 14 },
      { header: "Cliente", key: "cliente", width: 38 },
      { header: "Vendedor", key: "vendedor", width: 24 },
      // 2024 al-día (informativo)
      {
        header: "Venta 2024 al-día",
        key: "v24_alDia",
        width: 16,
        numFmt: "$#,##0",
      },
      {
        header: "KG 2024 al-día",
        key: "k24_alDia",
        width: 14,
        numFmt: "#,##0",
      },
      {
        header: "Margen 2024 al-día",
        key: "m24_alDia",
        width: 16,
        numFmt: "$#,##0",
      },
      // 2025 al-día (referencia base de status)
      {
        header: "Venta 2025 al-día",
        key: "v25_alDia",
        width: 16,
        numFmt: "$#,##0",
      },
      {
        header: "KG 2025 al-día",
        key: "k25_alDia",
        width: 14,
        numFmt: "#,##0",
      },
      {
        header: "Margen 2025 al-día",
        key: "m25_alDia",
        width: 16,
        numFmt: "$#,##0",
      },
      {
        header: "Margen % 2025 al-día",
        key: "mPct25_alDia",
        width: 18,
        numFmt: "0.0%",
      },
      // 2025 cierre completo
      {
        header: "Venta 2025 cierre",
        key: "v25_cierre",
        width: 16,
        numFmt: "$#,##0",
      },
      {
        header: "KG 2025 cierre",
        key: "k25_cierre",
        width: 14,
        numFmt: "#,##0",
      },
      {
        header: "Margen 2025 cierre",
        key: "m25_cierre",
        width: 16,
        numFmt: "$#,##0",
      },
      // 2026 al-día (actual)
      {
        header: "Venta 2026 al-día",
        key: "v26_alDia",
        width: 16,
        numFmt: "$#,##0",
      },
      {
        header: "KG 2026 al-día",
        key: "k26_alDia",
        width: 14,
        numFmt: "#,##0",
      },
      {
        header: "Margen 2026 al-día",
        key: "m26_alDia",
        width: 16,
        numFmt: "$#,##0",
      },
      {
        header: "Margen % 2026 al-día",
        key: "mPct26_alDia",
        width: 18,
        numFmt: "0.0%",
      },
      // Variaciones vs 25
      {
        header: "Var Venta % vs 25",
        key: "varVentaPct",
        width: 16,
        numFmt: "0.0%",
      },
      {
        header: "Var KG % vs 25",
        key: "varKgPct",
        width: 14,
        numFmt: "0.0%",
      },
    ];

    // Filas de datos
    const xlsxRows = tableRows.map((t) => {
      const full = fullRowByClient.get(t.no_cliente);
      // Mejora 7: el territorio viene del sidebar global ya agregado.
      const territorio = currentTerritory || "";

      // Cierre 2025 según dim
      const v25_cierre =
        dim === "mes"
          ? (full?.mes_venta_2025 ?? 0)
          : (full?.ytd_venta_2025 ?? 0);
      const k25_cierre =
        dim === "mes"
          ? (full?.mes_kg_2025 ?? 0)
          : (full?.ytd_kg_2025 ?? 0);
      const m25_cierre =
        dim === "mes"
          ? (full?.mes_margen_2025 ?? 0)
          : (full?.ytd_margen_2025 ?? 0);

      // Margen 2024 al-día
      const m24_alDia = (() => {
        if (!full) return 0;
        if (dim === "mes") return full.mes_margen_alDia_2024 ?? 0;
        return Math.max(
          0,
          (full.ytd_margen_2024 ?? 0) -
            (full.mes_margen_2024 ?? 0) +
            (full.mes_margen_alDia_2024 ?? 0)
        );
      })();

      const mPct25_alDia = t.v25 > 0 ? t.m25 / t.v25 : 0;
      const mPct26_alDia = t.v26 > 0 ? t.m26 / t.v26 : 0;
      const varVentaPct = t.v25 > 0 ? (t.v26 - t.v25) / t.v25 : 0;
      const varKgPct = t.k25 > 0 ? (t.k26 - t.k25) / t.k25 : 0;

      return {
        status: STATUS_CONFIG[t.status].label,
        territorio,
        no_cliente: t.no_cliente,
        cliente: t.cliente,
        vendedor: t.vendedor,
        v24_alDia: t.v24,
        k24_alDia: t.k24,
        m24_alDia,
        v25_alDia: t.v25,
        k25_alDia: t.k25,
        m25_alDia: t.m25,
        mPct25_alDia,
        v25_cierre,
        k25_cierre,
        m25_cierre,
        v26_alDia: t.v26,
        k26_alDia: t.k26,
        m26_alDia: t.m26,
        mPct26_alDia,
        varVentaPct,
        varKgPct,
      };
    });

    // Totales (sumas + recalcular % sobre las sumas)
    const totals = xlsxRows.reduce(
      (acc, r) => ({
        v24_alDia: acc.v24_alDia + (r.v24_alDia as number),
        k24_alDia: acc.k24_alDia + (r.k24_alDia as number),
        m24_alDia: acc.m24_alDia + (r.m24_alDia as number),
        v25_alDia: acc.v25_alDia + (r.v25_alDia as number),
        k25_alDia: acc.k25_alDia + (r.k25_alDia as number),
        m25_alDia: acc.m25_alDia + (r.m25_alDia as number),
        v25_cierre: acc.v25_cierre + (r.v25_cierre as number),
        k25_cierre: acc.k25_cierre + (r.k25_cierre as number),
        m25_cierre: acc.m25_cierre + (r.m25_cierre as number),
        v26_alDia: acc.v26_alDia + (r.v26_alDia as number),
        k26_alDia: acc.k26_alDia + (r.k26_alDia as number),
        m26_alDia: acc.m26_alDia + (r.m26_alDia as number),
      }),
      {
        v24_alDia: 0,
        k24_alDia: 0,
        m24_alDia: 0,
        v25_alDia: 0,
        k25_alDia: 0,
        m25_alDia: 0,
        v25_cierre: 0,
        k25_cierre: 0,
        m25_cierre: 0,
        v26_alDia: 0,
        k26_alDia: 0,
        m26_alDia: 0,
      }
    );
    const totalRow: Record<string, unknown> = {
      status: "TOTAL",
      territorio: "",
      no_cliente: "",
      cliente: `${xlsxRows.length} ${xlsxRows.length === 1 ? "cliente" : "clientes"}`,
      vendedor: "",
      ...totals,
      mPct25_alDia:
        totals.v25_alDia > 0 ? totals.m25_alDia / totals.v25_alDia : 0,
      mPct26_alDia:
        totals.v26_alDia > 0 ? totals.m26_alDia / totals.v26_alDia : 0,
      varVentaPct:
        totals.v25_alDia > 0
          ? (totals.v26_alDia - totals.v25_alDia) / totals.v25_alDia
          : 0,
      varKgPct:
        totals.k25_alDia > 0
          ? (totals.k26_alDia - totals.k25_alDia) / totals.k25_alDia
          : 0,
    };

    // Nombre de archivo: "Perdidos_<Territorio>_2026-05-10.xlsx"
    // Si la lista de territorios es muy larga (multi-select), uso "varios".
    const territoriosForFile =
      territorioLabel.length > 30 ? "varios" : territorioLabel;
    const fileName = `Perdidos_${sanitizeFileName(territoriosForFile)}_${todayISO()}`;

    await exportToExcel({
      fileName,
      sheetName: "Perdidos",
      title: `Tab Perdidos · ${dimLabel}`,
      subtitle: `${territorioLabel} · Métrica: ${metric === "pesos" ? "Pesos ($)" : "Kilos (KG)"} · Status: ${statusActiveLabel}`,
      summary,
      columns,
      rows: xlsxRows,
      totalRow,
    });
  };

  return (
    <div className="space-y-4">
      {/* Toggles + export (multi-select de territorios vive en el sidebar global) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MetricToggle value={metric} onChange={switchMetric} />
        <DimToggle value={dim} onChange={setDim} monthShortYY={monthShortYY} />
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
        <ReportButton reportInput={reportInput} canExport={canExportExcel} />
      </div>

      {/* Dona de status + alertas laterales */}
      {donutData.segments.length > 0 && (
        <StatusDonut
          segments={donutData.segments}
          metric={metric}
          totalLabel={
            metric === "pesos" ? "Venta actual" : "Kilos actuales"
          }
          lossPerdido={donutData.lossPerdido}
          lossDeclive={donutData.lossDeclive}
        />
      )}

      {/* Stats cards — 5 indicadores accionables */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={<AlertOctagon size={18} />}
          label={`Perdidos · ${dimLabel}`}
          value={stats.perdidos.toLocaleString("es-MX")}
          tone="danger"
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Declive >30%"
          value={stats.declive30.toLocaleString("es-MX")}
          tone="warning"
        />
        <StatCard
          icon={<TrendingDown size={18} />}
          label="Total Declive"
          value={stats.totalDeclive.toLocaleString("es-MX")}
          tone="muted"
        />
        <StatCard
          icon={<RotateCcw size={18} />}
          label="Recuperados · 90d"
          value={stats.recuperados.toLocaleString("es-MX")}
          tone="recuperado"
        />
        <StatCard
          icon={<Sparkles size={18} />}
          label="Nuevos · 90d"
          value={stats.nuevos.toLocaleString("es-MX")}
          tone="info"
        />
      </div>

      {/* Buscador + chips de filtro por status */}
      <div
        className="rounded-[var(--radius-lg)] border p-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* Fila 1: input + sub-label contador */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex flex-1 items-center gap-2 rounded-[var(--radius)] border px-3 py-1.5"
            style={{
              background: "var(--bg-surface-muted)",
              borderColor: "var(--border)",
              minWidth: 280,
            }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o vendedor…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="rounded p-0.5 transition-colors hover:bg-[var(--bg-surface)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {activeStatuses.size === 0
              ? "Selecciona al menos un status para ver clientes"
              : searchActive
                ? `${tableRows.length} resultado${tableRows.length === 1 ? "" : "s"}`
                : `Mostrando ${tableRows.length} de ${computed.filter((r) => activeStatuses.has(r.status)).length}${
                    !searchActive && tableRows.length === topNTable ? ` (Top ${topNTable})` : ""
                  }`}
          </span>
        </div>

        {/* Fila 2: chips de filtro por status */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Status:
          </span>
          {(
            [
              "perdido",
              "declive",
              "recuperado",
              "nuevo",
              "estable",
            ] as PerdidoStatus[]
          ).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const active = activeStatuses.has(s);
              const count = countByStatus[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all"
                  style={{
                    background: active ? cfg.bg : cfg.bgInactive,
                    borderColor: active ? cfg.color : "var(--border)",
                    color: active ? cfg.color : "var(--text-muted)",
                    opacity: active ? 1 : 0.6,
                  }}
                >
                  <span>{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                  <span
                    className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.3)"
                        : "transparent",
                      color: active ? cfg.color : "var(--text-muted)",
                    }}
                  >
                    {count.toLocaleString("es-MX")}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Tabla */}
      {computed.length === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] border p-12 text-center text-sm"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Sin data para esta dimensión.
        </div>
      ) : activeStatuses.size === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] border p-12 text-center text-sm"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Selecciona al menos un{" "}
          <strong style={{ color: "var(--text-primary)" }}>status</strong>{" "}
          arriba para ver clientes.
        </div>
      ) : tableRows.length === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] border p-12 text-center text-sm"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          {searchActive ? (
            <>
              Sin resultados para <strong>&quot;{search}&quot;</strong> con
              los status activos. Prueba activar más status o ajustar la
              búsqueda.
            </>
          ) : (
            <>
              Sin clientes en los status seleccionados para esta dimensión.
            </>
          )}
        </div>
      ) : (
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
                  <Th>Cliente</Th>
                  <Th>Vendedor</Th>
                  <Th align="center">Status</Th>
                  {/* 2024 — informativo (gris muted, antes de 2025) */}
                  <Th align="right" subtle>
                    {prevMonthShortYY.replace(/\d+/, "24")} {metric === "pesos" ? "$" : "kg"}
                  </Th>
                  {/* 2025 — referencia base */}
                  <Th align="right">
                    {labelPrev} {metric === "pesos" ? "$" : "kg"}
                  </Th>
                  {/* 2026 — actual */}
                  <Th align="right">
                    {labelCurr} {metric === "pesos" ? "$" : "kg"}
                  </Th>
                  {/* Var % vs último año (2025) */}
                  <Th align="right">
                    Var {metric === "pesos" ? "$" : "kg"} % vs 25
                  </Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  // Var % en la métrica activa (siempre vs 2025)
                  const refV = metric === "pesos" ? r.v25 : r.k25;
                  const curV = metric === "pesos" ? r.v26 : r.k26;
                  const ref24V = metric === "pesos" ? r.v24 : r.k24;
                  const varPct =
                    refV > 0 ? ((curV - refV) / refV) * 100 : null;
                  const varColor =
                    varPct == null
                      ? "var(--text-muted)"
                      : varPct <= -100
                        ? "var(--danger)"
                        : varPct < -30
                          ? "var(--danger)"
                          : varPct < 0
                            ? "var(--warning)"
                            : "var(--success)";
                  const fmt = metric === "pesos" ? formatMoney : formatKilos;
                  return (
                    <tr
                      key={r.no_cliente}
                      style={{
                        background:
                          i % 2 === 0
                            ? "var(--bg-surface)"
                            : "var(--bg-surface-muted)",
                      }}
                    >
                      <Td>{r.cliente}</Td>
                      <Td>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {r.vendedor}
                        </span>
                      </Td>
                      <Td align="center">
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td align="right" subtle>
                        {ref24V > 0 ? fmt(ref24V) : "—"}
                      </Td>
                      <Td align="right">{fmt(refV)}</Td>
                      <Td align="right">{fmt(curV)}</Td>
                      <Td align="right" bold color={varColor}>
                        {varPct == null
                          ? "—"
                          : `${varPct >= 0 ? "+" : ""}${varPct.toFixed(1)}%`}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {computed.length > tableRows.length && (
            <div
              className="border-t px-3 py-2 text-center text-[11px]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Mostrando top {tableRows.length} de {computed.length} clientes
              (ordenados por venta {labelPrev})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function MetricToggle({
  value,
  onChange,
}: {
  value: PerdidoMetric;
  onChange: (v: PerdidoMetric) => void;
}) {
  const opts: Array<{ v: PerdidoMetric; label: string }> = [
    { v: "pesos", label: "Pesos" },
    { v: "kilos", label: "Kilos" },
  ];
  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      {opts.map((opt) => {
        const active = opt.v === value;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DimToggle({
  value,
  onChange,
  monthShortYY,
}: {
  value: PerdidoDim;
  onChange: (v: PerdidoDim) => void;
  monthShortYY: string;
}) {
  const opts: Array<{ v: PerdidoDim; label: string }> = [
    { v: "mes", label: `Mes ${monthShortYY}` },
    { v: "ytd", label: "YTD" },
  ];
  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      {opts.map((opt) => {
        const active = opt.v === value;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "danger" | "warning" | "muted" | "recuperado" | "info";
}) {
  const accentVar =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
        ? "var(--warning)"
        : tone === "recuperado"
          ? "#8b5cf6" // violeta — matchea STATUS_CONFIG.recuperado.color
          : tone === "info"
            ? "#3b82f6" // azul — matchea STATUS_CONFIG.nuevo.color
            : "var(--text-secondary)";
  return (
    <div
      className="flex flex-col rounded-[var(--radius-lg)] border p-5"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </span>
        <span style={{ color: accentVar }}>{icon}</span>
      </div>
      <div
        className="mt-3 text-3xl font-bold tabular-nums"
        style={{ color: accentVar }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PerdidoStatus }) {
  // Reusamos STATUS_CONFIG declarado arriba (single source of truth)
  const config = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}

function Th({
  children,
  align = "left",
  subtle = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  /** Color tenue + borde dashed izquierdo para distinguir columnas auxiliares (ej. 2024 informativo) */
  subtle?: boolean;
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: subtle ? "var(--text-muted)" : "var(--text-secondary)",
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  color,
  bold = false,
  subtle = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  color?: string;
  bold?: boolean;
  subtle?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 text-${align}`}
      style={{
        color: color ?? (subtle ? "var(--text-secondary)" : "var(--text-primary)"),
        fontWeight: bold ? 600 : 400,
        borderLeft: subtle ? "1px dashed var(--border)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

// ============================================================
// StatusDonut — gráfica de dona con % por status
// ============================================================
interface DonutSegment {
  status: PerdidoStatus;
  value: number; // venta en pesos o kilos según métrica activa
  count: number; // número de clientes en ese status
}

function StatusDonut({
  segments,
  metric,
  totalLabel,
  lossPerdido,
  lossDeclive,
}: {
  /** 3 segmentos: Estable, Declive, Nuevo (Perdido NO va en la dona —
   *  no tiene venta en 2026; aparece en alerta lateral) */
  segments: DonutSegment[];
  metric: PerdidoMetric;
  /** Label del centro: "Total venta actual" o "Total KG actual" */
  totalLabel: string;
  /** Pérdidas calculadas (clientes Perdidos): venta, margen, kg */
  lossPerdido: {
    count: number;
    venta: number;
    margen: number;
    kg: number;
    pctVenta: number; // % vs venta base 2025 al-día
  };
  /** Pérdidas calculadas (clientes Declive): mismo formato */
  lossDeclive: {
    count: number;
    venta: number;
    margen: number;
    kg: number;
    pctVenta: number;
  };
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const fmt = metric === "pesos" ? formatMoney : formatKilos;
  const dataForChart = segments.map((s) => ({
    name: STATUS_CONFIG[s.status].label,
    value: s.value,
    color: STATUS_CONFIG[s.status].color,
    status: s.status,
    count: s.count,
  }));

  return (
    <div
      className="rounded-[var(--radius-lg)] border p-4"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <h3
        className="mb-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        Composición por Status · {metric === "pesos" ? "Venta $" : "Kilos"}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Dona */}
        <div className="relative flex flex-col items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={dataForChart}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                strokeWidth={0}
              >
                {dataForChart.map((d) => (
                  <Cell key={d.status} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centro */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {totalLabel}
            </span>
            <span
              className="mt-0.5 text-base font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {fmt(total)}
            </span>
          </div>
          {/* Leyenda inferior */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {dataForChart.map((d) => {
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <span
                  key={d.status}
                  className="flex items-center gap-1.5 text-[11px]"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: d.color }}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>
                    {d.name}
                  </span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Alerta lateral con pérdidas (Perdido + Declive) */}
        <div className="flex flex-col gap-2">
          <LossCard
            title="Venta perdida"
            subtitle={`${lossPerdido.count} cliente${lossPerdido.count === 1 ? "" : "s"} dejaron de comprar`}
            tone="danger"
            metric={metric}
            venta={lossPerdido.venta}
            margen={lossPerdido.margen}
            kg={lossPerdido.kg}
            pctVenta={lossPerdido.pctVenta}
          />
          <LossCard
            title="Venta en declive"
            subtitle={`${lossDeclive.count} cliente${lossDeclive.count === 1 ? "" : "s"} compran menos`}
            tone="warning"
            metric={metric}
            venta={lossDeclive.venta}
            margen={lossDeclive.margen}
            kg={lossDeclive.kg}
            pctVenta={lossDeclive.pctVenta}
          />
        </div>
      </div>
    </div>
  );
}

function LossCard({
  title,
  subtitle,
  tone,
  metric,
  venta,
  margen,
  kg,
  pctVenta,
}: {
  title: string;
  subtitle: string;
  tone: "danger" | "warning";
  metric: PerdidoMetric;
  venta: number;
  margen: number;
  kg: number;
  pctVenta: number;
}) {
  const colorBg = tone === "danger" ? "var(--danger-soft)" : "var(--warning-soft)";
  const colorAccent = tone === "danger" ? "var(--danger)" : "var(--warning)";
  const marginPct = venta > 0 ? (margen / venta) * 100 : 0;
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2.5"
      style={{
        background: colorBg,
        borderColor: colorAccent,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: colorAccent }}
        >
          {title}
        </span>
        <span
          className="text-[11px] font-bold tabular-nums"
          style={{ color: colorAccent }}
        >
          ▼ {pctVenta.toFixed(1)}%
        </span>
      </div>
      <div
        className="mt-0.5 text-[10px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {subtitle}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <LossStat label="Venta $" value={formatMoney(venta)} highlighted={metric === "pesos"} />
        <LossStat label="Margen $" value={formatMoney(margen)} subValue={`${marginPct.toFixed(1)}%`} />
        <LossStat label="Kilos" value={formatKilos(kg)} highlighted={metric === "kilos"} />
      </div>
    </div>
  );
}

function LossStat({
  label,
  value,
  subValue,
  highlighted = false,
}: {
  label: string;
  value: string;
  subValue?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="rounded-[var(--radius-sm)] px-1.5 py-1"
      style={{
        background: highlighted ? "rgba(255,255,255,0.5)" : "transparent",
      }}
    >
      <div
        className="text-[9px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
      {subValue && (
        <div
          className="text-[10px]"
          style={{ color: "var(--text-muted)" }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}
