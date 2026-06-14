import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardClient } from "./DashboardClient";
import type {
  Territory,
  TerritoryKpi,
  MonthlyPoint,
} from "@/components/dashboard/Sidebar";
import type { DimensionRow } from "@/components/dashboard/DimensionTab";
import type { PerdidoRow } from "@/components/dashboard/PerdidosTab";
import {
  countBizDays,
  findCalendarDayForBizDays,
  getMexicoCityDateParts,
} from "@/lib/business-days";

export interface DimensionDataset {
  byTerritory: Record<string, DimensionRow[]>;
  total: DimensionRow[];
}

export interface PerdidosDataset {
  byTerritory: Record<string, PerdidoRow[]>;
  total: PerdidoRow[];
}

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTH_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const ACUM_YEARS = [2024, 2025, 2026];

function emptyKpi(): TerritoryKpi {
  return {
    venta: 0,
    margen: 0,
    kg: 0,
    marginPct: 0,
    prevYear: { venta: 0, margen: 0, kg: 0 },
    acumByYear: {},
    daily: { current: [], prevYear: [] },
    monthly: [],
  };
}

function withMarginPct(k: TerritoryKpi): TerritoryKpi {
  return { ...k, marginPct: k.venta > 0 ? (k.margen / k.venta) * 100 : 0 };
}

/**
 * Helper genérico para construir DimensionDataset desde rows del view
 * (anio, mes, territorio, dim_value, total_venta). Aggrega por territorio
 * y total (sumando across territorios).
 */
/**
 * Versión "al día N" de buildDimDataset: agrega rows del view diario a los
 * campos `*_alDia` de DimensionRow. Asume que el dataset base ya fue
 * construido con buildDimDataset (cierre del mes); este merge ENCIMA los
 * acumulados al día.
 *
 * Si una dimensión existe en al-día pero no en cierre, se agrega como
 * row nueva con cierre=0.
 */
function mergeAlDiaIntoDataset<
  T extends {
    territorio: string;
    anio: number;
    total_venta: number | string | null;
    total_kg?: number | string | null;
    total_margen?: number | string | null;
  },
>(
  base: DimensionDataset,
  alDiaRows: T[] | null,
  getName: (r: T) => string,
  cy: number
): DimensionDataset {
  // Reconstruir índices para mergear
  const byTerrIdx = new Map<string, Map<string, DimensionRow>>();
  for (const [terr, rs] of Object.entries(base.byTerritory)) {
    const m = new Map<string, DimensionRow>();
    for (const r of rs) m.set(r.name, r);
    byTerrIdx.set(terr, m);
  }
  const totalIdx = new Map<string, DimensionRow>();
  for (const r of base.total) totalIdx.set(r.name, r);

  for (const row of alDiaRows ?? []) {
    const name = getName(row);
    const v = Number(row.total_venta) || 0;
    const k = Number(row.total_kg ?? 0) || 0;
    const mg = Number(row.total_margen ?? 0) || 0;

    // Por territorio
    let terrMap = byTerrIdx.get(row.territorio);
    if (!terrMap) {
      terrMap = new Map();
      byTerrIdx.set(row.territorio, terrMap);
    }
    const cur = terrMap.get(name) ?? {
      name, v24: 0, v25: 0, v26: 0,
      k24: 0, k25: 0, k26: 0,
      m24: 0, m25: 0, m26: 0,
      v24_alDia: 0, v25_alDia: 0, v26_alDia: 0,
      k24_alDia: 0, k25_alDia: 0, k26_alDia: 0,
      m24_alDia: 0, m25_alDia: 0, m26_alDia: 0,
    };
    // SUMAR (no asignar). La vista diaria devuelve 1 row por (territorio,
    // dimensión, día). Si usamos `=` solo nos quedamos con el último día
    // procesado de cada territorio → kgs ~17% del real. Bug detectado por
    // Mauricio: SALMON LOMO mostraba 296 kg al-día cuando real era 1,703 kg.
    if (row.anio === cy - 2) {
      cur.v24_alDia = (cur.v24_alDia ?? 0) + v;
      cur.k24_alDia = (cur.k24_alDia ?? 0) + k;
      cur.m24_alDia = (cur.m24_alDia ?? 0) + mg;
    } else if (row.anio === cy - 1) {
      cur.v25_alDia = (cur.v25_alDia ?? 0) + v;
      cur.k25_alDia = (cur.k25_alDia ?? 0) + k;
      cur.m25_alDia = (cur.m25_alDia ?? 0) + mg;
    } else if (row.anio === cy) {
      cur.v26_alDia = (cur.v26_alDia ?? 0) + v;
      cur.k26_alDia = (cur.k26_alDia ?? 0) + k;
      cur.m26_alDia = (cur.m26_alDia ?? 0) + mg;
    }
    terrMap.set(name, cur);

    // Total (sumando todos los territorios)
    const tcur = totalIdx.get(name) ?? {
      name, v24: 0, v25: 0, v26: 0,
      k24: 0, k25: 0, k26: 0,
      m24: 0, m25: 0, m26: 0,
      v24_alDia: 0, v25_alDia: 0, v26_alDia: 0,
      k24_alDia: 0, k25_alDia: 0, k26_alDia: 0,
      m24_alDia: 0, m25_alDia: 0, m26_alDia: 0,
    };
    if (row.anio === cy - 2) {
      tcur.v24_alDia = (tcur.v24_alDia ?? 0) + v;
      tcur.k24_alDia = (tcur.k24_alDia ?? 0) + k;
      tcur.m24_alDia = (tcur.m24_alDia ?? 0) + mg;
    } else if (row.anio === cy - 1) {
      tcur.v25_alDia = (tcur.v25_alDia ?? 0) + v;
      tcur.k25_alDia = (tcur.k25_alDia ?? 0) + k;
      tcur.m25_alDia = (tcur.m25_alDia ?? 0) + mg;
    } else if (row.anio === cy) {
      tcur.v26_alDia = (tcur.v26_alDia ?? 0) + v;
      tcur.k26_alDia = (tcur.k26_alDia ?? 0) + k;
      tcur.m26_alDia = (tcur.m26_alDia ?? 0) + mg;
    }
    totalIdx.set(name, tcur);
  }

  return {
    byTerritory: Object.fromEntries(
      Array.from(byTerrIdx.entries()).map(([t, m]) => [t, Array.from(m.values())])
    ),
    total: Array.from(totalIdx.values()),
  };
}

function buildDimDataset<
  T extends {
    territorio: string;
    anio: number;
    total_venta: number | string | null;
    total_kg?: number | string | null;
    total_margen?: number | string | null;
  },
