import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardClient } from "./DashboardClient";
import type {
  Territory,
  TerritoryKpi,
  MonthlyPoint,
} from "@/components/dashboard/Sidebar";
import type { DimensionRow } from "@/components/dashboard/DimensionTab";
import type { PerdidoRow } from "@/components/dashboard/PerdidosTab";
import { countBizDays } from "@/lib/business-days";

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
function buildDimDataset<
  T extends {
    territorio: string;
    anio: number;
    total_venta: number | string | null;
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
    const cur = m.get(name) ?? { name, v24: 0, v25: 0, v26: 0 };
    const v = Number(row.total_venta) || 0;
    if (row.anio === cy - 2) cur.v24 = v;
    else if (row.anio === cy - 1) cur.v25 = v;
    else if (row.anio === cy) cur.v26 = v;
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
      };
      cur.v24 += r.v24;
      cur.v25 += r.v25;
      cur.v26 += r.v26;
      totalMap.set(r.name, cur);
    }
  }
  return { byTerritory, total: Array.from(totalMap.values()) };
}

export default async function DashboardPage() {
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

  // Cargar permisos del usuario
  const { data: permissions } = await supabase
    .from("users_permissions")
    .select("full_name, role, allowed_territories, can_edit_ptto")
    .eq("user_id", user.id)
    .single();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentMonthLabel = `${MONTH_NAMES_ES[now.getMonth()]} ${currentYear}`;
  const monthShortYY = `${MONTH_SHORT_ES[now.getMonth()]} ${currentYear % 100}`;
  const prevMonthShortYY = `${MONTH_SHORT_ES[now.getMonth()]} ${(currentYear - 1) % 100}`;
  const prev2MonthShortYY = `${MONTH_SHORT_ES[now.getMonth()]} ${(currentYear - 2) % 100}`;
  const daysCurrent = now.getDate();
  // Día 0 del mes siguiente = último día del mes actual = días totales.
  const daysTotal = new Date(currentYear, currentMonth, 0).getDate();
  // Días hábiles (L-S menos feriados LFT) — para Tracking Diario.
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
  ]);

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
      .select("territorio, grupo, anio, total_venta")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
    supabase
      .from("kpi_sku_summary")
      .select("territorio, sku, anio, total_venta, total_kg")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
    supabase
      .from("kpi_cliente_summary")
      .select("territorio, no_cliente, cliente, anio, total_venta")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
    supabase
      .from("kpi_vendedor_summary")
      .select("territorio, vendedor, empresa, anio, total_venta")
      .in("anio", [currentYear - 2, currentYear - 1, currentYear])
      .eq("mes", currentMonth),
  ]);

  // Fetch cliente data para tab Perdidos via vista kpi_cliente_perdidos
  // (pre-agregada con mes actual y YTD, ambas dimensiones venta+kg).
  const { data: clientePerdidosRows } = await supabase
    .from("kpi_cliente_perdidos")
    .select(
      "anio, no_cliente, cliente, vendedor, territorio, mes_venta, mes_kg, ytd_venta, ytd_kg"
    )
    .in("anio", [currentYear - 1, currentYear]);

  // Build datasets para grupos, clientes y vendedores via helper genérico
  const grupos = buildDimDataset(
    grupoRowsRaw,
    (r) => r.grupo,
    currentYear
  );
  const clientes = buildDimDataset(
    clienteRowsRaw,
    (r) => r.cliente,
    currentYear
  );
  // Vendedores: 2 datasets para soportar toggle Sus/Suve
  // Separados (con sufijo): replica V2.2, una fila por (vendedor, empresa)
  const vendedoresSeparados = buildDimDataset(
    vendedorRowsRaw,
    (r) => `${r.vendedor} (${r.empresa === 0 ? "Sus" : "Suve"})`,
    currentYear
  );
  // Unidos (sin sufijo): aggrega ambas empresas por persona
  const vendedoresUnidos = buildDimDataset(
    vendedorRowsRaw,
    (r) => r.vendedor,
    currentYear
  );
  const vendedores = {
    separados: vendedoresSeparados,
    unidos: vendedoresUnidos,
  };

  // ============ Perdidos (Tab Perdidos) ============
  // Aggregate por (territorio, no_cliente) — 2 anios → 1 row con 8 numeros.
  // Status (perdido/declive) se calcula en el componente segun la dimension
  // seleccionada (mes vs YTD).
  const cy = currentYear;
  const py = currentYear - 1;

  type ClienteAcc = {
    cliente: string;
    vendedor: string;
    mes_venta_2025: number;
    mes_venta_2026: number;
    mes_kg_2025: number;
    mes_kg_2026: number;
    ytd_venta_2025: number;
    ytd_venta_2026: number;
    ytd_kg_2025: number;
    ytd_kg_2026: number;
  };

  const emptyAcc = (cliente: string, vendedor: string): ClienteAcc => ({
    cliente,
    vendedor,
    mes_venta_2025: 0,
    mes_venta_2026: 0,
    mes_kg_2025: 0,
    mes_kg_2026: 0,
    ytd_venta_2025: 0,
    ytd_venta_2026: 0,
    ytd_kg_2025: 0,
    ytd_kg_2026: 0,
  });

  const perdidosByTerrCliente = new Map<string, Map<string, ClienteAcc>>();

  for (const row of clientePerdidosRows ?? []) {
    let terrMap = perdidosByTerrCliente.get(row.territorio);
    if (!terrMap) {
      terrMap = new Map();
      perdidosByTerrCliente.set(row.territorio, terrMap);
    }
    const cur =
      terrMap.get(row.no_cliente) ??
      emptyAcc(row.cliente ?? row.no_cliente, row.vendedor ?? "(sin vendedor)");
    const mv = Number(row.mes_venta) || 0;
    const mk = Number(row.mes_kg) || 0;
    const yv = Number(row.ytd_venta) || 0;
    const yk = Number(row.ytd_kg) || 0;
    if (row.anio === py) {
      cur.mes_venta_2025 = mv;
      cur.mes_kg_2025 = mk;
      cur.ytd_venta_2025 = yv;
      cur.ytd_kg_2025 = yk;
    } else if (row.anio === cy) {
      cur.mes_venta_2026 = mv;
      cur.mes_kg_2026 = mk;
      cur.ytd_venta_2026 = yv;
      cur.ytd_kg_2026 = yk;
    }
    terrMap.set(row.no_cliente, cur);
  }

  const accToRow = (id: string, c: ClienteAcc): PerdidoRow => ({
    no_cliente: id,
    cliente: c.cliente,
    vendedor: c.vendedor,
    mes_venta_2025: c.mes_venta_2025,
    mes_venta_2026: c.mes_venta_2026,
    mes_kg_2025: c.mes_kg_2025,
    mes_kg_2026: c.mes_kg_2026,
    ytd_venta_2025: c.ytd_venta_2025,
    ytd_venta_2026: c.ytd_venta_2026,
    ytd_kg_2025: c.ytd_kg_2025,
    ytd_kg_2026: c.ytd_kg_2026,
  });

  const perdidosByTerritory: Record<string, PerdidoRow[]> = {};
  const totalCliente = new Map<string, ClienteAcc>();
  for (const [terr, clienteMap] of perdidosByTerrCliente) {
    perdidosByTerritory[terr] = Array.from(clienteMap.entries()).map(
      ([id, c]) => accToRow(id, c)
    );
    for (const [id, c] of clienteMap) {
      const cur = totalCliente.get(id) ?? emptyAcc(c.cliente, c.vendedor);
      cur.mes_venta_2025 += c.mes_venta_2025;
      cur.mes_venta_2026 += c.mes_venta_2026;
      cur.mes_kg_2025 += c.mes_kg_2025;
      cur.mes_kg_2026 += c.mes_kg_2026;
      cur.ytd_venta_2025 += c.ytd_venta_2025;
      cur.ytd_venta_2026 += c.ytd_venta_2026;
      cur.ytd_kg_2025 += c.ytd_kg_2025;
      cur.ytd_kg_2026 += c.ytd_kg_2026;
      totalCliente.set(id, cur);
    }
  }
  const perdidosTotal: PerdidoRow[] = Array.from(totalCliente.entries()).map(
    ([id, c]) => accToRow(id, c)
  );
  const perdidos: PerdidosDataset = {
    byTerritory: perdidosByTerritory,
    total: perdidosTotal,
  };

  // ============ SKUs (Tab Productos) ============
  // Necesitamos venta y kilos por SKU x territorio x año (mes filter).
  const skusByTerritoryMap = new Map<
    string,
    Map<string, {
      v24: number; v25: number; v26: number;
      k24: number; k25: number; k26: number;
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
    };
    const v = Number(row.total_venta) || 0;
    const k = Number(row.total_kg) || 0;
    if (row.anio === currentYear - 2) { cur.v24 = v; cur.k24 = k; }
    else if (row.anio === currentYear - 1) { cur.v25 = v; cur.k25 = k; }
    else if (row.anio === currentYear) { cur.v26 = v; cur.k26 = k; }
    terrMap.set(row.sku, cur);
  }

  const skusByTerritory: Record<string, DimensionRow[]> = {};
  const totalSkusMap = new Map<
    string,
    {
      v24: number; v25: number; v26: number;
      k24: number; k25: number; k26: number;
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
      };
      cur.v24 += data.v24; cur.v25 += data.v25; cur.v26 += data.v26;
      cur.k24 += data.k24; cur.k25 += data.k25; cur.k26 += data.k26;
      totalSkusMap.set(name, cur);
    }
  }
  const skusTotal: DimensionRow[] = Array.from(totalSkusMap.entries()).map(
    ([name, data]) => ({ name, ...data })
  );
  const skus: DimensionDataset = {
    byTerritory: skusByTerritory,
    total: skusTotal,
  };

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
