import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/concentracion
 *
 * Tab Insights · Análisis de Concentración.
 *
 * Query params:
 *   from: YYYY-MM-DD (default: primer día del mes actual CDMX)
 *   to:   YYYY-MM-DD (default: hoy CDMX)
 *   dimension: "clientes" | "grupos" | "productos" (default "clientes")
 *
 * Llama la función SQL `insights_concentracion` que agrega sales_rows por
 * dimensión en el rango y respeta RLS de territorio del usuario.
 *
 * Devuelve todas las métricas (venta, kg, margen) para que el cliente
 * cambie entre Pesos/Kilos/Margen$/Margen% sin re-fetch. El margen %
 * se calcula client-side como margen / venta (no es promedio ponderado
 * trivial si solo se agregan los % por item).
 */

const ALLOWED_DIMENSIONS = new Set(["clientes", "grupos", "productos"]);
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
  const dimensionParam = (sp.get("dimension") ?? "clientes").toLowerCase();
  // territorios: lista CSV opcional. Si NO viene → null = todos los visibles
  // por RLS. Si viene vacío "" → array vacío = 0 resultados. Si viene con
  // valores → filtrar a esos territorios específicos (intersección con RLS).
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
  if (!ALLOWED_DIMENSIONS.has(dimensionParam)) {
    return NextResponse.json(
      {
        error: `Dimensión inválida. Permitidas: ${Array.from(
          ALLOWED_DIMENSIONS
        ).join(", ")}`,
      },
      { status: 400 }
    );
  }
  if (fromParam > toParam) {
    return NextResponse.json(
      { error: "from debe ser <= to" },
      { status: 400 }
    );
  }
  // Hard cap: máximo 2 años de rango (evita queries gigantescas)
  const fromDate = new Date(fromParam + "T00:00:00Z");
  const toDate = new Date(toParam + "T00:00:00Z");
  const diffDays = Math.ceil(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > 366 * 2) {
    return NextResponse.json(
      { error: "El rango máximo es de 2 años" },
      { status: 400 }
    );
  }

  // Llamar la función RPC
  const { data, error } = await supabase.rpc("insights_concentracion", {
    p_from: fromParam,
    p_to: toParam,
    p_dimension: dimensionParam,
    p_territorios: territoriosFilter,
  });

  if (error) {
    return NextResponse.json(
      { error: `Error al consultar: ${error.message}` },
      { status: 500 }
    );
  }

  // Calcular totales del universo (la suma de TODAS las filas devueltas)
  type Row = { name: string; venta: number; kg: number; margen: number };
  const rows = (data ?? []) as Row[];

  const totalVenta = rows.reduce((s, r) => s + (Number(r.venta) || 0), 0);
  const totalKg = rows.reduce((s, r) => s + (Number(r.kg) || 0), 0);
  const totalMargen = rows.reduce((s, r) => s + (Number(r.margen) || 0), 0);

  // Normalizar a números (postgres devuelve numeric como string a veces)
  const items = rows.map((r) => {
    const venta = Number(r.venta) || 0;
    const kg = Number(r.kg) || 0;
    const margen = Number(r.margen) || 0;
    return {
      name: r.name,
      venta,
      kg,
      margen,
      // Margen % de cada item (margen / venta)
      margen_pct: venta > 0 ? (margen / venta) * 100 : 0,
    };
  });

  return NextResponse.json({
    from: fromParam,
    to: toParam,
    dimension: dimensionParam,
    total_items: items.length,
    universe: {
      venta: totalVenta,
      kg: totalKg,
      margen: totalMargen,
      margen_pct: totalVenta > 0 ? (totalMargen / totalVenta) * 100 : 0,
    },
    items,
  });
}
