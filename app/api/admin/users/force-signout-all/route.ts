import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

/**
 * POST /api/admin/users/force-signout-all
 *
 * Invalida sesiones de TODOS los usuarios excepto:
 *   - El admin actual (quien aprieta el botón)
 *   - Los usuarios con session_timeout_exempt=true (marcados como exentos
 *     del timeout, su admin específicamente los protegió)
 *
 * Solo admin. No requiere body.
 *
 * Devuelve { signed_out: number, skipped: { admin_self, exempt_users } }
 */
export async function POST() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const admin = createSupabaseAdminClient();

  // 1. Traer todos los usuarios para filtrar
  const { data: allUsers, error: fetchErr } = await admin
    .from("users_permissions")
    .select("user_id, email, full_name, session_timeout_exempt");

  if (fetchErr || !allUsers) {
    return NextResponse.json(
      { error: `Error al listar usuarios: ${fetchErr?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }

  // 2. Filtrar: descartar al admin actual y a los exentos
  const exemptUsers: string[] = [];
  const toSignOut = allUsers.filter((u) => {
    if (u.user_id === guard.user.id) return false; // admin actual
    if (u.session_timeout_exempt) {
      exemptUsers.push(u.email ?? u.user_id);
      return false;
    }
    return true;
  });

  // 3. Invalidar sesiones en paralelo (Supabase Admin API es atómica por user)
  const results = await Promise.allSettled(
    toSignOut.map((u) => admin.auth.admin.signOut(u.user_id, "global"))
  );

  const success: string[] = [];
  const failed: { email: string; error: string }[] = [];
  results.forEach((r, i) => {
    const target = toSignOut[i];
    if (r.status === "fulfilled" && !r.value.error) {
      success.push(target.email ?? target.user_id);
    } else {
      const errMsg =
        r.status === "rejected"
          ? String(r.reason)
          : r.value.error?.message ?? "desconocido";
      failed.push({ email: target.email ?? target.user_id, error: errMsg });
    }
  });

  // 4. Audit log
  await admin.from("audit_log").insert({
    action: "force_signout_all",
    user_email: guard.user.email,
    details: {
      signed_out_count: success.length,
      signed_out_emails: success,
      skipped_admin_self: guard.user.email,
      skipped_exempt_users: exemptUsers,
      failed_count: failed.length,
      failed_emails: failed,
    },
  });

  return NextResponse.json({
    signed_out: success.length,
    signed_out_emails: success,
    skipped: {
      admin_self: guard.user.email,
      exempt_users: exemptUsers,
    },
    failed,
  });
}
