import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/cliente-desglose
 *
 * Devuelve la facturación de un cliente desglosada por GRUPO de producto, y
 * dentro de cada grupo, por SKU (árbol de 2 niveles). Para el dropdown
 * expandible de la tabla del tab Clientes (Mejora 5).
 *
 * Periodo: al-día (mes seleccionado, hasta el día de corte daysCurrent).
 *
 * Query params:
 *   year:        YYYY
 *   month:       1-12
 *   daysCurrent: día de corte del mes (al-día)
 *   cliente:     nombre del cliente
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV
 *
 * Una sola query a sales_rows; el árbol grupo→SKU se arma server-side.
 * Respeta RLS de territorio.
 */

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
  const month = parseInt(sp.get("month") ?? "", 10);
  const daysCurrent = parseInt(sp.get("daysCurrent") ?? "", 10);
  const cliente = sp.get("cliente") ?? "";

  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month inválido" }, { status: 400 });
  }
  if (!Number.isFinite(daysCurrent) || daysCurrent < 1 || daysCurrent > 31) {
    return NextResponse.json({ error: "daysCurrent inválido" }, { status: 400 });
  }
  if (!cliente) {
    return NextResponse.json({ error: "cliente requerido" }, { status: 400 });
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
    return NextResponse.json({ grupos: [] });
  }

  // Al-día: fecha <= día de corte del mes.
  const mm = String(month).padStart(2, "0");
  const dd = String(daysCurrent).padStart(2, "0");
  const firstDay = `${year}-${mm}-01`;
  const cutoffDate = `${year}-${mm}-${dd}`;

  let query = supabase
    .from("sales_rows")
    .select("grupo, sku, venta, kg, margen")
    .eq("cliente", cliente)
    .gte("fecha", firstDay)
    .lte("fecha", cutoffDate);
  if (territoriosFilter !== null) {
    query = query.in("territorio", territoriosFilter);
  }
  const { data, error } = await query.limit(50000);

  if (error) {
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }

  // Agregar por grupo → SKU.
  interface Acc {
    venta: number;
    kg: number;
    margen: number;
  }
  const grupos = new Map<string, { agg: Acc; skus: Map<string, Acc> }>();
  for (const r of data ?? []) {
    const grupo = r.grupo ?? "(sin grupo)";
    const sku = r.sku ?? "(sin sku)";
    const venta = Number(r.venta) || 0;
    const kg = Number(r.kg) || 0;
    const margen = Number(r.margen) || 0;

    let g = grupos.get(grupo);
    if (!g) {
      g = { agg: { venta: 0, kg: 0, margen: 0 }, skus: new Map() };
      grupos.set(grupo, g);
    }
    g.agg.venta += venta;
    g.agg.kg += kg;
    g.agg.margen += margen;

    const s = g.skus.get(sku) ?? { venta: 0, kg: 0, margen: 0 };
    s.venta += venta;
    s.kg += kg;
    s.margen += margen;
    g.skus.set(sku, s);
  }

  const pct = (m: number, v: number) => (v > 0 ? (m / v) * 100 : 0);

  const gruposOut = Array.from(grupos.entries())
    .map(([grupo, { agg, skus }]) => ({
      grupo,
      venta: agg.venta,
      kg: agg.kg,
      margen: agg.margen,
      margen_pct: pct(agg.margen, agg.venta),
      skus: Array.from(skus.entries())
        .map(([sku, a]) => ({
          sku,
          venta: a.venta,
          kg: a.kg,
          margen: a.margen,
          margen_pct: pct(a.margen, a.venta),
        }))
        .sort((a, b) => b.venta - a.venta),
    }))
    .sort((a, b) => b.venta - a.venta);

  return NextResponse.json({ grupos: gruposOut });
}
