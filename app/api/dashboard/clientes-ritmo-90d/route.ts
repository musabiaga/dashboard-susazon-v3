import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBusinessDay } from "@/lib/business-days";

/**
 * GET /api/dashboard/clientes-ritmo-90d
 *
 * Devuelve la venta/kg de los últimos 90 DÍAS HÁBILES (L-S menos feriados LFT)
 * por entidad (cliente o SKU), para la vista "vs Prom. 90d" de la tabla del
 * tab unificado Clientes y Productos (Mejora 4 + Fase 2). El componente calcula
 * el ritmo diario (÷ días hábiles) y lo compara contra el ritmo del mes.
 *
 * Query params:
 *   year:        YYYY (solo informativo / validación)
 *   asOf:        YYYY-MM-DD — día de corte (toDate).
 *   dim:         "cliente" (default) | "sku" — dimensión del ritmo
 *   items:       CSV de nombres (clientes o SKUs según dim).
 *                Fallback: `clientes` (compat con llamados previos).
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV
 *
 * Calcula fromDate = el día calendario que está 90 días hábiles antes de asOf.
 * Respeta RLS de territorio.
 *
 * Respuesta: { clientes: [{name, venta90d, kg90d}], bizDays, fromDate, toDate }
 * (key "clientes" conservada por compatibilidad — es el arreglo de series).
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_BIZ_DAYS = 90;

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const asOf = (sp.get("asOf") ?? "").trim();
  if (!ISO.test(asOf)) {
    return NextResponse.json({ error: "asOf inválido (YYYY-MM-DD)" }, { status: 400 });
  }

  const dim = sp.get("dim") === "sku" ? "sku" : "cliente";
  const column = dim === "sku" ? "sku" : "cliente";

  // Entidades (clientes o SKUs según dim). `items` canónico, `clientes` fallback.
  const itemsRaw = sp.get("items") ?? sp.get("clientes") ?? "";
  const items = itemsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (items.length === 0) {
    return NextResponse.json({ clientes: [], bizDays: 0, fromDate: asOf, toDate: asOf });
  }

  const territoriosRaw = sp.get("territorios");
  let territoriosFilter: string[] | null;
  if (territoriosRaw === null) territoriosFilter = null;
  else if (territoriosRaw === "") territoriosFilter = [];
  else
    territoriosFilter = territoriosRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({ clientes: [], bizDays: 0, fromDate: asOf, toDate: asOf });
  }

  // Calcular fromDate: retroceder dia por dia desde asOf contando dias habiles
  // hasta acumular 90. El día asOf cuenta si es hábil.
  const [ay, am, ad] = asOf.split("-").map((s) => parseInt(s, 10));
  const cursor = new Date(ay, am - 1, ad);
  let bizCount = 0;
  let fromCursor = new Date(cursor);
  // Cuenta hacia atrás incluyendo el día asOf si es hábil.
  while (bizCount < TARGET_BIZ_DAYS) {
    if (isBusinessDay(fromCursor)) bizCount++;
    if (bizCount >= TARGET_BIZ_DAYS) break;
    fromCursor = new Date(fromCursor);
    fromCursor.setDate(fromCursor.getDate() - 1);
    // Guarda contra bucle infinito (máx ~150 días calendario para 90 hábiles).
    const diffDays =
      (cursor.getTime() - fromCursor.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 200) break;
  }

  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromDate = toISO(fromCursor);
  const toDate = asOf;

  let query = supabase
    .from("sales_rows")
    .select(`${column}, venta, kg`)
    .in(column, items)
    .gte("fecha", fromDate)
    .lte("fecha", toDate);
  if (territoriosFilter !== null) {
    query = query.in("territorio", territoriosFilter);
  }
  const { data, error } = await query.limit(50000);

  if (error) {
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }

  const byName = new Map<string, { venta90d: number; kg90d: number }>();
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const name = (r[column] as string | null) ?? "(sin nombre)";
    const cur = byName.get(name) ?? { venta90d: 0, kg90d: 0 };
    cur.venta90d += Number(r.venta) || 0;
    cur.kg90d += Number(r.kg) || 0;
    byName.set(name, cur);
  }

  const itemsOut = items.map((name) => ({
    name,
    venta90d: byName.get(name)?.venta90d ?? 0,
    kg90d: byName.get(name)?.kg90d ?? 0,
  }));

  return NextResponse.json({
    clientes: itemsOut,
    bizDays: TARGET_BIZ_DAYS,
    fromDate,
    toDate,
  });
}
