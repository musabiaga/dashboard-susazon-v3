import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "../dashboard/DashboardHeader";
import { LoaderClient } from "./LoaderClient";

export default async function CargarDatosPage() {
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

  // Última sincronización exitosa
  const { data: lastSync } = await supabase
    .from("sync_history")
    .select("id, started_at, completed_at, status, rows_imported, source, errors")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Conteo total de filas en sales_rows (visibles para el usuario)
  const { count: totalRows } = await supabase
    .from("sales_rows")
    .select("*", { count: "exact", head: true });

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <DashboardHeader
        userName={perms.full_name}
        userRole={roleLabel(perms.role)}
      />
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <h1
            className="mb-1 text-2xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Cargar datos comerciales
          </h1>
          <p
            className="mb-6 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Refresca los datos desde la API REST de Susazón. La API Key se
            mantiene en el servidor — nunca llega al navegador.
          </p>

          <LoaderClient
            initialLastSync={lastSync ?? null}
            initialTotalRows={totalRows ?? 0}
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
