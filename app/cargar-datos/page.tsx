import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMexicoCityDateParts } from "@/lib/business-days";
import { getAppSettings } from "@/lib/app-settings";
import { DashboardHeader } from "../dashboard/DashboardHeader";
import { LoaderClient, type SyncRow } from "./LoaderClient";
import {
  BudgetEditorClient,
  type BudgetCell,
  type RealCell,
  type LastEdit,
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

  const appSettings = await getAppSettings();

  const sp = await searchParams;
  // Año actual en CDMX (UTC-6). Server corre en UTC, ver lib/business-days.ts.
  const currentYearMx = getMexicoCityDateParts().year;
  const editorYear = parseInt(sp.year ?? "", 10) || currentYearMx;
  const safeEditorYear = AVAILABLE_YEARS.includes(editorYear)
    ? editorYear
    : currentYearMx;

  // Pull en paralelo: última sync, conteo total, lista territorios, presupuestos
  // del año seleccionado.
  // OJO: territories vienen de territories_state (auto-poblado por trigger),
  // NO de distinct sobre sales_rows — esto evita el límite default de 1000
  // filas que Supabase aplica a SELECT.
  const prevYear = safeEditorYear - 1;
  const [
    { data: historyRows },
    { count: totalRows },
    { data: stateRows },
    { data: budgetRows },
    { data: realRows },
    { data: prevBudgetRows },
    { data: lastEditRow },
  ] = await Promise.all([
    // Últimas 10 corridas (manuales + automáticas). La primera es "la última".
    supabase
      .from("sync_history")
      .select(
        "id, started_at, completed_at, status, rows_imported, source, errors, date_from, date_to, details"
      )
      .order("started_at", { ascending: false })
      .limit(10),
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
    // V4.4 — Real del año anterior por territorio/mes (≤ 17 × 12 filas) como
    // referencia para fijar metas. Vista security_invoker → respeta RLS.
    supabase
      .from("kpi_monthly_summary")
      .select("territorio, mes, total_venta")
      .eq("anio", prevYear),
    // Metas del año anterior (para "copiar meta año anterior +X%").
    supabase
      .from("territory_budgets")
      .select("territorio, mes, venta_budget")
      .eq("anio", prevYear),
    // Última edición del año seleccionado.
    supabase
      .from("territory_budgets")
      .select("updated_at, updated_by")
      .eq("anio", safeEditorYear)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const prevYearReal: RealCell[] = (realRows ?? []).map((r) => ({
    territorio: r.territorio,
    mes: r.mes,
    venta: Number(r.total_venta) || 0,
  }));
  const prevYearBudgets: BudgetCell[] = (prevBudgetRows ?? []).map((b) => ({
    territorio: b.territorio,
    mes: b.mes,
    venta_budget: Number(b.venta_budget) || 0,
  }));

  let lastEdit: LastEdit | null = null;
  if (lastEditRow?.updated_at) {
    let by: string | null = null;
    if (lastEditRow.updated_by) {
      const { data: editor } = await supabase
        .from("users_permissions")
        .select("full_name")
        .eq("user_id", lastEditRow.updated_by)
        .maybeSingle();
      by = editor?.full_name ?? null;
    }
    lastEdit = { at: lastEditRow.updated_at, by };
  }
  const todayMx = getMexicoCityDateParts();
  const currentMonth = safeEditorYear === todayMx.year ? todayMx.month : null;

  const territories = (stateRows ?? []).map((r) => r.territory_name);

  const syncHistory: SyncRow[] = (historyRows ?? []).map((r) => ({
    id: r.id,
    started_at: r.started_at,
    completed_at: r.completed_at,
    status: r.status,
    rows_imported: r.rows_imported,
    source: r.source,
    errors: Array.isArray(r.errors) ? (r.errors as unknown[]) : null,
    date_from: r.date_from,
    date_to: r.date_to,
    trigger:
      (r.details as { trigger?: string } | null)?.trigger === "cron"
        ? "cron"
        : "manual",
  }));
  const lastSync = syncHistory[0] ?? null;

  // Solo un booleano llega al cliente — nunca el valor del secreto.
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);

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
        instructivoVisible={appSettings.instructivoVisible}
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
            initialLastSync={lastSync}
            initialTotalRows={totalRows ?? 0}
            initialHistory={syncHistory}
            syncAutoEnabled={appSettings.syncAutoEnabled}
            cronSecretConfigured={cronSecretConfigured}
          />

          <BudgetEditorClient
            year={safeEditorYear}
            availableYears={AVAILABLE_YEARS}
            territories={territories}
            initialBudgets={initialBudgets}
            prevYearReal={prevYearReal}
            prevYearBudgets={prevYearBudgets}
            lastEdit={lastEdit}
            currentMonth={currentMonth}
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
