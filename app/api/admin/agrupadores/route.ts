import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

/**
 * /api/admin/agrupadores  (solo admin)
 *
 * GET  → lista todos los agrupadores con sus miembros y # de usuarios asignados.
 * POST → crea o actualiza un agrupador + reemplaza sus miembros (en una llamada).
 *        Body: { id?, nombre, descripcion?, icono?, color?, meta_mensual?,
 *                is_active?, members: [{member_type, member_value}] }
 */

const MEMBER_TYPES = new Set(["territorio", "grupo", "familia", "sku", "cliente"]);

interface MemberInput {
  member_type: string;
  member_value: string;
}
interface SaveBody {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  icono?: string | null;
  color?: string | null;
  meta_mensual?: number | null;
  is_active?: boolean;
  members?: MemberInput[];
}

export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const admin = createSupabaseAdminClient();

  const { data: ags, error: e1 } = await admin
    .from("agrupadores")
    .select("id, nombre, descripcion, icono, color, meta_mensual, is_active, created_at")
    .order("nombre");
  if (e1) {
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  const { data: members } = await admin
    .from("agrupador_members")
    .select("agrupador_id, member_type, member_value");

  const { data: assigns } = await admin
    .from("users_permissions")
    .select("allowed_agrupadores");
  const assignCount = new Map<string, number>();
  for (const u of assigns ?? []) {
    for (const id of (u.allowed_agrupadores ?? []) as string[]) {
      assignCount.set(id, (assignCount.get(id) ?? 0) + 1);
    }
  }

  const byAg = new Map<string, MemberInput[]>();
  for (const m of members ?? []) {
    const arr = byAg.get(m.agrupador_id) ?? [];
    arr.push({ member_type: m.member_type, member_value: m.member_value });
    byAg.set(m.agrupador_id, arr);
  }

  const items = (ags ?? []).map((a) => ({
    ...a,
    members: byAg.get(a.id) ?? [],
    assigned_users: assignCount.get(a.id) ?? 0,
  }));
  return NextResponse.json({ agrupadores: items });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as SaveBody | null;
  if (!body || typeof body.nombre !== "string" || body.nombre.trim() === "") {
    return NextResponse.json({ error: "Falta el nombre del agrupador" }, { status: 400 });
  }
  const members = Array.isArray(body.members) ? body.members : [];
  for (const m of members) {
    if (
      !m ||
      !MEMBER_TYPES.has(m.member_type) ||
      typeof m.member_value !== "string" ||
      m.member_value.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Miembro inválido (tipo debe ser territorio/grupo/familia/sku/cliente y valor no vacío)" },
        { status: 400 }
      );
    }
  }
  if (members.length === 0) {
    return NextResponse.json(
      { error: "El agrupador necesita al menos un miembro." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const fields = {
    nombre: body.nombre.trim(),
    descripcion: body.descripcion ?? null,
    icono: body.icono ?? null,
    color: body.color ?? null,
    meta_mensual:
      typeof body.meta_mensual === "number" && isFinite(body.meta_mensual)
        ? body.meta_mensual
        : null,
    is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    updated_at: new Date().toISOString(),
  };

  let agrupadorId = body.id;
  if (agrupadorId) {
    const { error } = await admin.from("agrupadores").update(fields).eq("id", agrupadorId);
    if (error) {
      return NextResponse.json({ error: `No se pudo guardar: ${error.message}` }, { status: 500 });
    }
  } else {
    const { data, error } = await admin
      .from("agrupadores")
      .insert({ ...fields, created_by: guard.user.id })
      .select("id")
      .single();
    if (error || !data) {
      const msg = error?.message ?? "desconocido";
      const friendly = msg.includes("duplicate") ? "Ya existe un agrupador con ese nombre." : msg;
      return NextResponse.json({ error: `No se pudo crear: ${friendly}` }, { status: 400 });
    }
    agrupadorId = data.id as string;
  }

  // Reemplazar miembros (delete + insert dedupeado).
  await admin.from("agrupador_members").delete().eq("agrupador_id", agrupadorId);
  const seen = new Set<string>();
  const rows = members
    .map((m) => ({
      agrupador_id: agrupadorId,
      member_type: m.member_type,
      member_value: m.member_value.trim(),
    }))
    .filter((r) => {
      const k = `${r.member_type}|${r.member_value}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const { error: mErr } = await admin.from("agrupador_members").insert(rows);
  if (mErr) {
    return NextResponse.json(
      { error: `Guardado el agrupador pero falló al guardar miembros: ${mErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: agrupadorId });
}
