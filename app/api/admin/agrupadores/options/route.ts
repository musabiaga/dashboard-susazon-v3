import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guards";

/**
 * GET /api/admin/agrupadores/options  (solo admin)
 * Devuelve los valores distintos por dimensión para el picker de miembros:
 * { territorio: [...], grupo: [...], familia: [...], sku: [...], cliente: [...] }
 */
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("agrupador_all_options");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        territorios: string[] | null;
        grupos: string[] | null;
        familias: string[] | null;
        skus: string[] | null;
        clientes: string[] | null;
      }
    | undefined;

  return NextResponse.json({
    territorio: row?.territorios ?? [],
    grupo: row?.grupos ?? [],
    familia: row?.familias ?? [],
    sku: row?.skus ?? [],
    cliente: row?.clientes ?? [],
  });
}
