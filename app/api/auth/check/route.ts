import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/check
 *
 * Endpoint ligero para polling de sesión desde el cliente. Solo valida el
 * JWT actual contra Supabase. Responde:
 *   - 200 { ok: true } si la sesión es válida
 *   - 401 { ok: false } si fue invalidada (logout admin o token expirado)
 *
 * Lo usa el hook useSessionPolling cada 30 min como safety net del
 * mecanismo "logout remoto desde admin". El mecanismo principal de
 * detección es el middleware (proxy.ts) que valida en cada request real.
 *
 * Configurado como dynamic = "force-dynamic" para que NUNCA se cachee
 * la respuesta (cada request debe validar el token fresco).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
