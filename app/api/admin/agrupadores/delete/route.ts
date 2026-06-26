import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

/**
 * POST /api/admin/agrupadores/delete  (solo admin)
 * Body: { id }
 * Borra el agrupador (cascade a sus miembros) y lo quita de allowed_agrupadores
 * de cualquier usuario que lo tuviera asignado.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body || typeof body.id !== "string" || body.id === "") {
    return NextResponse.json({ error: "Body inválido: requiere id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // 1) Quitar la asignación de los usuarios que lo tengan.
  const { data: affected } = await admin
    .from("users_permissions")
    .select("user_id, allowed_agrupadores")
    .contains("allowed_agrupadores", [body.id]);
  for (const u of affected ?? []) {
    const next = ((u.allowed_agrupadores ?? []) as string[]).filter((x) => x !== body.id);
    await admin
      .from("users_permissions")
      .update({ allowed_agrupadores: next.length ? next : null })
      .eq("user_id", u.user_id);
  }

  // 2) Borrar el agrupador (cascade borra agrupador_members).
  const { error } = await admin.from("agrupadores").delete().eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: `No se pudo borrar: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, desasignado_de: (affected ?? []).length });
}
