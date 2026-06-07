import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/precio-dispersion
 *
 * Sub-análisis "Dispersión de precio ($/kg)" del tab Insights.
 *
 * Dos modos según si viene `item`:
 *
 *  1) LISTA (sin item): devuelve los items del nivel (sku|grupo|familia)
 *     con su volumen (kg) + venta acumulados en el rango, ordenados por
 *     volumen. Alimenta el selector (default = el de mayor volumen).
 *     → { level, items: [{ name, kg, venta, precioKg }] }
 *
 *  2) DETALLE (con item): para ese item, el desglose por CLIENTE con su
 *     precio/kg ponderado (Σventa ÷ Σkg), kg, venta, margen y margen %,
 *     más el universo (promedio ponderado global del item).
 *     → { level, item, universe:{...}, clientes:[{...}] }
 *
 * El frontend aplica EN VIVO el umbral "paga barato" (−X% vs promedio) y el
 * piso de volumen (cubrir X% del volumen) sobre la lista de clientes, sin
 * re-fetch. Respeta RLS de territorio.
 *
 * Query params:
 *   from, to:     YYYY-MM-DD
 *   level:        sku | grupo | familia   (default sku)
 *   item:         (opcional) nombre exacto del item para el desglose
 *   territorios:  null=todos visibles | ""=ninguno | CSV=subset
 */

const ALLOWED_LEVELS = new Set(["sku", "grupo", "familia"]);
const LEVEL_COLUMN: Record<string, "sku" | "grupo" | "familia"> = {
  sku: "sku",
  grupo: "grupo",
  familia: "familia",
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const fromParam = sp.get("from") ?? "";
  const toParam = sp.get("to") ?? "";
  const level = (sp.get("level") ?? "sku").toLowerCase();
  const item = sp.get("item");

  const territoriosParamRaw = sp.get("territorios");
  let territoriosFilter: string[] | null;
  if (territoriosParamRaw === null) {
    territoriosFilter = null;
  } else if (territoriosParamRaw === "") {
    territoriosFilter = [];
  } else {
    territoriosFilter = territoriosParamRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Validación
  if (!ISO_DATE.test(fromParam) || !ISO_DATE.test(toParam)) {
    return NextResponse.json(
      { error: "Parámetros from y to deben ser fechas YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (fromParam > toParam) {
    return NextResponse.json(
      { error: "from no puede ser mayor que to" },
      { status: 400 }
    );
  }
  if (!ALLOWED_LEVELS.has(level)) {
    return NextResponse.json(
      {
        error: `Nivel inválido. Permitidos: ${Array.from(ALLOWED_LEVELS).join(
          ", "
        )}`,
      },
      { status: 400 }
    );
  }
  // territorios vacío explícito → universo vacío
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return item
      ? NextResponse.json({ level, item, universe: null, clientes: [] })
      : NextResponse.json({ level, items: [] });
  }

  // ===== Modo LISTA (sin item) =====
  if (!item) {
    const { data, error } = await supabase.rpc("insights_precio_items", {
      p_from: fromParam,
      p_to: toParam,
      p_level: level,
      p_territorios: territoriosFilter,
    });
    if (error) {
      return NextResponse.json(
        { error: `Error al consultar: ${error.message}` },
        { status: 500 }
      );
    }
    type Row = { name: string; kg: number; venta: number };
    const items = ((data ?? []) as Row[]).map((r) => {
      const kg = Number(r.kg) || 0;
      const venta = Number(r.venta) || 0;
      return {
        name: r.name,
        kg,
        venta,
        precioKg: kg > 0 ? venta / kg : 0,
      };
    });
    return NextResponse.json({ level, items });
  }

  // ===== Modo DETALLE (con item) =====
  const column = LEVEL_COLUMN[level];
  let query = supabase
    .from("sales_rows")
    .select("cliente, venta, kg, margen")
    .eq(column, item)
    .gte("fecha", fromParam)
    .lte("fecha", toParam)
    .gt("kg", 0);
  if (territoriosFilter !== null) {
    query = query.in("territorio", territoriosFilter);
  }
  const { data, error } = await query.limit(50000);
  if (error) {
    return NextResponse.json(
      { error: `Error al consultar: ${error.message}` },
      { status: 500 }
    );
  }

  // Agregar por cliente
  interface Agg {
    name: string;
    kg: number;
    venta: number;
    margen: number;
  }
  const byCliente = new Map<string, Agg>();
  let uKg = 0;
  let uVenta = 0;
  let uMargen = 0;
  for (const r of data ?? []) {
    const name = r.cliente ?? "(sin nombre)";
    const kg = Number(r.kg) || 0;
    const venta = Number(r.venta) || 0;
    const margen = Number(r.margen) || 0;
    let agg = byCliente.get(name);
    if (!agg) {
      agg = { name, kg: 0, venta: 0, margen: 0 };
      byCliente.set(name, agg);
    }
    agg.kg += kg;
    agg.venta += venta;
    agg.margen += margen;
    uKg += kg;
    uVenta += venta;
    uMargen += margen;
  }

  const clientes = Array.from(byCliente.values())
    .map((a) => ({
      name: a.name,
      kg: a.kg,
      venta: a.venta,
      margen: a.margen,
      precioKg: a.kg > 0 ? a.venta / a.kg : 0,
      margenPct: a.venta > 0 ? (a.margen / a.venta) * 100 : 0,
    }))
    // Por volumen desc (sirve para el piso "cubrir X% del volumen")
    .sort((a, b) => b.kg - a.kg);

  return NextResponse.json({
    level,
    item,
    universe: {
      kg: uKg,
      venta: uVenta,
      margen: uMargen,
      precioKg: uKg > 0 ? uVenta / uKg : 0,
      margenPct: uVenta > 0 ? (uMargen / uVenta) * 100 : 0,
      totalClientes: clientes.length,
    },
    clientes,
  });
}
