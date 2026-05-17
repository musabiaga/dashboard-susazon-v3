import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

interface ForceSignoutBody {
  user_id: string;
}

/**
 * POST /api/admin/users/force-signout
 *
 * Invalida todas las sesiones activas de UN usuario específico. Solo admin.
 *
 * Body: { user_id: "uuid-of-user" }
 *
 * Mecanismo: Supabase Admin API `auth.admin.signOut(userId)` invalida
 * todos los refresh tokens del usuario. Su access token expira en máximo
 * 1 hora (config default) o cuando intente refrescar (~1 min después).
 *
 * El cliente detecta el cierre vía:
 *   - Middleware en cada request (validación gratuita) → próximo click
 *   - Polling cada 30 min (safety net) → si solo observa sin tocar
 *   - visibilitychange al regresar a tab
 *
 * NO se permite force-signout sobre el admin actual (debe usar logout normal).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as
    | Partial<ForceSignoutBody>
    | null;

  if (!body || typeof body.user_id !== "string" || body.user_id === "") {
    return NextResponse.json(
      { error: "Body inválido: requiere user_id" },
      { status: 400 }
    );
  }

  // No permitir que el admin se cierre a sí mismo con este endpoint
  // (debería usar el botón de logout normal).
  if (body.user_id === guard.user.id) {
    return NextResponse.json(
      {
        error:
          "No puedes cerrar tu propia sesión con este botón. Usa el botón de logout del header.",
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Obtener email del usuario afectado (para audit log)
  const { data: targetPerms } = await admin
    .from("users_permissions")
    .select("email, full_name")
    .eq("user_id", body.user_id)
    .single();

  // Invalidar todas las sesiones del usuario (scope "global" cierra
  // sesiones en TODOS los dispositivos del usuario).
  const { error } = await admin.auth.admin.signOut(body.user_id, "global");

  if (error) {
    return NextResponse.json(
      { error: `Error al cerrar sesión: ${error.message}` },
      { status: 500 }
    );
  }

  // Audit log
  await admin.from("audit_log").insert({
    action: "force_signout",
    user_email: guard.user.email,
    details: {
      target_user_id: body.user_id,
      target_email: targetPerms?.email ?? null,
      target_name: targetPerms?.full_name ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    target_email: targetPerms?.email ?? null,
  });
}
