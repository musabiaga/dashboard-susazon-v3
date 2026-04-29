import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetPasswordClient } from "./SetPasswordClient";

/**
 * Página de "Configurar contraseña". Atiende dos flows:
 *
 *   - from=invite   → primer login (usuario invitado por admin)
 *   - from=recovery → forgot password (usuario existente reseteando)
 *
 * IMPORTANTE: cuando el usuario llega aquí, la sesión YA debe estar creada
 * por el callback handler (/api/auth/callback). El callback intercambia el
 * code/token_hash por sesión y setea las cookies (en un Route Handler que
 * SÍ puede mutar cookies). Después redirige a esta página con ?from=YYY.
 *
 * NO intentamos hacer exchange aquí porque los Server Components de Next.js
 * no pueden persistir cookies de sesión al browser. Si lo intentamos, el
 * server ve la sesión en su request, pero el cliente que después intenta
 * updateUser({ password }) ve "Auth session missing!".
 *
 * Si el usuario llega aquí sin sesión activa (link expirado, acceso directo,
 * etc.), lo mandamos a /login con mensaje claro.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invite_link_expired");
  }

  const flow: "invite" | "recovery" =
    sp.from === "recovery" ? "recovery" : "invite";

  // Cargar nombre del usuario de users_permissions para personalizar el saludo
  const { data: perms } = await supabase
    .from("users_permissions")
    .select("full_name, role")
    .eq("user_id", user.id)
    .single();

  return (
    <SetPasswordClient
      email={user.email ?? ""}
      fullName={perms?.full_name ?? null}
      role={perms?.role ?? null}
      flow={flow}
    />
  );
}
