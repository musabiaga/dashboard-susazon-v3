import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/crecimiento-vendedor
 *
 * 6º sub-análisis de Insights: "Crecimiento por Vendedor". Comparativo Año
 * Anterior vs Año Actual (Mes + Acumulado, capados al mismo día) por cliente o
 * producto, filtrable por vendedor (+ territorio/agrupador del sidebar).
 *
 *   dimension:   clientes | productos (default clientes)
 *   vendedor:    nombre exacto | (ausente) = todos
 *   territorios: null=todos visibles | ""=ninguno | CSV=subset
 *   agrupador:   uuid → modo agrupador (ignora territorios)
 *
 * Devuelve venta/kg/margen crudos de las 4 celdas → el frontend deriva la
 * medición activa y el crecimiento sin recargar. Incluye refDate (fecha de
 * corte) y la lista de vendedores en scope (para el dropdown).
 */
const ALLOWED_DIM = new Set(["clientes", "productos"]);

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const dimension = (sp.get("dimension") ?? "clientes").toLowerCase();
  if (!ALLOWED_DIM.has(dimension)) {
    return NextResponse.json({ error: "Dimensión inválida (clientes | productos)" }, { status: 400 });
  }
  const vendedor = sp.get("vendedor") || null; // null = todos
  const agrupadorId = sp.get("agrupador") || null;

  const territoriosParamRaw = sp.get("territorios");
  let territoriosFilter: string[] | null;
  if (territoriosParamRaw === null) territoriosFilter = null;
  else if (territoriosParamRaw === "") territoriosFilter = [];
  else territoriosFilter = territoriosParamRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  // "ninguno" en modo normal → universo vacío (no aplica en modo agrupador)
  if (!agrupadorId && territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({ dimension, refDate: null, vendedores: [], rows: [] });
  }

  const [dataRes, metaRes, totRes] = await Promise.all([
    supabase.rpc("insights_crecimiento_vendedor", {
      p_dimension: dimension,
      p_vendedor: vendedor,
      p_territorios: territoriosFilter,
      p_agrupador_id: agrupadorId,
    }),
    supabase.rpc("insights_crecimiento_meta", {
      p_territorios: territoriosFilter,
      p_agrupador_id: agrupadorId,
    }),
    // Totales REALES del scope: Σ para venta/kg/margen y COUNT(DISTINCT) para
    // variedad/tickets → nunca la suma de los renglones (duplicaría).
    supabase.rpc("insights_crecimiento_totales", {
      p_dimension: dimension,
      p_vendedor: vendedor,
      p_territorios: territoriosFilter,
      p_agrupador_id: agrupadorId,
    }),
  ]);

  if (dataRes.error) {
    return NextResponse.json({ error: `Error al consultar: ${dataRes.error.message}` }, { status: 500 });
  }

  const meta = (Array.isArray(metaRes.data) ? metaRes.data[0] : metaRes.data) as
    | { ref_date: string | null; vendedores: string[] | null }
    | undefined;

  const totales = Array.isArray(totRes.data) ? totRes.data[0] : totRes.data;

  return NextResponse.json({
    dimension,
    refDate: meta?.ref_date ?? null,
    vendedores: meta?.vendedores ?? [],
    rows: dataRes.data ?? [],
    totales: totales ?? null,
  });
}
