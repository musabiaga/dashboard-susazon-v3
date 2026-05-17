import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

interface SessionTimeoutBody {
  /** Minutos de inactividad. null = sin timeout. Valores válidos: 35, 45,
   *  60, 90, 120. El backend valida estrictamente. */
  minutes: number | null;
}

const ALLOWED_VALUES = new Set([null, 35, 45, 60, 90, 120]);

/**
 * POST /api/admin/settings/session-timeout
 *
 * Actualiza el timeout global de inactividad. Solo admin.
 *
 * Body: { minutes: 35 | 45 | 60 | 90 | 120 | null }
 *
 * Cuando se cambia, los clientes leerán el nuevo valor en su próximo refresh
 * de página. Los hooks frontend toman el valor en el render inicial. No hay
 * push en vivo (los usuarios actuales siguen con el valor previo hasta que
 * recarguen). Es aceptable para este caso.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as
    | Partial<SessionTimeoutBody>
    | null;

  // null es un valor válido (sin timeout). Solo rechazamos si el campo no
  // viene en absoluto o si el valor está fuera del whitelist.
  if (!body || !("minutes" in body)) {
    return NextResponse.json(
      { error: "Body inválido: requiere campo `minutes`" },
      { status: 400 }
    );
  }
  const minutes = body.minutes ?? null;
  if (!ALLOWED_VALUES.has(minutes)) {
    return NextResponse.json(
      {
        error: `Valor inválido. Permitidos: null, 35, 45, 60, 90, 120. Recibido: ${minutes}`,
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const value = { minutes };

  const { data, error } = await admin
    .from("app_settings")
    .upsert(
      {
        key: "session_idle_timeout_minutes",
        value,
        updated_by: guard.user.id,
      },
      { onConflict: "key" }
    )
    .select("key, value, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Error al guardar: ${error?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }

  // Audit log
  await admin.from("audit_log").insert({
    action: "session_timeout_changed",
    user_email: guard.user.email,
    details: { minutes },
  });

  return NextResponse.json(data);
}
