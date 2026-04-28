import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../dashboard/DashboardHeader";
import { LoaderClient } from "./LoaderClient";
import {
  BudgetEditorClient,
  type BudgetCell,
} from "./BudgetEditorClient";

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027];

export default async function CargarDatosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
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

  if (!user) redirect("/login");

  const { data: perms } = await supabase
    .from("users_permissions")
    .select("full_name, role, can_edit_ptto")
    .eq("user_id", user.id)
    .single();

  if (!perms || !["admin", "director"].includes(perms.role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const editorYear =
    parseInt(sp.year ?? "", 10) || new Date().getFullYear();
  const safeEditorYear = AVAILABLE_YEARS.includes(editorYear)
    ? editorYear
    : new Date().getFullYear();

  // Pull en paralelo: última sync, conteo total, lista territorios, presupuestos
  // del año seleccionado.
  // OJO: territories vienen de territories_state (auto-poblado por trigger),
  // NO de distinct sobre sales_rows — esto evita el límite default de 1000
  // filas que Supabase aplica a SELECT.
  const [
    { data: lastSync },
    { count: totalRows },
    { data: stateRows },
    { data: budgetRows },
  ] = await Promise.all([
    supabase
      .from("sync_history")
      .select("id, started_at, completed_at, status, rows_imported, source, errors")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sales_rows")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("territories_state")
      .select("territory_name")
      .order("territory_name"),
    supabase
      .from("territory_budgets")
      .select("territorio, mes, venta_budget")
      .eq("anio", safeEditorYear),
  ]);

  const territories = (stateRows ?? []).map((r) => r.territory_name);

  const initialBudgets: BudgetCell[] = (budgetRows ?? []).map((b) => ({
    territorio: b.territorio,
    mes: b.mes,
    venta_budget: Number(b.venta_budget) || 0,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <DashboardHeader
        userName={perms.full_name}
        userRole={roleLabel(perms.role)}
        canEditData={true}
        isAdmin={perms.role === "admin"}
      />
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <h1
              className="mb-1 text-2xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Cargar datos comerciales
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Refresca los datos de las APIs y configura los presupuestos
              mensuales (PTTO) por territorio.
            </p>
          </div>

          <LoaderClient
            initialLastSync={lastSync ?? null}
            initialTotalRows={totalRows ?? 0}
          />

          <BudgetEditorClient
            year={safeEditorYear}
            availableYears={AVAILABLE_YEARS}
            territories={territories}
            initialBudgets={initialBudgets}
          />
        </div>
      </main>
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
