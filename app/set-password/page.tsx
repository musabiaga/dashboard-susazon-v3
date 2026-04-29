import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetPasswordClient } from "./SetPasswordClient";

/**
 * Página de "Configurar contraseña" — el invitado llega aquí desde el Magic Link
 * de la invitación. El callback ya verificó el token y creó sesión.
 *
 * Si el usuario llega aquí SIN sesión activa (acceso directo, link expirado,
 * etc.), lo mandamos a /login con un mensaje claro.
 */
export default async function SetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invite_link_expired");
  }

  // Cargar el nombre del invitado de users_permissions para personalizar el saludo
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
    />
  );
}
