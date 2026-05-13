import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";
import { validatePassword } from "@/lib/password-utils";

type ResetMethod = "email" | "password";

interface ResetBody {
  user_id: string;
  /** Método de reset (default "email" para back-compat). */
  method?: ResetMethod;
  /** Nueva contraseña — requerida si method === "password". */
  new_password?: string;
  /** Forzar cambio en siguiente login — solo aplica con password. Default true. */
  force_change_password?: boolean;
}

/**
 * POST /api/admin/users/reset-password
 *
 * Dos métodos de reset:
 *   - method: "email" (default, back-compat) → manda magic link de recovery.
 *     El admin no ve la nueva password; el usuario la define en /set-password.
 *   - method: "password" → admin define nueva contraseña directamente. Se
 *     setea user_metadata.must_change_password=true por default para que el
 *     usuario sea redirigido a /mi-cuenta en su siguiente login.
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

  const method: ResetMethod = body.method === "password" ? "password" : "email";
  const forceChange = body.force_change_password !== false; // default true

  if (method === "password") {
    const v = validatePassword(body.new_password);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
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

  if (method === "password") {
    // Update directo de password + flag must_change_password
    const { error: updErr } = await admin.auth.admin.updateUserById(body.user_id, {
      password: body.new_password!,
      user_metadata: {
        must_change_password: forceChange,
      },
    });
    if (updErr) {
      return NextResponse.json(
        { error: `No se pudo cambiar password: ${updErr.message}` },
        { status: 500 }
      );
    }
  } else {
    // Flow tradicional: magic link de recovery
    const { error: linkErr } = await admin.auth.resetPasswordForEmail(
      target.email
    );
    if (linkErr) {
      return NextResponse.json(
        { error: `No se pudo enviar email: ${linkErr.message}` },
        { status: 500 }
      );
    }
  }

  // Audit log
  await admin.from("audit_log").insert({
    user_id: guard.user.id,
    user_email: guard.user.email ?? guard.perms.email ?? null,
    action: "user_updated",
    details: {
      target_user_id: body.user_id,
      target_email: target.email,
      action_type: method === "password"
        ? "password_reset_direct"
        : "password_reset_email",
      force_change_password: method === "password" ? forceChange : null,
    },
  });

  return NextResponse.json({ ok: true, method });
}
