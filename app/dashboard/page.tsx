import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardClient } from "./DashboardClient";
import type {
  Territory,
  TerritoryKpi,
  MonthlyPoint,
} from "@/components/dashboard/Sidebar";
import { countBizDays } from "@/lib/business-days";

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
        acumYears={ACUM_YEARS}
        daysCurrent={daysCurrent}
        daysTotal={daysTotal}
        elapsedBizDays={elapsedBizDays}
        totalBizDays={totalBizDays}
        currentYear={currentYear}
        currentMonth={currentMonth}
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
