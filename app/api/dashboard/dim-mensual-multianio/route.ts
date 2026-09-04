import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/dim-mensual-multianio
 *
 * Mejora 3 (V4.3) — vista "Meses Hist." (matriz Años × Meses). Devuelve, por
 * entidad (cliente o SKU), la venta/kg de cada mes en TODOS los años en
 * registro, para comparar mes-a-mes entre años.
 *
 * Query params:
 *   dim:         "cliente" | "sku"
 *   items:       CSV de nombres (las entidades del top de la tabla)
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV
 *   agrupador:   uuid opcional (modo vista enfocada)
 *
 * Respuesta:
 *   {
 *     years: [2024, 2025, 2026],
 *     meses: [{mes,label}]×12,
 *     entities: [{ name, byYear: {"2024": {venta:[12],kg:[12]}, ...},
 *                  total: {venta:[12],kg:[12]} }]
 *   }
 * Respeta RLS (la función es SECURITY INVOKER).
 */

const MONTH_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const dim = sp.get("dim") === "sku" ? "sku" : "cliente";

  const itemsRaw = sp.get("items") ?? "";
  const names = itemsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (names.length === 0) {
    return NextResponse.json({ years: [], meses: [], entities: [] });
  }

  const territoriosRaw = sp.get("territorios");
  let territorios: string[] | null;
  if (territoriosRaw === null) territorios = null;
  else if (territoriosRaw === "") territorios = [];
  else
    territorios = territoriosRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  if (territorios !== null && territorios.length === 0) {
    return NextResponse.json({ years: [], meses: [], entities: [] });
  }

  const { data, error } = await supabase.rpc("dim_mensual_multianio", {
    p_dimension: dim,
    p_names: names,
    p_territorios: territorios,
    p_agrupador_id: sp.get("agrupador") || null,
  });
  if (error) {
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }

  const rows = (data ?? []) as {
    name: string;
    anio: number;
    mes: number;
    venta: number;
    kg: number;
  }[];

  // Estructura: entity → year → [12] venta/kg. Además total (suma años) por mes.
  interface YearCells { venta: number[]; kg: number[] }
  interface Entity {
    name: string;
    byYear: Record<string, YearCells>;
    total: YearCells;
    totalVenta: number; // para ordenar
  }
  const zeros = () => new Array(12).fill(0) as number[];
  const byName = new Map<string, Entity>();
  const yearsSet = new Set<number>();

  for (const r of rows) {
    const mes = Number(r.mes);
    const anio = Number(r.anio);
    if (mes < 1 || mes > 12) continue;
    yearsSet.add(anio);
    const venta = Number(r.venta) || 0;
    const kg = Number(r.kg) || 0;

    let e = byName.get(r.name);
    if (!e) {
      e = { name: r.name, byYear: {}, total: { venta: zeros(), kg: zeros() }, totalVenta: 0 };
      byName.set(r.name, e);
    }
    const yk = String(anio);
    let yc = e.byYear[yk];
    if (!yc) {
      yc = { venta: zeros(), kg: zeros() };
      e.byYear[yk] = yc;
    }
    yc.venta[mes - 1] += venta;
    yc.kg[mes - 1] += kg;
    e.total.venta[mes - 1] += venta;
    e.total.kg[mes - 1] += kg;
    e.totalVenta += venta;
  }

  const years = Array.from(yearsSet).sort((a, b) => a - b);
  const meses = MONTH_SHORT_ES.map((label, i) => ({ mes: i + 1, label }));

  const entities = Array.from(byName.values())
    .sort((a, b) => b.totalVenta - a.totalVenta)
    .map((e) => ({ name: e.name, byYear: e.byYear, total: e.total }));

  return NextResponse.json({ years, meses, entities });
}
