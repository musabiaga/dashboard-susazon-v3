import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Callback de Supabase Auth.
 *
 * Soporta dos formatos según el flow:
 *
 *   1. PKCE / OAuth: ?code=xxx[&next=/path]
 *      → exchangeCodeForSession(code)
 *
 *   2. Magic Link / Recovery / Invite: ?token_hash=xxx&type=YYY[&next=/path]
 *      → verifyOtp({ token_hash, type })
 *
 * Después de intercambiar exitoso, redirige a `next` (o "/" por default).
 * Para invites específicamente, el invite route pasa redirectTo=/set-password
 * para forzar al usuario a fijar su contraseña antes de entrar.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as
    | "invite"
    | "signup"
    | "magiclink"
    | "recovery"
    | "email_change"
    | "email"
    | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createSupabaseServerClient();

  // Caso 1: PKCE flow (code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed&detail=${encodeURIComponent(error.message)}`
    );
  }

  // Caso 2: Token hash flow (invite, recovery, magiclink, signup)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // Para invite (primer login) y recovery (olvidé contraseña), forzamos
      // el flow de /set-password para que el usuario fije su nueva contraseña
      // explícitamente. Sin esto, recovery entraba directo al dashboard sin
      // pedir nueva contraseña, lo que defeats el proposito del reset.
      const needsPasswordSet = type === "invite" || type === "recovery";
      const redirect = needsPasswordSet ? `/set-password?from=${type}` : next;
      return NextResponse.redirect(`${origin}${redirect}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed&detail=${encodeURIComponent(error.message)}`
    );
  }

  // Sin parámetros válidos
  return NextResponse.redirect(`${origin}/login?error=auth_callback_missing_params`);
}
