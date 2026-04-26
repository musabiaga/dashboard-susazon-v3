import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "./DashboardHeader";

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

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl">
          <div
            className="rounded-[var(--radius-lg)] border p-8"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h1
              className="mb-2 text-2xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Sesión iniciada ✓
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Bienvenido,{" "}
              <strong>{permissions?.full_name ?? user.email}</strong>. Tu rol es{" "}
              <strong>{permissions?.role ?? "(sin asignar)"}</strong>.
            </p>
            <p
              className="mt-4 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Esta es una pantalla placeholder. El dashboard completo (Sidebar +
              KPIs + Tabs) viene en la próxima fase.
            </p>

            {permissions?.allowed_territories && (
              <div
                className="mt-6 rounded-[var(--radius)] p-4"
                style={{
                  background: "var(--bg-surface-muted)",
                  color: "var(--text-primary)",
                }}
              >
                <strong>Territorios permitidos:</strong>{" "}
                {permissions.allowed_territories.length === 0
                  ? "Ninguno asignado todavía"
                  : permissions.allowed_territories.join(", ")}
              </div>
            )}

            {permissions?.allowed_territories === null && (
              <div
                className="mt-6 rounded-[var(--radius)] p-4"
                style={{
                  background: "var(--success-soft)",
                  color: "var(--text-primary)",
                }}
              >
                ✓ Acceso a <strong>todos los territorios</strong> (admin/director).
              </div>
            )}
          </div>
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
