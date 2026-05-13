import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { DashboardHeader } from "../dashboard/DashboardHeader";
import { MiCuentaClient } from "./MiCuentaClient";

export const dynamic = "force-dynamic";

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: "Administrador",
    director: "Director",
    gerente_regional: "Gerente Regional",
    vendedor: "Vendedor",
  };
  return map[role] ?? role;
}

export default async function MiCuentaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perms } = await supabase
    .from("users_permissions")
    .select("full_name, role")
    .eq("user_id", user.id)
    .single();

  const appSettings = await getAppSettings();

  const mustChangePassword =
    (user.user_metadata as { must_change_password?: boolean } | null)
      ?.must_change_password === true;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <DashboardHeader
        userName={perms?.full_name ?? user.email ?? "Usuario"}
        userRole={perms?.role ? roleLabel(perms.role) : "Sin permisos"}
        canEditData={
          !!perms && ["admin", "director"].includes(perms.role)
        }
        isAdmin={perms?.role === "admin"}
        instructivoVisible={appSettings.instructivoVisible}
      />
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-xl space-y-4">
          <MiCuentaClient
            userEmail={user.email ?? ""}
            userName={perms?.full_name ?? ""}
            mustChangePassword={mustChangePassword}
          />
        </div>
      </main>
    </div>
  );
}
