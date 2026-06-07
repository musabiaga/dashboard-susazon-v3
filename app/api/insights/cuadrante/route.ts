import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/cuadrante
 *
 * Sub-análisis "Cuadrante de cartera (BCG)" del tab Insights.
 *
 * Para cada item de la dimensión, devuelve venta/kg/margen del periodo actual
 * [from, to] + venta del MISMO rango calendario del año anterior. El frontend
 * arma: tamaño (venta actual), crecimiento YoY %, margen (burbuja) y separa
 * los "Nuevos" (sin base el año anterior).
 *
 * Query params:
 *   from, to:     YYYY-MM-DD (periodo actual)
 *   dimension:    clientes | grupos | productos | territorios (default clientes)
 *   territorios:  null=todos visibles | ""=ninguno | CSV=subset
 *
 * El rango del año anterior se calcula aquí: mismas fechas calendario − 1 año.
 * Respeta RLS de territorio.
 */

const ALLOWED_DIMENSIONS = new Set([
  "clientes",
  "grupos",
  "productos",
  "territorios",
]);
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
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    return NextResponse.json(
      {
        error: `Dimensión inválida. Permitidas: ${Array.from(
          ALLOWED_DIMENSIONS
        ).join(", ")}`,
      },
      { status: 400 }
    );
  }
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({
      dimension,
      from: fromParam,
      to: toParam,
      items: [],
    });
  }

  const prevFrom = shiftYear(fromParam, -1);
  const prevTo = shiftYear(toParam, -1);

  const { data, error } = await supabase.rpc("insights_cuadrante", {
    p_from: fromParam,
    p_to: toParam,
    p_from_prev: prevFrom,
    p_to_prev: prevTo,
    p_dimension: dimension,
    p_territorios: territoriosFilter,
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
    kg_actual: number;
    margen_actual: number;
    venta_prev: number;
  };
  const items = ((data ?? []) as Row[]).map((r) => {
    const ventaActual = Number(r.venta_actual) || 0;
    const ventaPrev = Number(r.venta_prev) || 0;
    const margenActual = Number(r.margen_actual) || 0;
    return {
      name: r.name,
      ventaActual,
      kgActual: Number(r.kg_actual) || 0,
      margenActual,
      ventaPrev,
      margenPct: ventaActual > 0 ? (margenActual / ventaActual) * 100 : 0,
      // crecimiento null = Nuevo (sin base el año anterior)
      crecimiento: ventaPrev > 0 ? ((ventaActual - ventaPrev) / ventaPrev) * 100 : null,
    };
  });

  return NextResponse.json({
    dimension,
    from: fromParam,
    to: toParam,
    prevFrom,
    prevTo,
    items,
  });
}
