import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/penetracion
 *
 * Sub-análisis "Penetración / Canasta" del tab Insights (resumen).
 *
 * Por cliente: # de SKUs distintos que compra. Por sku: # de clientes
 * distintos que lo compran. Para cada fila devuelve el conteo + venta +
 * margen del periodo actual [from, to] y del MISMO rango calendario del año
 * anterior, y el frontend lee los deltas (Δ n, Δ venta, Δ margen %). Incluye
 * altas (nuevos) y bajas (perdidos).
 *
 * Query params:
 *   from, to:     YYYY-MM-DD (periodo actual; típicamente YTD)
 *   dimension:    clientes | productos (default clientes)
 *   territorios:  null=todos visibles | ""=ninguno | CSV=subset
 *
 * El rango del año anterior se calcula aquí (mismas fechas − 1 año). El
 * periodo actual se capa a la última fecha con datos (effectiveTo) para una
 * comparación justa día-vs-día. Respeta RLS de territorio.
 */

const ALLOWED_DIMENSIONS = new Set(["clientes", "productos"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function shiftYear(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + delta, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

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
  const dimension = (sp.get("dimension") ?? "clientes").toLowerCase();

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
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    return NextResponse.json(
      { error: "Dimensión inválida. Permitidas: clientes, productos" },
      { status: 400 }
    );
  }
  if (!sp.get("agrupador") && territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({ dimension, from: fromParam, to: toParam, items: [] });
  }

  // Capar el periodo actual a la última fecha con datos (comparación justa).
  let effectiveTo = toParam;
  {
    let maxQ = supabase
      .from("sales_rows")
      .select("fecha")
      .gte("fecha", fromParam)
      .lte("fecha", toParam)
      .order("fecha", { ascending: false })
      .limit(1);
    if (territoriosFilter !== null) maxQ = maxQ.in("territorio", territoriosFilter);
    const { data: maxData } = await maxQ;
    const last = (maxData?.[0]?.fecha as string | undefined) ?? undefined;
    if (last && last < toParam) effectiveTo = last;
  }

  const prevFrom = shiftYear(fromParam, -1);
  const prevTo = shiftYear(effectiveTo, -1);

  const { data, error } = await supabase.rpc("insights_penetracion", {
    p_from: fromParam,
    p_to: effectiveTo,
    p_from_prev: prevFrom,
    p_to_prev: prevTo,
    p_dimension: dimension,
    p_territorios: territoriosFilter,
    p_agrupador_id: sp.get("agrupador") || null,
  });

  if (error) {
    return NextResponse.json(
      { error: `Error al consultar: ${error.message}` },
      { status: 500 }
    );
  }

  type Row = {
    name: string;
    n_actual: number;
    n_prev: number;
    venta_actual: number;
    venta_prev: number;
    margen_actual: number;
    margen_prev: number;
    kg_actual: number;
    kg_prev: number;
  };
  const items = ((data ?? []) as Row[]).map((r) => {
    const nA = Number(r.n_actual) || 0;
    const nP = Number(r.n_prev) || 0;
    const vA = Number(r.venta_actual) || 0;
    const vP = Number(r.venta_prev) || 0;
    const mA = Number(r.margen_actual) || 0;
    const mP = Number(r.margen_prev) || 0;
    const kA = Number(r.kg_actual) || 0;
    const kP = Number(r.kg_prev) || 0;
    const mpA = vA > 0 ? (mA / vA) * 100 : 0;
    const mpP = vP > 0 ? (mP / vP) * 100 : 0;
    return {
      name: r.name,
      nActual: nA,
      nPrev: nP,
      deltaN: nA - nP,
      ventaActual: vA,
      ventaPrev: vP,
      deltaVenta: vA - vP,
      margenActual: mA,
      margenPrev: mP,
      kgActual: kA,
      kgPrev: kP,
      deltaKg: kA - kP,
      margenPctActual: mpA,
      margenPctPrev: mpP,
      deltaMargenPct: mpA - mpP,
      esNuevo: vP === 0 && vA > 0,
      esPerdido: vA === 0 && vP > 0,
    };
  });

  return NextResponse.json({
    dimension,
    from: fromParam,
    to: toParam,
    effectiveTo,
    capped: effectiveTo !== toParam,
    prevFrom,
    prevTo,
    items,
  });
}
