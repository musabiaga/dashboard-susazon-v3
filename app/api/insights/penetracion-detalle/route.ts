import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/penetracion-detalle
 *
 * Drill-down del sub-análisis "Penetración / Canasta". Devuelve la lista
 * COMPLETA de la otra dimensión para un item:
 *   · dimension=clientes  + key=<cliente> → todos los SKUs que compra
 *   · dimension=productos + key=<sku>     → todos los clientes que lo compran
 *
 * Para cada uno: venta + margen del periodo actual [from, to] vs el mismo
 * rango del año anterior, y el frontend marca nuevos (sin base año anterior)
 * y perdidos (sin actividad este año).
 *
 * Query params:
 *   from, to:     YYYY-MM-DD. `to` debe ser el effectiveTo del resumen, para
 *                 que los números reconcilien (no se re-capa aquí).
 *   dimension:    clientes | productos
 *   key:          cliente (o sku) seleccionado
 *   territorios:  null=todos visibles | ""=ninguno | CSV=subset
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
  const key = sp.get("key") ?? "";

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
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    return NextResponse.json(
      { error: "Dimensión inválida. Permitidas: clientes, productos" },
      { status: 400 }
    );
  }
  if (!key) {
    return NextResponse.json({ error: "Falta el parámetro key" }, { status: 400 });
  }
  if (!sp.get("agrupador") && territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({ dimension, key, items: [] });
  }

  const prevFrom = shiftYear(fromParam, -1);
  const prevTo = shiftYear(toParam, -1);

  const { data, error } = await supabase.rpc("insights_penetracion_detalle", {
    p_from: fromParam,
    p_to: toParam,
    p_from_prev: prevFrom,
    p_to_prev: prevTo,
    p_dimension: dimension,
    p_key: key,
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
    venta_actual: number;
    venta_prev: number;
    margen_actual: number;
    margen_prev: number;
    kg_actual: number;
    kg_prev: number;
  };
  const items = ((data ?? []) as Row[]).map((r) => {
    const vA = Number(r.venta_actual) || 0;
    const vP = Number(r.venta_prev) || 0;
    const mA = Number(r.margen_actual) || 0;
    const mP = Number(r.margen_prev) || 0;
    const kA = Number(r.kg_actual) || 0;
    const kP = Number(r.kg_prev) || 0;
    return {
      name: r.name,
      ventaActual: vA,
      ventaPrev: vP,
      deltaVenta: vA - vP,
      margenActual: mA,
      margenPrev: mP,
      kgActual: kA,
      kgPrev: kP,
      margenPctActual: vA > 0 ? (mA / vA) * 100 : 0,
      margenPctPrev: vP > 0 ? (mP / vP) * 100 : 0,
      esNuevo: vP === 0 && vA > 0,
      esPerdido: vA === 0 && vP > 0,
    };
  });

  return NextResponse.json({ dimension, key, from: fromParam, to: toParam, prevFrom, prevTo, items });
}
