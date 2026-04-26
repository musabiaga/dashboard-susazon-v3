import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RootPage() {
  // Si Supabase no configurado, redirige a /login (el guard del middleware lo deja pasar)
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

  // TODO Fase 2: render del Dashboard real con sidebar + KPIs + tabs
  // Por ahora, una pantalla simple que confirma sesión activa.
  redirect("/dashboard");
}
