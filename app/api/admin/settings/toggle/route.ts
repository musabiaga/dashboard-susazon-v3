import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

interface ToggleBody {
  key: string;
  enabled: boolean;
}

/**
 * POST /api/admin/settings/toggle
 *
 * Toggle on/off de un setting global en `app_settings`. El admin lo usa para
 * activar/desactivar features como "instructivo visible" sin redeploy.
 *
 * Body: { key: "instructivo_visible", enabled: true }
 * Result: { key, value: { enabled }, updated_at }
 *
 * RLS: la tabla app_settings ya restringe escritura a role='admin', pero
 * además agregamos `requireAdmin()` aquí como segunda barrera.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Partial<ToggleBody> | null;
  if (
    !body ||
    typeof body.key !== "string" ||
    body.key === "" ||
    typeof body.enabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Body inválido: requiere key (string) y enabled (boolean)" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const value = { enabled: body.enabled };

  const { data, error } = await admin
    .from("app_settings")
    .upsert(
      {
        key: body.key,
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
    action: "settings_toggle",
    user_email: guard.user.email,
    details: {
      key: body.key,
      enabled: body.enabled,
    },
  });

  return NextResponse.json(data);
}
