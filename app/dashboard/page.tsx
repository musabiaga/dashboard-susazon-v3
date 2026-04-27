import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardClient } from "./DashboardClient";
import type { Territory, TerritoryKpi } from "@/components/dashboard/Sidebar";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function emptyKpi(): TerritoryKpi {
  return { venta: 0, margen: 0, kg: 0, marginPct: 0 };
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
  const daysCurrent = now.getDate();
  // Día 0 del mes siguiente = último día del mes actual = días totales.
  const daysTotal = new Date(currentYear, currentMonth, 0).getDate();

  // Pull en paralelo: rows del mes actual (para KPIs) + estados globales + presupuestos.
  // Las RLS filtran por permisos del usuario automáticamente en las 3.
  const [{ data: monthRows }, { data: states }, { data: budgetRows }] =
    await Promise.all([
      supabase
        .from("sales_rows")
        .select("territorio, venta, margen, kg")
        .eq("anio", currentYear)
        .eq("mes", currentMonth),
      supabase
        .from("territories_state")
        .select("territory_name, is_active, reason"),
      supabase
        .from("territory_budgets")
        .select("territorio, venta_budget")
        .eq("anio", currentYear)
        .eq("mes", currentMonth),
    ]);

  // También necesito la lista completa de territorios visibles (incluso los
  // que no tienen data en el mes actual, para que aparezcan en sidebar).
  const { data: allTerritoryRows } = await supabase
    .from("sales_rows")
    .select("territorio");
  const uniqueNames = Array.from(
    new Set((allTerritoryRows ?? []).map((r) => r.territorio).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "es"));

  // Agrega KPIs del mes actual por territorio
  const kpiByTerritory = new Map<string, TerritoryKpi>();
  for (const row of monthRows ?? []) {
    if (!kpiByTerritory.has(row.territorio)) {
      kpiByTerritory.set(row.territorio, emptyKpi());
    }
    const k = kpiByTerritory.get(row.territorio)!;
    k.venta += Number(row.venta) || 0;
    k.margen += Number(row.margen) || 0;
    k.kg += Number(row.kg) || 0;
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

  // Total: suma de TODOS los territorios visibles del mes actual.
  // Cuando el admin apaga un territorio, sigue contando para el "Todos" porque
  // RLS no filtra esto — el toggle es solo para mostrar/ocultar visualmente.
  const totalRaw = Array.from(kpiByTerritory.values()).reduce<TerritoryKpi>(
    (acc, k) => ({
      venta: acc.venta + k.venta,
      margen: acc.margen + k.margen,
      kg: acc.kg + k.kg,
      marginPct: 0,
    }),
    emptyKpi()
  );
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
      />

      <DashboardClient
        territories={territories}
        totalKpi={totalKpi}
        totalVentaBudget={totalVentaBudget}
        currentMonthLabel={currentMonthLabel}
        daysCurrent={daysCurrent}
        daysTotal={daysTotal}
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
