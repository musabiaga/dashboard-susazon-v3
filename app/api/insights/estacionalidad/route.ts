import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/estacionalidad
 *
 * Sub-análisis "Estacionalidad (heatmap)" del tab Insights.
 *
 * Devuelve, para un año + dimensión + métrica, el valor mensual de cada item
 * del Top N (12 meses pivoteados) + el total del universo por mes (fila TOTAL)
 * + qué meses tienen datos (para marcar el año parcial, ej. 2026).
 *
 * El frontend calcula el ÍNDICE de estacionalidad (valor_mes ÷ promedio
 * mensual del item × 100). Respeta RLS de territorio.
 *
 * Query params:
 *   year:        2024 | 2025 | 2026 …
 *   dimension:   clientes | grupos | productos | territorios (default grupos)
 *   metric:      kg | venta (default kg)
 *   topN:        Top N items por la métrica (clientes/SKUs). default 15.
 *   territorios: null=todos visibles | ""=ninguno | CSV=subset
 */

const ALLOWED_DIMENSIONS = new Set([
  "clientes",
  "grupos",
  "productos",
  "territorios",
]);
// Dimensiones de baja cardinalidad → se muestran completas.
const SMALL_DIMENSIONS = new Set(["grupos", "territorios"]);

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const year = parseInt(sp.get("year") ?? "", 10);
  const dimension = (sp.get("dimension") ?? "grupos").toLowerCase();
  const metric = (sp.get("metric") ?? "kg").toLowerCase() === "venta" ? "venta" : "kg";
  const topNReq = parseInt(sp.get("topN") ?? "15", 10);

  const territoriosParamRaw = sp.get("territorios");
  let territoriosFilter: string[] | null;
  if (territoriosParamRaw === null) territoriosFilter = null;
  else if (territoriosParamRaw === "") territoriosFilter = [];
  else
    territoriosFilter = territoriosParamRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    return NextResponse.json(
      { error: `Dimensión inválida. Permitidas: ${Array.from(ALLOWED_DIMENSIONS).join(", ")}` },
      { status: 400 }
    );
  }
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({ year, dimension, metric, monthsPresent: [], items: [], universe: null });
  }

  // Dimensiones chicas → completas (topN alto); clientes/SKUs → Top N pedido.
  const topN = SMALL_DIMENSIONS.has(dimension)
    ? 500
    : Math.min(Math.max(Number.isFinite(topNReq) ? topNReq : 15, 1), 50);

  const { data, error } = await supabase.rpc("insights_estacionalidad", {
    p_year: year,
    p_dimension: dimension,
    p_metric: metric,
    p_territorios: territoriosFilter,
    p_topn: topN,
  });
  if (error) {
    return NextResponse.json({ error: `Error al consultar: ${error.message}` }, { status: 500 });
  }

  type Row = { name: string; mes: number; kg: number; venta: number };
  const rows = (data ?? []) as Row[];

  // Pivot: por item → array de 12 meses (valor de la métrica).
  const byItem = new Map<string, { name: string; byMonth: number[]; total: number }>();
  const monthsPresent = new Set<number>();
  for (const r of rows) {
    const m = Number(r.mes);
    if (m < 1 || m > 12) continue;
    monthsPresent.add(m);
    const val = metric === "kg" ? Number(r.kg) || 0 : Number(r.venta) || 0;
    let it = byItem.get(r.name);
    if (!it) {
      it = { name: r.name, byMonth: new Array(12).fill(0), total: 0 };
      byItem.set(r.name, it);
    }
    it.byMonth[m - 1] += val;
    it.total += val;
  }
  const items = Array.from(byItem.values()).sort((a, b) => b.total - a.total);

  // Fila TOTAL = suma de los items mostrados por mes. Para grupos/territorios
  // (que salen completos) es el universo; para clientes/SKUs es el total del
  // Top N (el frontend lo etiqueta como tal).
  const totalByMonth = new Array(12).fill(0);
  for (const it of items) {
    for (let m = 0; m < 12; m++) totalByMonth[m] += it.byMonth[m];
  }
  const complete = SMALL_DIMENSIONS.has(dimension);

  return NextResponse.json({
    year,
    dimension,
    metric,
    monthsPresent: Array.from(monthsPresent).sort((a, b) => a - b),
    items,
    total: { byMonth: totalByMonth, complete },
  });
}
