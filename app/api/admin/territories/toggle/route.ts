import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface TerritoryStateOut {
  territory_name: string;
  is_active: boolean;
  reason: string | null;
  disabled_at: string | null;
  disabled_by_label: string | null;
}

/**
 * POST /api/admin/territories/toggle
 * Apaga o prende un territorio globalmente. Solo admin.
 *
 * Body: { territory_name: string, is_active: boolean, reason?: string|null }
 *
 * Cuando se apaga: registra disabled_by, disabled_at, reason.
 * Cuando se prende: limpia los 3 campos.
 * Inserta evento en audit_log.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: perms } = await supabase
    .from("users_permissions")
    .select("role, full_name, email")
    .eq("user_id", user.id)
    .single();

  if (!perms || perms.role !== "admin") {
    return NextResponse.json(
      { error: "Solo admin puede apagar/prender territorios" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    territory_name?: unknown;
    is_active?: unknown;
    reason?: unknown;
  } | null;

  if (
    !body ||
    typeof body.territory_name !== "string" ||
    body.territory_name.trim() === "" ||
    typeof body.is_active !== "boolean"
  ) {
    return NextResponse.json(
      {
        error:
          "Body inválido: requiere territory_name (string) y is_active (boolean)",
      },
      { status: 400 }
    );
  }

  const territoryName = body.territory_name.trim();
  const reason =
    typeof body.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim().slice(0, 500)
      : null;

  // Verificar que existe
  const { data: existing, error: fetchErr } = await supabase
    .from("territories_state")
    .select("territory_name, is_active")
    .eq("territory_name", territoryName)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: `Territorio no encontrado: ${territoryName}` },
      { status: 404 }
    );
  }

  // Construir update — limpiar campos cuando prende
  const updatePayload = body.is_active
    ? {
        is_active: true,
        disabled_by: null,
        disabled_at: null,
        reason: null,
      }
    : {
        is_active: false,
        disabled_by: user.id,
        disabled_at: new Date().toISOString(),
        reason,
      };

  const { data: updated, error: updateErr } = await supabase
    .from("territories_state")
    .update(updatePayload)
    .eq("territory_name", territoryName)
    .select("territory_name, is_active, reason, disabled_at, disabled_by")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: `Error guardando: ${updateErr?.message ?? "desconocido"}` },
      { status: 500 }
    );
  }

  // Audit log — no fatal si falla
  await supabase.from("audit_log").insert({
    user_id: user.id,
    user_email: user.email ?? perms.email ?? null,
    action: "territory_toggle",
    details: {
      territory_name: territoryName,
      new_state: body.is_active ? "active" : "disabled",
      previous_state: existing.is_active ? "active" : "disabled",
      reason,
    },
  });

  // Resolver disabled_by_label
  let disabledByLabel: string | null = null;
  if (updated.disabled_by) {
    if (updated.disabled_by === user.id) {
      disabledByLabel = perms.full_name || perms.email || null;
    } else {
      const { data: u } = await supabase
        .from("users_permissions")
        .select("email, full_name")
        .eq("user_id", updated.disabled_by)
        .single();
      disabledByLabel = u?.full_name || u?.email || null;
    }
  }

  const response: TerritoryStateOut = {
    territory_name: updated.territory_name,
    is_active: updated.is_active,
    reason: updated.reason ?? null,
    disabled_at: updated.disabled_at ?? null,
    disabled_by_label: disabledByLabel,
  };

  return NextResponse.json(response);
}
