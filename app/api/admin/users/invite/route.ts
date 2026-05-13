import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  isValidEmail,
  isValidRole,
} from "@/lib/admin-guards";
import { validatePassword } from "@/lib/password-utils";

type AuthMethod = "email" | "password";

interface InviteBody {
  email: string;
  full_name: string;
  role: "admin" | "director" | "gerente_regional" | "vendedor";
  allowed_territories: string[] | null;
  can_edit_ptto: boolean;
  can_export_excel?: boolean;
  /** Método de auth (default "email" para back-compat). */
  auth_method?: AuthMethod;
  /** Contraseña inicial — requerida si auth_method === "password". */
  initial_password?: string;
  /** Forzar cambio en primer login — solo aplica con password. Default true. */
  force_change_password?: boolean;
}

/**
 * POST /api/admin/users/invite
 *
 * Crea un nuevo usuario en auth.users + users_permissions.
 *
 * Dos métodos de alta soportados:
 *   - auth_method: "email" (default, back-compat) → manda magic link via
 *     inviteUserByEmail. El usuario fija su contraseña al abrir el link en /set-password.
 *   - auth_method: "password" → admin asigna una contraseña directa. No se manda
 *     email. El user_metadata.must_change_password queda en true por default
 *     para forzar al usuario a cambiar la contraseña en su primer login.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Partial<InviteBody> | null;
  if (
    !body ||
    !isValidEmail(body.email) ||
    typeof body.full_name !== "string" ||
    body.full_name.trim() === "" ||
    !isValidRole(body.role) ||
    typeof body.can_edit_ptto !== "boolean" ||
    !(
      body.allowed_territories === null ||
      (Array.isArray(body.allowed_territories) &&
        body.allowed_territories.every((t) => typeof t === "string"))
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Body inválido: requiere email, full_name, role, allowed_territories (array|null), can_edit_ptto",
      },
      { status: 400 }
    );
  }

  const authMethod: AuthMethod = body.auth_method === "password" ? "password" : "email";
  const forceChangePassword = body.force_change_password !== false; // default true

  // Validar password si auth_method === "password"
  if (authMethod === "password") {
    const pwValidation = validatePassword(body.initial_password);
    if (!pwValidation.ok) {
      return NextResponse.json({ error: pwValidation.error }, { status: 400 });
    }
  }

  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const role = body.role;
  const allowedTerritories =
    body.allowed_territories === null
      ? null
      : Array.from(new Set(body.allowed_territories.map((t) => t.trim())));
  const canEditPtto = body.can_edit_ptto;
  const canExportExcel =
    typeof body.can_export_excel === "boolean"
      ? body.can_export_excel
      : role === "admin" || role === "director";

  const admin = createSupabaseAdminClient();

  // 1. Crear el usuario auth — distinto path según authMethod
  let userId: string;

  if (authMethod === "password") {
    // Crear directamente con contraseña. email_confirm=true para que pueda
    // hacer login sin pasos extra. user_metadata.must_change_password fuerza
    // al usuario a /mi-cuenta en su primer login si forceChangePassword.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: body.initial_password!,
      email_confirm: true,
      user_metadata: {
        must_change_password: forceChangePassword,
      },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Error desconocido al crear usuario";
      return NextResponse.json(
        { error: `No se pudo crear el usuario: ${msg}` },
        { status: 400 }
      );
    }
    userId = created.user.id;
  } else {
    // Flow tradicional: magic link via inviteUserByEmail
    const origin = new URL(request.url).origin;
    const next = encodeURIComponent("/set-password?from=invite");
    const redirectTo = `${origin}/api/auth/callback?next=${next}`;

    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteErr || !invited?.user) {
      const msg = inviteErr?.message ?? "Error desconocido al invitar";
      return NextResponse.json(
        { error: `No se pudo invitar: ${msg}` },
        { status: 400 }
      );
    }
    userId = invited.user.id;
  }

  // 2. Crear o actualizar fila en users_permissions
  const { data: perms, error: permsErr } = await admin
    .from("users_permissions")
    .upsert(
      {
        user_id: userId,
        email,
        full_name: fullName,
        role,
        allowed_territories: allowedTerritories,
        can_edit_ptto: canEditPtto,
        can_export_excel: canExportExcel,
        is_active: true,
      },
      { onConflict: "user_id" }
    )
    .select(
      "user_id, email, full_name, role, allowed_territories, can_edit_ptto, can_export_excel, is_active, last_login, created_at"
    )
    .single();

  if (permsErr || !perms) {
    // Cleanup auth user si falló perms (evitar zombies)
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json(
      {
        error: `Error guardando permisos: ${permsErr?.message ?? "desconocido"}`,
      },
      { status: 500 }
    );
  }

  // 3. Audit log
  await admin.from("audit_log").insert({
    user_id: guard.user.id,
    user_email: guard.user.email ?? guard.perms.email ?? null,
    action: "user_created",
    details: {
      target_user_id: userId,
      target_email: email,
      role,
      allowed_territories: allowedTerritories,
      can_edit_ptto: canEditPtto,
      can_export_excel: canExportExcel,
      auth_method: authMethod,
      force_change_password: authMethod === "password" ? forceChangePassword : null,
    },
  });

  return NextResponse.json({
    user: {
      ...perms,
      last_login: null,
    },
    auth_method: authMethod,
    must_change_password: authMethod === "password" ? forceChangePassword : null,
  });
}
