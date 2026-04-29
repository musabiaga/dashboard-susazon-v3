import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetPasswordClient } from "./SetPasswordClient";

/**
 * Página de "Configurar contraseña". Atiende dos flows:
 *
 *   - from=invite   → primer login (usuario invitado por admin)
 *   - from=recovery → forgot password (usuario existente reseteando)
 *
 * En ambos casos el callback ya verificó el token y creó sesión. Esta página
 * fuerza al usuario a fijar (o cambiar) su contraseña con doble confirmación
 * antes de poder usar la app.
 *
 * Si el usuario llega aquí SIN sesión activa (link expirado, acceso directo),
 * lo mandamos a /login con mensaje claro.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invite_link_expired");
  }

  const sp = await searchParams;
  const flow: "invite" | "recovery" =
    sp.from === "recovery" ? "recovery" : "invite";

  // Cargar el nombre del usuario de users_permissions para personalizar el saludo
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
