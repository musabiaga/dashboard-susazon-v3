import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireAdmin,
  isValidEmail,
  isValidRole,
} from "@/lib/admin-guards";

interface InviteBody {
  email: string;
  full_name: string;
  role: "admin" | "director" | "gerente_regional" | "vendedor";
  allowed_territories: string[] | null;
  can_edit_ptto: boolean;
  can_export_excel?: boolean;
}

/**
 * POST /api/admin/users/invite
 * Crea un nuevo usuario en auth.users + users_permissions y manda magic link
 * via inviteUserByEmail (Supabase). El usuario fija su propia contraseña al
 * abrir el link.
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

  const email = body.email.trim().toLowerCase();
  const fullName = body.full_name.trim();
  const role = body.role;
  const allowedTerritories =
    body.allowed_territories === null
      ? null
      : Array.from(new Set(body.allowed_territories.map((t) => t.trim())));
  const canEditPtto = body.can_edit_ptto;
  // Default: admin/director sí pueden exportar Excel; gerente/vendedor no.
  // El admin puede override en el form de invite.
  const canExportExcel =
    typeof body.can_export_excel === "boolean"
      ? body.can_export_excel
      : role === "admin" || role === "director";

  const admin = createSupabaseAdminClient();

  // 1. Invitar via auth admin API — manda email con magic link.
  // El redirectTo apunta a /set-password donde el invitado fija su contraseña
  // antes de poder usar la app. Construimos la URL desde el origin del request
  // para que funcione tanto en local (http://localhost:3000) como en prod
  // (https://*.vercel.app), sin depender del Site URL de Supabase.
  const origin = new URL(request.url).origin;
  // redirectTo va al callback (Route Handler que SÍ puede setear cookies de
  // sesión Supabase) con next apuntando a /set-password?from=invite. Server
  // Components no pueden mutar cookies, por eso el exchange tiene que hacerse
  // en el callback antes de llegar a /set-password.
  const next = encodeURIComponent("/set-password?from=invite");
  const redirectTo = `${origin}/api/auth/callback?next=${next}`;

  const { data: invited, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteErr || !invited?.user) {
    // Si el user ya existe en auth, devolver error claro
    const msg = inviteErr?.message ?? "Error desconocido al invitar";
    return NextResponse.json(
      { error: `No se pudo invitar: ${msg}` },
      { status: 400 }
    );
  }

  const userId = invited.user.id;

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
    // Si falla la creación del perms, limpiar el auth user para no dejar zombies
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
    },
  });

  return NextResponse.json({
    user: {
      ...perms,
      last_login: null,
    },
  });
}
