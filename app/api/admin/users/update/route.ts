import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isValidRole } from "@/lib/admin-guards";

interface UpdateBody {
  user_id: string;
  full_name?: string;
  role?: "admin" | "director" | "gerente_regional" | "vendedor";
  allowed_territories?: string[] | null;
  allowed_agrupadores?: string[] | null;
  can_edit_ptto?: boolean;
  can_export_excel?: boolean;
  is_active?: boolean;
}

/**
 * POST /api/admin/users/update
 * Actualiza campos editables del usuario. Email NO es editable (intencional).
 * Acepta updates parciales (solo cambia los campos enviados).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as Partial<UpdateBody> | null;
  if (!body || typeof body.user_id !== "string" || body.user_id === "") {
    return NextResponse.json(
      { error: "Body inválido: requiere user_id" },
      { status: 400 }
    );
  }

  // Self-protection: admin no puede desactivarse a sí mismo, ni cambiarse el rol
  if (body.user_id === guard.user.id) {
    if (body.is_active === false) {
      return NextResponse.json(
        { error: "No puedes desactivarte a ti mismo." },
        { status: 400 }
      );
    }
    if (body.role && body.role !== "admin") {
      return NextResponse.json(
        { error: "No puedes cambiarte el rol a uno menor." },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (typeof body.full_name === "string" && body.full_name.trim() !== "") {
    update.full_name = body.full_name.trim();
  }
  if (body.role !== undefined) {
    if (!isValidRole(body.role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    update.role = body.role;
  }
  if (body.allowed_territories !== undefined) {
    if (
      !(
        body.allowed_territories === null ||
        (Array.isArray(body.allowed_territories) &&
          body.allowed_territories.every((t) => typeof t === "string"))
      )
    ) {
      return NextResponse.json(
        { error: "allowed_territories inválido" },
        { status: 400 }
      );
    }
    update.allowed_territories =
      body.allowed_territories === null
        ? null
        : Array.from(
            new Set(body.allowed_territories.map((t) => t.trim()))
          );
  }
  if (body.allowed_agrupadores !== undefined) {
    if (
      !(
        body.allowed_agrupadores === null ||
        (Array.isArray(body.allowed_agrupadores) &&
          body.allowed_agrupadores.every((x) => typeof x === "string"))
      )
    ) {
      return NextResponse.json(
        { error: "allowed_agrupadores inválido" },
        { status: 400 }
      );
    }
    update.allowed_agrupadores =
      body.allowed_agrupadores === null
        ? null
        : Array.from(new Set(body.allowed_agrupadores));
  }
  if (typeof body.can_edit_ptto === "boolean") {
    update.can_edit_ptto = body.can_edit_ptto;
  }
  if (typeof body.can_export_excel === "boolean") {
    update.can_export_excel = body.can_export_excel;
  }
  if (typeof body.is_active === "boolean") {
    update.is_active = body.is_active;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nada que actualizar." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Snapshot previo (para audit log)
  const { data: before } = await admin
    .from("users_permissions")
    .select(
      "email, role, allowed_territories, allowed_agrupadores, can_edit_ptto, can_export_excel, is_active, full_name"
    )
    .eq("user_id", body.user_id)
    .single();

  if (!before) {
    return NextResponse.json(
      { error: "Usuario no encontrado." },
      { status: 404 }
    );
  }

  const { data: updated, error: updErr } = await admin
    .from("users_permissions")
    .update(update)
    .eq("user_id", body.user_id)
    .select(
      "user_id, email, full_name, role, allowed_territories, allowed_agrupadores, can_edit_ptto, can_export_excel, is_active, last_login, created_at"
    )
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: `Error actualizando: ${updErr?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }

  // Hacer cumplir is_active a nivel auth (antes era solo cosmético):
  //   - Desactivar → BANEAR al usuario (no puede iniciar sesión) + cerrar sus
  //     sesiones activas (el ban solo frena tokens nuevos; los vigentes se
  //     invalidan con force_signout_user).
  //   - Reactivar → des-banear (puede volver a entrar de inmediato).
  if (typeof body.is_active === "boolean") {
    if (body.is_active === false) {
      const { error: banErr } = await admin.auth.admin.updateUserById(
        body.user_id,
        { ban_duration: "876000h" } // ~100 años
      );
      if (banErr) {
        return NextResponse.json(
          {
            error: `Se actualizó el perfil pero NO se pudo bloquear el acceso: ${banErr.message}`,
          },
          { status: 500 }
        );
      }
      // Cerrar sesiones activas inmediatamente.
      await admin.rpc("force_signout_user", { target_user_id: body.user_id });
    } else {
      const { error: unbanErr } = await admin.auth.admin.updateUserById(
        body.user_id,
        { ban_duration: "none" }
      );
      if (unbanErr) {
        return NextResponse.json(
          {
            error: `Se reactivó el perfil pero NO se pudo restaurar el acceso: ${unbanErr.message}`,
          },
          { status: 500 }
        );
      }
    }
  }

  // Audit log
  await admin.from("audit_log").insert({
    user_id: guard.user.id,
    user_email: guard.user.email ?? guard.perms.email ?? null,
    action:
      typeof body.is_active === "boolean" && body.is_active === false
        ? "user_deleted"
        : "user_updated",
    details: {
      target_user_id: body.user_id,
      target_email: updated.email,
      changed_fields: Object.keys(update),
      before,
      after: update,
    },
  });

  return NextResponse.json({ user: updated });
}
