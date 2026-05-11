import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { DashboardHeader } from "../dashboard/DashboardHeader";
import { AdminTabs } from "./AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
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
    .select("full_name, role")
    .eq("user_id", user.id)
    .single();

  if (!perms || perms.role !== "admin") {
    redirect("/dashboard");
  }

  const appSettings = await getAppSettings();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <DashboardHeader
        userName={perms.full_name}
        userRole="Administrador"
        canEditData={true}
        isAdmin={true}
        instructivoVisible={appSettings.instructivoVisible}
      />
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Panel de Administración
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Solo accesible para usuarios con rol Administrador.
            </p>
          </div>
          <AdminTabs />
          {children}
        </div>
      </main>
    </div>
  );
}
