import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

interface ToggleExemptionBody {
  user_id: string;
  /** true = NO aplica timeout de inactividad (sesión persistente).
   *  false = sí aplica el timeout global. */
  exempt: boolean;
}

/**
 * POST /api/admin/users/toggle-timeout-exemption
 *
 * Actualiza la columna users_permissions.session_timeout_exempt para un
 * usuario. Solo admin.
 *
 * Body: { user_id: "uuid", exempt: true }
 *
 * Cuando exempt=true, ese usuario NO está sujeto al timeout global de
 * inactividad. Su dashboard tampoco muestra el modal "expira en 60s".
 *
 * El cambio toma efecto en el próximo refresh del dashboard del usuario
 * (no hay push en vivo; aceptable porque es un setting que no se cambia
 * frecuentemente).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as
    | Partial<ToggleExemptionBody>
    | null;

  if (
    !body ||
    typeof body.user_id !== "string" ||
    body.user_id === "" ||
    typeof body.exempt !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Body inválido: requiere user_id y exempt (boolean)" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Obtener email + nombre para audit log
  const { data: targetPerms } = await admin
    .from("users_permissions")
    .select("email, full_name")
    .eq("user_id", body.user_id)
    .single();

  const { error } = await admin
    .from("users_permissions")
    .update({ session_timeout_exempt: body.exempt })
    .eq("user_id", body.user_id);

  if (error) {
    return NextResponse.json(
      { error: `Error al actualizar: ${error.message}` },
      { status: 500 }
    );
  }

  // Audit log
  await admin.from("audit_log").insert({
    action: "session_timeout_exemption_changed",
    user_email: guard.user.email,
    details: {
      target_user_id: body.user_id,
      target_email: targetPerms?.email ?? null,
      target_name: targetPerms?.full_name ?? null,
      exempt: body.exempt,
    },
  });

  return NextResponse.json({ success: true, exempt: body.exempt });
}