>(
  rows: T[] | null,
  getName: (r: T) => string,
  cy: number
): DimensionDataset {
  const byTerrMap = new Map<string, Map<string, DimensionRow>>();
  for (const row of rows ?? []) {
    let m = byTerrMap.get(row.territorio);
    if (!m) {
      m = new Map();
      byTerrMap.set(row.territorio, m);
    }
    const name = getName(row);
    const cur = m.get(name) ?? {
      name,
      v24: 0,
      v25: 0,
      v26: 0,
      k24: 0,
      k25: 0,
      k26: 0,
      m24: 0,
      m25: 0,
      m26: 0,
    };
    const v = Number(row.total_venta) || 0;
    const k = Number(row.total_kg ?? 0) || 0;
    const mg = Number(row.total_margen ?? 0) || 0;
    // SUMAR (no asignar). Cuando hay MÚLTIPLES rows que mapean al MISMO name
    // (ej. 2 no_cliente distintos con el mismo cliente="TIERRA DE HORNEROS",
    // o múltiples SKU/grupo con el mismo nombre, o múltiples territorios
    // que aportan al mismo row en el total), el = sobreescribe y solo
    // queda el último procesado. Bug detectado por Mauricio cuando la
    // tabla mostraba $34.72K (suma correcta del al-día) pero el tooltip
    // mostraba $9.03K (cierre del 2do no_cliente que sobreescribió al 1ro).
    if (row.anio === cy - 2) {
      cur.v24 = (cur.v24 ?? 0) + v;
      cur.k24 = (cur.k24 ?? 0) + k;
      cur.m24 = (cur.m24 ?? 0) + mg;
    } else if (row.anio === cy - 1) {
      cur.v25 = (cur.v25 ?? 0) + v;
      cur.k25 = (cur.k25 ?? 0) + k;
      cur.m25 = (cur.m25 ?? 0) + mg;
    } else if (row.anio === cy) {
      cur.v26 = (cur.v26 ?? 0) + v;
      cur.k26 = (cur.k26 ?? 0) + k;
      cur.m26 = (cur.m26 ?? 0) + mg;
    }
    m.set(name, cur);
  }
  const byTerritory: Record<string, DimensionRow[]> = {};
  const totalMap = new Map<string, DimensionRow>();
  for (const [terr, m] of byTerrMap) {
    byTerritory[terr] = Array.from(m.values());
    for (const r of m.values()) {
      const cur = totalMap.get(r.name) ?? {
        name: r.name,
        v24: 0,
        v25: 0,
        v26: 0,
        k24: 0,
        k25: 0,
        k26: 0,
        m24: 0,
        m25: 0,
        m26: 0,
      };
      cur.v24 += r.v24;
      cur.v25 += r.v25;
      cur.v26 += r.v26;
      cur.k24 = (cur.k24 ?? 0) + (r.k24 ?? 0);
      cur.k25 = (cur.k25 ?? 0) + (r.k25 ?? 0);
      cur.k26 = (cur.k26 ?? 0) + (r.k26 ?? 0);
      cur.m24 = (cur.m24 ?? 0) + (r.m24 ?? 0);
      cur.m25 = (cur.m25 ?? 0) + (r.m25 ?? 0);
      cur.m26 = (cur.m26 ?? 0) + (r.m26 ?? 0);
      totalMap.set(r.name, cur);
    }
  }
  return { byTerritory, total: Array.from(totalMap.values()) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; asOf?: string }>;
}) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("PEGAR_AQUI")
  ) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Cargar permisos del usuario + settings globales en paralelo
  const [{ data: permissions }, appSettings] = await Promise.all([
    supabase
      .from("users_permissions")
      .select(
        "full_name, role, allowed_territories, can_edit_ptto, can_export_excel, session_timeout_exempt"
      )
      .eq("user_id", user.id)
      .single(),
    getAppSettings(),
  ]);

  // "Hoy" en zona horaria CDMX (UTC-6). Vercel corre en UTC, entonces si
  // usamos `new Date()` directo, después de las 6pm CDMX el server ya cree
  // que es el día siguiente y rompe los KPIs. Ver lib/business-days.ts.
  const today = getMexicoCityDateParts();

  // Soporte de selector de mes/año via searchParams (?year=2026&month=4).
  // Si no vienen, default = mes actual CDMX.
  // Validamos rangos para evitar que el usuario meta valores inválidos en URL.
  const sp = await searchParams;
  const yearParam = parseInt(sp.year ?? "", 10);
  const monthParam = parseInt(sp.month ?? "", 10);
  const isValidYearMonth =
    Number.isFinite(yearParam) &&
    Number.isFinite(monthParam) &&
    yearParam >= 2024 &&
    yearParam <= today.year + 1 &&
    monthParam >= 1 &&
    monthParam <= 12;

  const currentYear = isValidYearMonth ? yearParam : today.year;
  const currentMonth = isValidYearMonth ? monthParam : today.month;

  // ¿Estamos viendo el mes actual o un histórico?
  const isHistorical =
    currentYear !== today.year || currentMonth !== today.month;

  // Día actual: si estamos en el mes en curso, usa hoy. Si es histórico,
  // asume mes completo (último día del mes) — relevante para Run-Rate y
  // para "días con factura" en Tracking Diario.
  const monthIdx = currentMonth - 1; // 0-11 para indexar arrays MONTH_*
  // Día 0 del mes siguiente = último día del mes actual = días totales.
  const daysTotal = new Date(currentYear, currentMonth, 0).getDate();

  // === Toggle "Cierre [X-may] / Hoy [Y-may]" ===
  // Permite ver el dashboard "como si fuera ayer" cuando hoy aún no hay
  // venta del día (típico: refrescas en la mañana, comparar contra meta
  // de hoy sería engañoso porque la data llega hasta ayer).
  //
  // Si viene ?asOf=YYYY-MM-DD: validamos formato y rango (mismo año/mes,
  // día 1..daysTotal, no futuro). Si pasa todo, override daysCurrent con
  // ese día. Todo el resto del pipeline (elapsedBizDays, *_alDia, etc.)
  // se recalcula solo a partir de daysCurrent.
  let daysCurrent: number;
  let asOfDay: number | null = null; // null = default (hoy en mes actual / cierre en histórico)
  // Default según contexto: histórico = mes completo (cierre); actual = hoy CDMX.
  const defaultDay = isHistorical ? daysTotal : today.day;
  // Tope máximo permitido para asOf: en mes actual no permitir días futuros
  // (más allá de hoy CDMX); en histórico, hasta el último día del mes.
  const maxAsOfDay = isHistorical ? daysTotal : today.day;
  {
    const asOfRaw = sp.asOf?.trim();
    if (asOfRaw && /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw)) {
      const [yy, mm, dd] = asOfRaw.split("-").map((s) => parseInt(s, 10));
      const valid =
        yy === currentYear &&
        mm === currentMonth &&
        dd >= 1 &&
        dd <= daysTotal &&
        dd <= maxAsOfDay;
      if (valid) {
        asOfDay = dd;
        daysCurrent = dd;
      } else {
        daysCurrent = defaultDay;
      }
    } else {
      daysCurrent = defaultDay;
    }
  }

  const currentMonthLabel = `${MONTH_NAMES_ES[monthIdx]} ${currentYear}`;
  const monthShortYY = `${MONTH_SHORT_ES[monthIdx]} ${currentYear % 100}`;
  const prevMonthShortYY = `${MONTH_SHORT_ES[monthIdx]} ${(currentYear - 1) % 100}`;
  const prev2MonthShortYY = `${MONTH_SHORT_ES[monthIdx]} ${(currentYear - 2) % 100}`;
  // Días hábiles (L-S menos feriados LFT) — para Tracking Diario y Run-Rate.
  const elapsedBizDays = countBizDays(currentYear, currentMonth, daysCurrent);
  const totalBizDays = countBizDays(currentYear, currentMonth, null);

  // Pull en paralelo: vista mensual agregada + estados + presupuestos +
  // vista diaria (current month + prev year same month, para Tracking Diario).
  // Las vistas evitan el limite default de 1000 filas que aplica a sales_rows.
  const [
    { data: monthlySummary },
    { data: states },
    { data: budgetRows },
    { data: dailyCurrent },
    { data: dailyPrevYear },
    { data: dailyPrev2Year },
  ] = await Promise.all([
    supabase
      .from("kpi_monthly_summary")
      .select("anio, mes, territorio, total_venta, total_margen, total_kg"),
    supabase
      .from("territories_state")
      .select("territory_name, is_active, reason")
      .order("territory_name"),
    supabase
      .from("territory_budgets")
      .select("territorio, venta_budget")
      .eq("anio", currentYear)
      .eq("mes", currentMonth),
    supabase
      .from("kpi_daily_summary")
      .select("fecha, territorio, total_venta, total_margen, total_kg")
      .eq("anio", currentYear)
      .eq("mes", currentMonth)
      .order("fecha"),
    supabase
      .from("kpi_daily_summary")
      .select("fecha, territorio, total_venta, total_margen, total_kg")
      .eq("anio", currentYear - 1)
      .eq("mes", currentMonth)
      .order("fecha"),
    // Daily 2024 del mes actual — para sombreado al-día del slot del mes
    // actual del chart Ventas (Commit B Mejora 2)
    supabase
      .from("kpi_daily_summary")
      .select("fecha, territorio, total_venta, total_margen, total_kg")
      .eq("anio", currentYear - 2)
      .eq("mes", currentMonth)
      .order("fecha"),
  ]);

  // === lastDayWithSale ===
  // Última fecha del mes actual con venta > 0 (global across territorios
  // visibles). Sirve para detectar el desfase data vs calendario:
  //   - Si hoy es 14-may pero la última venta es del 13-may → toggle "Cierre
  //     13-may / Hoy 14-may" aparece en el header del dashboard.
  //   - Si lastDayWithSale === today.day → no aparece (no hay desfase).
  // Solo aplica para el mes en curso; en histórico el toggle no tiene sentido.
  // daysWithSale: días del mes seleccionado con venta > 0 (global across
  // territorios visibles). Usado por el DaySelector del header para resaltar
  // qué días tienen venta. Se calcula para CUALQUIER mes (actual o histórico).
  const daysWithSaleSet = new Set<number>();
  for (const r of dailyCurrent ?? []) {
    const v = Number(r.total_venta) || 0;
    if (v <= 0) continue;
    const d = new Date(r.fecha + "T12:00:00").getDate();
    daysWithSaleSet.add(d);
  }
  const daysWithSale = Array.from(daysWithSaleSet).sort((a, b) => a - b);

  // lastDayWithSale: el máximo día con venta — solo aplica al mes en curso
  // (alimenta el CutoffToggle "Cierre/Hoy", que no tiene sentido en histórico).
  let lastDayWithSale: number | null = null;
  if (!isHistorical) {
    const maxDay = daysWithSale.length ? daysWithSale[daysWithSale.length - 1] : 0;
    lastDayWithSale = maxDay > 0 ? maxDay : null;
  }

  // Fetch dimension data en paralelo. Con max-rows = 50000 en Supabase,
  // single queries con .in([3 anos]) caben sin problema.
  const [
    { data: grupoRowsRaw },
    { data: skuRowsRaw },
    { data: clienteRowsRaw },
    { data: vendedorRowsRaw },
  ] = await Promise.all([
    supabase
      .from("kpi_grupo_summary")
      .select("territorio, grupo, anio, total_venta, total_kg, total_margen")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
    supabase
      .from("kpi_sku_summary")
      .select("territorio, sku, anio, total_venta, total_kg, total_margen")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
    supabase
      .from("kpi_cliente_summary")
      .select("territorio, no_cliente, cliente, anio, total_venta, total_kg, total_margen")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
    supabase
      .from("kpi_vendedor_summary")
      .select("territorio, vendedor, empresa, anio, total_venta, total_kg, total_margen")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
  ]);

  // ============ Queries "al día N" (Mejora 2: comparativos día-vs-día) ============
  // Para cada año comparativo (2024, 2025) calculamos el día calendario tal
  // que countBizDays(year, month, day) === elapsedBizDays_2026. Esto asegura
  // que estamos comparando el MISMO número de días hábiles entre años.
  // Para 2026 el cutoff es daysCurrent (el día calendario actual).
  const cutoff24 = findCalendarDayForBizDays(
    currentYear - 2,
    currentMonth,
    elapsedBizDays
  );
  const cutoff25 = findCalendarDayForBizDays(
    currentYear - 1,
    currentMonth,
    elapsedBizDays
  );
  const cutoff26 = daysCurrent;

  // 4 dimensiones × 3 años = 12 queries paralelas.
  const [
    { data: grupoAlDia24 }, { data: grupoAlDia25 }, { data: grupoAlDia26 },
    { data: skuAlDia24 }, { data: skuAlDia25 }, { data: skuAlDia26 },
    { data: clienteAlDia24 }, { data: clienteAlDia25 }, { data: clienteAlDia26 },
    { data: vendedorAlDia24 }, { data: vendedorAlDia25 }, { data: vendedorAlDia26 },
  ] = await Promise.all([
    // Grupo
    supabase.from("kpi_grupo_diario")
      .select("territorio, grupo, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 2).eq("mes", currentMonth).lte("dia", cutoff24),
    supabase.from("kpi_grupo_diario")
      .select("territorio, grupo, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 1).eq("mes", currentMonth).lte("dia", cutoff25),
    supabase.from("kpi_grupo_diario")
      .select("territorio, grupo, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear).eq("mes", currentMonth).lte("dia", cutoff26),
    // SKU
    supabase.from("kpi_sku_diario")
      .select("territorio, sku, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 2).eq("mes", currentMonth).lte("dia", cutoff24),
    supabase.from("kpi_sku_diario")
      .select("territorio, sku, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 1).eq("mes", currentMonth).lte("dia", cutoff25),
    supabase.from("kpi_sku_diario")
      .select("territorio, sku, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear).eq("mes", currentMonth).lte("dia", cutoff26),
    // Cliente — incluye no_cliente para que el tab Perdidos pueda mergear
    // los acumulados al-día N por cliente único (no por nombre, que puede
    // colisionar entre clientes distintos con el mismo nombre).
    supabase.from("kpi_cliente_diario")
      .select("territorio, no_cliente, cliente, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 2).eq("mes", currentMonth).lte("dia", cutoff24),
    supabase.from("kpi_cliente_diario")
      .select("territorio, no_cliente, cliente, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 1).eq("mes", currentMonth).lte("dia", cutoff25),
    supabase.from("kpi_cliente_diario")
      .select("territorio, no_cliente, cliente, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear).eq("mes", currentMonth).lte("dia", cutoff26),
    // Vendedor
    supabase.from("kpi_vendedor_diario")
      .select("territorio, vendedor, empresa, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 2).eq("mes", currentMonth).lte("dia", cutoff24),
    supabase.from("kpi_vendedor_diario")
      .select("territorio, vendedor, empresa, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear - 1).eq("mes", currentMonth).lte("dia", cutoff25),
    supabase.from("kpi_vendedor_diario")
      .select("territorio, vendedor, empresa, anio, total_venta, total_kg, total_margen")
      .eq("anio", currentYear).eq("mes", currentMonth).lte("dia", cutoff26),
  ]);

  // Combinar las 3 queries de cada dimensión en 1 array para mergeAlDia
  const grupoAlDiaAll = [
    ...(grupoAlDia24 ?? []),
    ...(grupoAlDia25 ?? []),
    ...(grupoAlDia26 ?? []),
  ];
  const skuAlDiaAll = [
    ...(skuAlDia24 ?? []),
    ...(skuAlDia25 ?? []),
    ...(skuAlDia26 ?? []),
  ];
  const clienteAlDiaAll = [
    ...(clienteAlDia24 ?? []),
    ...(clienteAlDia25 ?? []),
    ...(clienteAlDia26 ?? []),
  ];
  const vendedorAlDiaAll = [
    ...(vendedorAlDia24 ?? []),
    ...(vendedorAlDia25 ?? []),
    ...(vendedorAlDia26 ?? []),
  ];

  // Fetch cliente data para tab Perdidos via vista kpi_cliente_perdidos
  // (pre-agregada con mes actual y YTD: venta + kg + margen).
  // Traemos 3 años: 2024 (informativo, columna extra en tabla), 2025
  // (referencia base de status), 2026 (mes actual).
  // En paralelo: kpi_cliente_lifecycle para distinguir clientes
  // "Nuevo" (primera compra ≤90 días) vs "Recuperado" (volvió después
  // de >90 días sin comprar).
  const [
    { data: clientePerdidosRows },
    { data: clienteLifecycleRows },
  ] = await Promise.all([
    supabase
      .from("kpi_cliente_perdidos")
      .select(
        "anio, no_cliente, cliente, vendedor, territorio, mes_venta, mes_kg, mes_margen, ytd_venta, ytd_kg, ytd_margen"
      )
      .in("anio", [currentYear - 2, currentYear - 1, currentYear]),
    supabase
      .from("kpi_cliente_lifecycle")
      .select("no_cliente, first_purchase_date, last_purchase_date"),
  ]);

  // Map UPPER(no_cliente) → first_purchase_date (la más temprana). Se normaliza
  // a mayúsculas porque no_cliente trae casing inconsistente en datos viejos
  // (mismo número como CL-/cl-/Cl-) y la vista de perdidos usa el canónico
  // MIN(UPPER(no_cliente)) como representativo.
  const firstPurchaseByClient = new Map<string, string>();
  for (const r of clienteLifecycleRows ?? []) {
    if (r.no_cliente && r.first_purchase_date) {
      const k = r.no_cliente.toUpperCase();
      const existing = firstPurchaseByClient.get(k);
      if (!existing || r.first_purchase_date < existing) {
        firstPurchaseByClient.set(k, r.first_purchase_date);
      }
    }
  }

  // Build datasets para grupos, clientes y vendedores via helper genérico.
  // Después mergeamos los acumulados "al día N" para los charts con
  // sombreado YoY día-vs-día (Mejora 2).
  const gruposBase = buildDimDataset(
    grupoRowsRaw,
    (r) => r.grupo,
    currentYear
  );
  const grupos = mergeAlDiaIntoDataset(
    gruposBase,
    grupoAlDiaAll,
    (r: { grupo: string }) => r.grupo,
    currentYear
  );

  const clientesBase = buildDimDataset(
    clienteRowsRaw,
    (r) => r.cliente,
    currentYear
  );
  const clientes = mergeAlDiaIntoDataset(
    clientesBase,
    clienteAlDiaAll,
    (r: { cliente: string }) => r.cliente,
    currentYear
  );
  // Vendedores: 2 datasets para soportar toggle Sus/Suve
  // Separados (con sufijo): replica V2.2, una fila por (vendedor, empresa)
  const vendedoresSeparadosBase = buildDimDataset(
    vendedorRowsRaw,
    (r) => `${r.vendedor} (${r.empresa === 0 ? "Sus" : "Suve"})`,
    currentYear
  );
  const vendedoresSeparados = mergeAlDiaIntoDataset(
    vendedoresSeparadosBase,
    vendedorAlDiaAll,
    (r: { vendedor: string; empresa: number }) =>
      `${r.vendedor} (${r.empresa === 0 ? "Sus" : "Suve"})`,
    currentYear
  );
  // Unidos (sin sufijo): aggrega ambas empresas por persona
  const vendedoresUnidosBase = buildDimDataset(
    vendedorRowsRaw,
    (r) => r.vendedor,
    currentYear
  );
  const vendedoresUnidos = mergeAlDiaIntoDataset(
    vendedoresUnidosBase,
    vendedorAlDiaAll,
    (r: { vendedor: string }) => r.vendedor,
    currentYear
  );
  const vendedores = {
    separados: vendedoresSeparados,
    unidos: vendedoresUnidos,
  };

  // ============ Perdidos (Tab Perdidos) ============
  // Aggregate por (territorio, no_cliente) — 3 anios (2024/2025/2026) con
  // venta + kg + margen, dimensiones mes y ytd.
  //   - 2024: SOLO informativo (columna extra en tabla)
  //   - 2025: referencia base para calcular status
  //   - 2026: mes actual
  const cy = currentYear;
  const py = currentYear - 1;
  const py2 = currentYear - 2;

  type ClienteAcc = {
    cliente: string;
    vendedor: string;
    no_cliente: string;
    mes_venta_2024: number;
    mes_venta_2025: number;
    mes_venta_2026: number;
    mes_kg_2024: number;
    mes_kg_2025: number;
    mes_kg_2026: number;
    mes_margen_2024: number;
    mes_margen_2025: number;
    mes_margen_2026: number;
    ytd_venta_2024: number;
    ytd_venta_2025: number;
    ytd_venta_2026: number;
    ytd_kg_2024: number;
    ytd_kg_2025: number;
    ytd_kg_2026: number;
    ytd_margen_2024: number;
    ytd_margen_2025: number;
    ytd_margen_2026: number;
  };

  const emptyAcc = (cliente: string, vendedor: string): ClienteAcc => ({
    cliente,
    vendedor,
    no_cliente: "",
    mes_venta_2024: 0,
    mes_venta_2025: 0,
    mes_venta_2026: 0,
    mes_kg_2024: 0,
    mes_kg_2025: 0,
    mes_kg_2026: 0,
    mes_margen_2024: 0,
    mes_margen_2025: 0,
    mes_margen_2026: 0,
    ytd_venta_2024: 0,
    ytd_venta_2025: 0,
    ytd_venta_2026: 0,
    ytd_kg_2024: 0,
    ytd_kg_2025: 0,
    ytd_kg_2026: 0,
    ytd_margen_2024: 0,
    ytd_margen_2025: 0,
    ytd_margen_2026: 0,
  });

  const perdidosByTerrCliente = new Map<string, Map<string, ClienteAcc>>();

  for (const row of clientePerdidosRows ?? []) {
    let terrMap = perdidosByTerrCliente.get(row.territorio);
    if (!terrMap) {
      terrMap = new Map();
      perdidosByTerrCliente.set(row.territorio, terrMap);
    }
    // Clave de pivot por NOMBRE (cliente|vendedor), NO por no_cliente: así los
    // 3 años se unen aunque el no_cliente representativo varíe entre años, y se
    // mergean variantes de casing + cuentas Sus/Suve del mismo cliente+vendedor.
    const cliKey = `${row.cliente ?? row.no_cliente}|${row.vendedor ?? "(sin vendedor)"}`;
    const cur =
      terrMap.get(cliKey) ??
      emptyAcc(row.cliente ?? row.no_cliente, row.vendedor ?? "(sin vendedor)");
    cur.no_cliente = row.no_cliente; // representativo (MIN(UPPER) de la vista)
    const mv = Number(row.mes_venta) || 0;
    const mk = Number(row.mes_kg) || 0;
    const mm = Number(row.mes_margen ?? 0) || 0;
    const yv = Number(row.ytd_venta) || 0;
    const yk = Number(row.ytd_kg) || 0;
    const ym = Number(row.ytd_margen ?? 0) || 0;
    if (row.anio === py2) {
      cur.mes_venta_2024 = mv;
      cur.mes_kg_2024 = mk;
      cur.mes_margen_2024 = mm;
      cur.ytd_venta_2024 = yv;
      cur.ytd_kg_2024 = yk;
      cur.ytd_margen_2024 = ym;
    } else if (row.anio === py) {
      cur.mes_venta_2025 = mv;
      cur.mes_kg_2025 = mk;
      cur.mes_margen_2025 = mm;
      cur.ytd_venta_2025 = yv;
      cur.ytd_kg_2025 = yk;
      cur.ytd_margen_2025 = ym;
    } else if (row.anio === cy) {
      cur.mes_venta_2026 = mv;
      cur.mes_kg_2026 = mk;
      cur.mes_margen_2026 = mm;
      cur.ytd_venta_2026 = yv;
      cur.ytd_kg_2026 = yk;
      cur.ytd_margen_2026 = ym;
    }
    terrMap.set(cliKey, cur);
  }

  const accToRow = (c: ClienteAcc): PerdidoRow => ({
    no_cliente: c.no_cliente,
    cliente: c.cliente,
    vendedor: c.vendedor,
    // 2024 (informativo)
    mes_venta_2024: c.mes_venta_2024,
    mes_kg_2024: c.mes_kg_2024,
    mes_margen_2024: c.mes_margen_2024,
    ytd_venta_2024: c.ytd_venta_2024,
    ytd_kg_2024: c.ytd_kg_2024,
    ytd_margen_2024: c.ytd_margen_2024,
    // 2025 (referencia base)
    mes_venta_2025: c.mes_venta_2025,
    mes_kg_2025: c.mes_kg_2025,
    mes_margen_2025: c.mes_margen_2025,
    ytd_venta_2025: c.ytd_venta_2025,
    ytd_kg_2025: c.ytd_kg_2025,
    ytd_margen_2025: c.ytd_margen_2025,
    // 2026 (mes actual)
    mes_venta_2026: c.mes_venta_2026,
    mes_kg_2026: c.mes_kg_2026,
    mes_margen_2026: c.mes_margen_2026,
    ytd_venta_2026: c.ytd_venta_2026,
    ytd_kg_2026: c.ytd_kg_2026,
    ytd_margen_2026: c.ytd_margen_2026,
    // Lifecycle: primera fecha de compra histórica (cualquier territorio,
    // cualquier empresa). Usado para distinguir "Nuevo" vs "Recuperado".
    first_purchase_date: firstPurchaseByClient.get(c.no_cliente) ?? null,
  });

  const perdidosByTerritory: Record<string, PerdidoRow[]> = {};
  const totalCliente = new Map<string, ClienteAcc>();
  for (const [terr, clienteMap] of perdidosByTerrCliente) {
    perdidosByTerritory[terr] = Array.from(clienteMap.values()).map((c) =>
      accToRow(c)
    );
    for (const [id, c] of clienteMap) {
      const cur = totalCliente.get(id) ?? emptyAcc(c.cliente, c.vendedor);
      cur.no_cliente = c.no_cliente;
      // 2024
      cur.mes_venta_2024 += c.mes_venta_2024;
      cur.mes_kg_2024 += c.mes_kg_2024;
      cur.mes_margen_2024 += c.mes_margen_2024;
      cur.ytd_venta_2024 += c.ytd_venta_2024;
      cur.ytd_kg_2024 += c.ytd_kg_2024;
      cur.ytd_margen_2024 += c.ytd_margen_2024;
      // 2025
      cur.mes_venta_2025 += c.mes_venta_2025;
      cur.mes_kg_2025 += c.mes_kg_2025;
      cur.mes_margen_2025 += c.mes_margen_2025;
      cur.ytd_venta_2025 += c.ytd_venta_2025;
      cur.ytd_kg_2025 += c.ytd_kg_2025;
      cur.ytd_margen_2025 += c.ytd_margen_2025;
      // 2026
      cur.mes_venta_2026 += c.mes_venta_2026;
      cur.mes_kg_2026 += c.mes_kg_2026;
      cur.mes_margen_2026 += c.mes_margen_2026;
      cur.ytd_venta_2026 += c.ytd_venta_2026;
      cur.ytd_kg_2026 += c.ytd_kg_2026;
      cur.ytd_margen_2026 += c.ytd_margen_2026;
      totalCliente.set(id, cur);
    }
  }
  const perdidosTotal: PerdidoRow[] = Array.from(totalCliente.values()).map(
    (c) => accToRow(c)
  );
  const perdidos: PerdidosDataset = {
    byTerritory: perdidosByTerritory,
    total: perdidosTotal,
  };

  // ============ Mejora 2 Commit C: PerdidoRow con datos al-día =============
  // Construir Map<no_cliente, Map<anio, {venta, kg}>> con acumulado AL MISMO
  // DÍA LABORAL del mes 2026 actual. Por territorio (para byTerritory) y
  // total (sumando todos los territorios).
  type AlDiaCliente = { v: number; k: number; m: number };
  const alDiaByTerrCliAnio = new Map<
    string,
    Map<string, Map<number, AlDiaCliente>>
  >();
  const alDiaTotalCliAnio = new Map<string, Map<number, AlDiaCliente>>();

  for (const row of clienteAlDiaAll) {
    if (!row.no_cliente) continue;
    const v = Number(row.total_venta) || 0;
    const k = Number(row.total_kg ?? 0) || 0;
    const mg = Number(row.total_margen ?? 0) || 0;
    // Por territorio
    let terrMap = alDiaByTerrCliAnio.get(row.territorio);
    if (!terrMap) {
      terrMap = new Map();
      alDiaByTerrCliAnio.set(row.territorio, terrMap);
    }
    let cliMap = terrMap.get(row.no_cliente);
    if (!cliMap) {
      cliMap = new Map();
      terrMap.set(row.no_cliente, cliMap);
    }
    const cur = cliMap.get(row.anio) ?? { v: 0, k: 0, m: 0 };
    cur.v += v;
    cur.k += k;
    cur.m += mg;
    cliMap.set(row.anio, cur);
    // Total (sumando across territorios)
    let totMap = alDiaTotalCliAnio.get(row.no_cliente);
    if (!totMap) {
      totMap = new Map();
      alDiaTotalCliAnio.set(row.no_cliente, totMap);
    }
    const tcur = totMap.get(row.anio) ?? { v: 0, k: 0, m: 0 };
    tcur.v += v;
    tcur.k += k;
    tcur.m += mg;
    totMap.set(row.anio, tcur);
  }

  // Mergear al-día en cada PerdidoRow (3 años: 2024, 2025, 2026 + margen)
  const applyAlDia = (r: PerdidoRow, cliMap: Map<number, AlDiaCliente> | undefined) => {
    const a24 = cliMap?.get(currentYear - 2);
    const a25 = cliMap?.get(currentYear - 1);
    const a26 = cliMap?.get(currentYear);
    r.mes_venta_alDia_2024 = a24?.v ?? 0;
    r.mes_venta_alDia_2025 = a25?.v ?? 0;
    r.mes_venta_alDia_2026 = a26?.v ?? 0;
    r.mes_kg_alDia_2024 = a24?.k ?? 0;
    r.mes_kg_alDia_2025 = a25?.k ?? 0;
    r.mes_kg_alDia_2026 = a26?.k ?? 0;
    r.mes_margen_alDia_2024 = a24?.m ?? 0;
    r.mes_margen_alDia_2025 = a25?.m ?? 0;
    r.mes_margen_alDia_2026 = a26?.m ?? 0;
  };
  for (const [terr, rows] of Object.entries(perdidos.byTerritory)) {
    const terrMap = alDiaByTerrCliAnio.get(terr);
    for (const r of rows) applyAlDia(r, terrMap?.get(r.no_cliente));
  }
  for (const r of perdidos.total) {
    applyAlDia(r, alDiaTotalCliAnio.get(r.no_cliente));
  }

  // ============ SKUs (Tab Productos) ============
  // Necesitamos venta, kilos y margen por SKU x territorio x año (mes filter).
  const skusByTerritoryMap = new Map<
    string,
    Map<string, {
      v24: number; v25: number; v26: number;
      k24: number; k25: number; k26: number;
      m24: number; m25: number; m26: number;
    }>
  >();
  for (const row of skuRowsRaw ?? []) {
    let terrMap = skusByTerritoryMap.get(row.territorio);
    if (!terrMap) {
      terrMap = new Map();
      skusByTerritoryMap.set(row.territorio, terrMap);
    }
    const cur = terrMap.get(row.sku) ?? {
      v24: 0, v25: 0, v26: 0,
      k24: 0, k25: 0, k26: 0,
      m24: 0, m25: 0, m26: 0,
    };
    const v = Number(row.total_venta) || 0;
    const k = Number(row.total_kg) || 0;
    const mg = Number(row.total_margen) || 0;
    // SUMAR (no asignar) — mismo razonamiento que buildDimDataset: si hay
    // múltiples rows que mapean al mismo SKU (ej. mismo SKU en varios meses
    // dentro del mismo año, ya que la vista trae rows por mes), debemos
    // sumarlos en lugar de sobreescribir con el último.
    if (row.anio === currentYear - 2) {
      cur.v24 += v; cur.k24 += k; cur.m24 += mg;
    } else if (row.anio === currentYear - 1) {
      cur.v25 += v; cur.k25 += k; cur.m25 += mg;
    } else if (row.anio === currentYear) {
      cur.v26 += v; cur.k26 += k; cur.m26 += mg;
    }
    terrMap.set(row.sku, cur);
  }

  const skusByTerritory: Record<string, DimensionRow[]> = {};
  const totalSkusMap = new Map<
    string,
    {
      v24: number; v25: number; v26: number;
      k24: number; k25: number; k26: number;
      m24: number; m25: number; m26: number;
    }
  >();
  for (const [terr, skuMap] of skusByTerritoryMap) {
    skusByTerritory[terr] = Array.from(skuMap.entries()).map(
      ([name, data]) => ({ name, ...data })
    );
    for (const [name, data] of skuMap) {
      const cur = totalSkusMap.get(name) ?? {
        v24: 0, v25: 0, v26: 0,
        k24: 0, k25: 0, k26: 0,
        m24: 0, m25: 0, m26: 0,
      };
      cur.v24 += data.v24; cur.v25 += data.v25; cur.v26 += data.v26;
      cur.k24 += data.k24; cur.k25 += data.k25; cur.k26 += data.k26;
      cur.m24 += data.m24; cur.m25 += data.m25; cur.m26 += data.m26;
      totalSkusMap.set(name, cur);
    }
  }
  const skusTotal: DimensionRow[] = Array.from(totalSkusMap.entries()).map(
    ([name, data]) => ({ name, ...data })
  );
  // Mergear acumulados al-día N para los charts con sombreado YoY (Mejora 2)
  const skus: DimensionDataset = mergeAlDiaIntoDataset(
    {
      byTerritory: skusByTerritory,
      total: skusTotal,
    },
    skuAlDiaAll,
    (r: { sku: string }) => r.sku,
    currentYear
  );

  // states es la fuente de verdad para la lista completa de territorios.
  const uniqueNames = (states ?? []).map((s) => s.territory_name);

  // Agrega del summary: current month + prev year same month + acum por año
  const kpiByTerritory = new Map<string, TerritoryKpi>();
  const ensureT = (name: string): TerritoryKpi => {
    if (!kpiByTerritory.has(name)) {
      kpiByTerritory.set(name, emptyKpi());
    }
    return kpiByTerritory.get(name)!;
  };

  for (const row of monthlySummary ?? []) {
    const t = ensureT(row.territorio);
    const v = Number(row.total_venta) || 0;
    const m = Number(row.total_margen) || 0;
    const k = Number(row.total_kg) || 0;

    // Acum yearly (cualquier mes de cada año)
    t.acumByYear[row.anio] = (t.acumByYear[row.anio] ?? 0) + v;

    // Monthly breakdown completo (para tab Ventas)
    t.monthly.push({
      anio: row.anio,
      mes: row.mes,
      venta: v,
      margen: m,
      kg: k,
    });

    // Current month
    if (row.anio === currentYear && row.mes === currentMonth) {
      t.venta += v;
      t.margen += m;
      t.kg += k;
    }
    // Prev year same month
    if (row.anio === currentYear - 1 && row.mes === currentMonth) {
      t.prevYear.venta += v;
      t.prevYear.margen += m;
      t.prevYear.kg += k;
    }
  }

  // Daily breakdown — current month
  for (const row of dailyCurrent ?? []) {
    const t = ensureT(row.territorio);
    const day = new Date(row.fecha + "T12:00:00").getDate();
    t.daily.current.push({
      d: day,
      v: Number(row.total_venta) || 0,
      m: Number(row.total_margen) || 0,
      k: Number(row.total_kg) || 0,
    });
  }
  // Daily breakdown — prev year same month
  for (const row of dailyPrevYear ?? []) {
    const t = ensureT(row.territorio);
    const day = new Date(row.fecha + "T12:00:00").getDate();
    t.daily.prevYear.push({
      d: day,
      v: Number(row.total_venta) || 0,
      m: Number(row.total_margen) || 0,
      k: Number(row.total_kg) || 0,
    });
  }

  // Acumulados al día N del mes actual por año (Mejora 2 Commit B).
  // Usado por VentasTab para apilar barras del slot del mes actual:
  // segmento sólido = al-día, segmento translúcido = resto hasta cierre.
  const ensureCurrentMonthAlDia = (k: TerritoryKpi) => {
    if (!k.currentMonthAlDia) {
      k.currentMonthAlDia = {
        v24: 0, v25: 0, v26: 0,
        m24: 0, m25: 0, m26: 0,
        k24: 0, k25: 0, k26: 0,
      };
    }
    return k.currentMonthAlDia;
  };
  // 2024 (cutoff24)
  for (const row of dailyPrev2Year ?? []) {
    const day = new Date(row.fecha + "T12:00:00").getDate();
    if (day > cutoff24) continue;
    const t = ensureT(row.territorio);
    const ald = ensureCurrentMonthAlDia(t);
    ald.v24 += Number(row.total_venta) || 0;
    ald.m24 += Number(row.total_margen) || 0;
    ald.k24 += Number(row.total_kg) || 0;
  }
  // 2025 (cutoff25) — aprovechamos dailyPrevYear que ya tenemos cargado
  for (const row of dailyPrevYear ?? []) {
    const day = new Date(row.fecha + "T12:00:00").getDate();
    if (day > cutoff25) continue;
    const t = ensureT(row.territorio);
    const ald = ensureCurrentMonthAlDia(t);
    ald.v25 += Number(row.total_venta) || 0;
    ald.m25 += Number(row.total_margen) || 0;
    ald.k25 += Number(row.total_kg) || 0;
  }
  // 2026 (cutoff26 = daysCurrent) — aprovechamos dailyCurrent ya cargado
  for (const row of dailyCurrent ?? []) {
    const day = new Date(row.fecha + "T12:00:00").getDate();
    if (day > cutoff26) continue;
    const t = ensureT(row.territorio);
    const ald = ensureCurrentMonthAlDia(t);
    ald.v26 += Number(row.total_venta) || 0;
    ald.m26 += Number(row.total_margen) || 0;
    ald.k26 += Number(row.total_kg) || 0;
  }

  for (const [name, k] of kpiByTerritory) {
    kpiByTerritory.set(name, withMarginPct(k));
  }

  const stateByName = new Map(
    (states ?? []).map((s) => [s.territory_name, s])
  );

  // Mapa de presupuestos del mes actual por territorio
  const budgetByTerritory = new Map<string, number>();
  for (const row of budgetRows ?? []) {
    budgetByTerritory.set(
      row.territorio,
      Number(row.venta_budget) || 0
    );
  }

  const territories: Territory[] = uniqueNames.map((name) => {
    const s = stateByName.get(name);
    return {
      name,
      isActive: s?.is_active ?? true,
      reason: s?.reason ?? null,
      kpi: kpiByTerritory.get(name) ?? emptyKpi(),
      ventaBudget: budgetByTerritory.get(name) ?? 0,
    };
  });

  // Total de PTTO de venta = suma de presupuestos de todos los territorios
  // visibles del mes actual.
  const totalVentaBudget = Array.from(budgetByTerritory.values()).reduce(
    (a, b) => a + b,
    0
  );

  // Total: suma de TODOS los territorios visibles (current month + prev year + acum + daily).
  // Daily se agrega por día sumando todos los territorios para ese día.
  const totalDailyCurrentMap = new Map<number, { v: number; m: number; k: number }>();
  const totalDailyPrevMap = new Map<number, { v: number; m: number; k: number }>();
  for (const k of kpiByTerritory.values()) {
    for (const p of k.daily.current) {
      const cur = totalDailyCurrentMap.get(p.d) ?? { v: 0, m: 0, k: 0 };
      cur.v += p.v; cur.m += p.m; cur.k += p.k;
      totalDailyCurrentMap.set(p.d, cur);
    }
    for (const p of k.daily.prevYear) {
      const cur = totalDailyPrevMap.get(p.d) ?? { v: 0, m: 0, k: 0 };
      cur.v += p.v; cur.m += p.m; cur.k += p.k;
      totalDailyPrevMap.set(p.d, cur);
    }
  }
  const sortedDays = (m: Map<number, { v: number; m: number; k: number }>) =>
    Array.from(m.entries())
      .sort(([a], [b]) => a - b)
      .map(([d, agg]) => ({ d, v: agg.v, m: agg.m, k: agg.k }));

  // Monthly agregado para "Todos": sumar todos los territorios por (anio, mes).
  const totalMonthlyMap = new Map<string, MonthlyPoint>();
  for (const k of kpiByTerritory.values()) {
    for (const p of k.monthly) {
      const key = `${p.anio}-${p.mes}`;
      const cur = totalMonthlyMap.get(key) ?? {
        anio: p.anio,
        mes: p.mes,
        venta: 0,
        margen: 0,
        kg: 0,
      };
      cur.venta += p.venta;
      cur.margen += p.margen;
      cur.kg += p.kg;
      totalMonthlyMap.set(key, cur);
    }
  }
  const sortedMonthly = Array.from(totalMonthlyMap.values()).sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes
  );

  const totalRaw = Array.from(kpiByTerritory.values()).reduce<TerritoryKpi>(
    (acc, k) => {
      const acumByYear = { ...acc.acumByYear };
      for (const [y, v] of Object.entries(k.acumByYear)) {
        const yr = Number(y);
        acumByYear[yr] = (acumByYear[yr] ?? 0) + v;
      }
      // Sumar currentMonthAlDia de cada territorio al total
      const accAld = acc.currentMonthAlDia ?? {
        v24: 0, v25: 0, v26: 0,
        m24: 0, m25: 0, m26: 0,
        k24: 0, k25: 0, k26: 0,
      };
      const kAld = k.currentMonthAlDia ?? {
        v24: 0, v25: 0, v26: 0,
        m24: 0, m25: 0, m26: 0,
        k24: 0, k25: 0, k26: 0,
      };
      const currentMonthAlDia = {
        v24: accAld.v24 + kAld.v24,
        v25: accAld.v25 + kAld.v25,
        v26: accAld.v26 + kAld.v26,
        m24: accAld.m24 + kAld.m24,
        m25: accAld.m25 + kAld.m25,
        m26: accAld.m26 + kAld.m26,
        k24: accAld.k24 + kAld.k24,
        k25: accAld.k25 + kAld.k25,
        k26: accAld.k26 + kAld.k26,
      };
      return {
        venta: acc.venta + k.venta,
        margen: acc.margen + k.margen,
        kg: acc.kg + k.kg,
        marginPct: 0,
        prevYear: {
          venta: acc.prevYear.venta + k.prevYear.venta,
          margen: acc.prevYear.margen + k.prevYear.margen,
          kg: acc.prevYear.kg + k.prevYear.kg,
        },
        acumByYear,
        daily: { current: [], prevYear: [] }, // populamos abajo
        monthly: [],
        currentMonthAlDia,
      };
    },
    emptyKpi()
  );
  totalRaw.daily.current = sortedDays(totalDailyCurrentMap);
  totalRaw.daily.prevYear = sortedDays(totalDailyPrevMap);
  totalRaw.monthly = sortedMonthly;
  const totalKpi = withMarginPct(totalRaw);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <DashboardHeader
        userName={permissions?.full_name ?? user.email ?? "Usuario"}
        userRole={
          permissions?.role
            ? roleLabel(permissions.role)
            : "Sin permisos asignados"
        }
        canEditData={
          !!permissions &&
          ["admin", "director"].includes(permissions.role)
        }
        isAdmin={permissions?.role === "admin"}
        instructivoVisible={appSettings.instructivoVisible}
      />

      <DashboardClient
        territories={territories}
        totalKpi={totalKpi}
        totalVentaBudget={totalVentaBudget}
        currentMonthLabel={currentMonthLabel}
        monthShortYY={monthShortYY}
        prevMonthShortYY={prevMonthShortYY}
        prev2MonthShortYY={prev2MonthShortYY}
        acumYears={ACUM_YEARS}
        daysCurrent={daysCurrent}
        daysTotal={daysTotal}
        elapsedBizDays={elapsedBizDays}
        totalBizDays={totalBizDays}
        currentYear={currentYear}
        currentMonth={currentMonth}
        grupos={grupos}
        skus={skus}
        clientes={clientes}
        vendedores={vendedores}
        perdidos={perdidos}
        isHistorical={isHistorical}
        todayYear={today.year}
        todayMonth={today.month}
        actualTodayDay={today.day}
        asOfDay={asOfDay}
        lastDayWithSale={lastDayWithSale}
        daysWithSale={daysWithSale}
        maxAsOfDay={maxAsOfDay}
        canExportExcel={permissions?.can_export_excel ?? false}
        sessionIdleTimeoutMinutes={appSettings.sessionIdleTimeoutMinutes}
        sessionTimeoutExempt={permissions?.session_timeout_exempt ?? false}
        newCustomerCutoffDate={(() => {
          // Hoy CDMX menos 90 días → fecha ISO YYYY-MM-DD.
          // Cliente "Nuevo" si first_purchase_date >= cutoff.
          const d = new Date(today.year, today.month - 1, today.day);
          d.setDate(d.getDate() - 90);
          return d.toISOString().slice(0, 10);
        })()}
      />
    </div>
  );
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "Administrador",
    director: "Director",
    gerente_regional: "Gerente Regional",
    vendedor: "Vendedor",
  };
  return map[role] ?? role;
}
