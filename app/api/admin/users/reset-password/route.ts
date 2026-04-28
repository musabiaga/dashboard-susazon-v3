import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

interface ResetBody {
  user_id: string;
}

/**
 * POST /api/admin/users/reset-password
 * Manda email con link de reset al usuario. El admin no ve la nueva password.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Partial<ResetBody> | null;
  if (!body || typeof body.user_id !== "string" || body.user_id === "") {
    return NextResponse.json(
      { error: "Body inválido: requiere user_id" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Buscar email del target
  const { data: target } = await admin
    .from("users_permissions")
    .select("email, full_name")
    .eq("user_id", body.user_id)
    .single();

  if (!target) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  // Generar y enviar magic link de recovery
  const { error: linkErr } = await admin.auth.resetPasswordForEmail(
    target.email
  );

  if (linkErr) {
    return NextResponse.json(
      { error: `No se pudo enviar email: ${linkErr.message}` },
      { status: 500 }
    );
  }

  // Audit log
  await admin.from("audit_log").insert({
    user_id: guard.user.id,
    user_email: guard.user.email ?? guard.perms.email ?? null,
    action: "user_updated",
    details: {
      target_user_id: body.user_id,
      target_email: target.email,
      action_type: "password_reset_sent",
    },
  });

  return NextResponse.json({ ok: true });
}
