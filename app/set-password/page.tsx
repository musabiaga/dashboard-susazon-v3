import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SetPasswordClient } from "./SetPasswordClient";

/**
 * Página de "Configurar contraseña". Atiende dos flows:
 *
 *   - from=invite   → primer login (usuario invitado por admin)
 *   - from=recovery → forgot password (usuario existente reseteando)
 *
 * Cuando Supabase manda el email de invite/recovery, el redirectTo
 * que pasamos apunta DIRECTO a /set-password?from=XXX. Pero Supabase
 * también APPEND su propio token al URL:
 *
 *   - PKCE flow (server): ?code=xxx (se intercambia con exchangeCodeForSession)
 *   - Token hash flow:    ?token_hash=xxx&type=YYY (se verifica con verifyOtp)
 *
 * Esta página intercepta esos params, intercambia el token por una sesión
 * server-side (cookies), luego muestra el form de fijar contraseña. Sin esto,
 * el proxy.ts redirigia a /login antes de que el code se pudiera intercambiar
 * (loop).
 *
 * Si el usuario llega aquí SIN params Y SIN sesión (link expirado, acceso
 * directo), lo mandamos a /login con mensaje claro.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  // Si Supabase ya nos mando un error en el URL, propagarlo a /login
  if (sp.error) {
    const detail = sp.error_description ?? sp.error;
    redirect(`/login?error=auth_link_invalid&detail=${encodeURIComponent(detail)}`);
  }

  // Caso A: PKCE flow → intercambiar code por sesión
  if (sp.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(sp.code);
    if (error) {
      redirect(
        `/login?error=auth_link_invalid&detail=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Caso B: Token hash flow → verifyOtp
  if (sp.token_hash && sp.type) {
    const { error } = await supabase.auth.verifyOtp({
      type: sp.type as
        | "invite"
        | "signup"
        | "magiclink"
        | "recovery"
        | "email_change"
        | "email",
      token_hash: sp.token_hash,
    });
    if (error) {
      redirect(
        `/login?error=auth_link_invalid&detail=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Después del exchange, verificar que efectivamente hay sesión activa
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invite_link_expired");
  }

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
