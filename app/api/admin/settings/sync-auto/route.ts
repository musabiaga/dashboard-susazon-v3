import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrDirector } from "@/lib/admin-guards";

/**
 * POST /api/admin/settings/sync-auto
 *
 * Activa/desactiva la sincronización automática diaria (Vercel Cron).
 * Mismo permiso que el refresh manual: admin o director.
 *
 * Body:   { enabled: boolean }
 * Result: { key: "sync_auto", value: { enabled }, updated_at }
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdminOrDirector();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as
    | { enabled?: unknown }
    | null;
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "Body inválido: requiere enabled (boolean)" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("app_settings")
    .upsert(
      { key: "sync_auto", value: { enabled: body.enabled }, updated_by: guard.user.id },
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

  await admin.from("audit_log").insert({
    user_id: guard.user.id,
    user_email: guard.user.email ?? null,
    action: "settings_toggle",
    details: { key: "sync_auto", enabled: body.enabled },
  });

  return NextResponse.json(data);
}
