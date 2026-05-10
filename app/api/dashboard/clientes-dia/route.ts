import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/clientes-dia
 *
 * Devuelve el desglose de clientes que facturaron en un día específico.
 * Usado por el tab Tracking Diario para expandir cada fila de la tabla
 * y ver qué clientes vendieron ese día (lazy load, solo cuando el
 * usuario lo solicita).
 *
 * Query params:
 *   - year: YYYY (ej. 2026)
 *   - month: 1-12
 *   - day: 1-31
 *   - territorio: nombre del territorio (opcional). Vacío o ausente = todos
 *     los territorios visibles para el usuario (RLS filtra automáticamente).
 *
 * Auth: requiere sesión activa. RLS de Supabase filtra automáticamente
 * los territorios visibles para el usuario consultando.
 *
 * Response 200:
 *   {
 *     items: Array<{
 *       no_cliente: string;
 *       cliente: string;
 *       vendedor: string;
 *       venta: number;
 *       margen: number;
 *       kg: number;
 *       marginPct: number;
 *     }>;
 *     total: { venta, margen, kg, marginPct };
 *   }
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get("year") ?? "", 10);
  const month = parseInt(url.searchParams.get("month") ?? "", 10);
  const day = parseInt(url.searchParams.get("day") ?? "", 10);
  const territorio = url.searchParams.get("territorio") || ""; // "" = todos

  // Validación de rangos
  if (
    !Number.isFinite(year) ||
    year < 2024 ||
    year > 2030 ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isFinite(day) ||
    day < 1 ||
    day > 31
  ) {
    return NextResponse.json(
      { error: "Parámetros inválidos: year (>=2024), month (1-12), day (1-31)" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query a kpi_cliente_diario (RLS filtra por territorios visibles del usuario).
  let query = supabase
    .from("kpi_cliente_diario")
    .select(
      "territorio, no_cliente, cliente, vendedor, total_venta, total_margen, total_kg"
    )
    .eq("anio", year)
    .eq("mes", month)
    .eq("dia", day);

  if (territorio) {
    query = query.eq("territorio", territorio);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `Error consultando clientes del día: ${error.message}` },
      { status: 500 }
    );
  }

  // Agregar por no_cliente (suma todos los territorios que el RLS dejó ver).
  // Cuando territorio != "" (filtro específico) ya viene 1 row por cliente,
  // pero el agregar es idempotente.
  type Acc = {
    no_cliente: string;
    cliente: string;
    vendedor: string;
    venta: number;
    margen: number;
    kg: number;
  };
  const aggMap = new Map<string, Acc>();
  for (const row of data ?? []) {
    const key = row.no_cliente;
    const cur = aggMap.get(key) ?? {
      no_cliente: row.no_cliente,
      cliente: row.cliente ?? row.no_cliente,
      vendedor: row.vendedor ?? "(sin vendedor)",
      venta: 0,
      margen: 0,
      kg: 0,
    };
    cur.venta += Number(row.total_venta) || 0;
    cur.margen += Number(row.total_margen) || 0;
    cur.kg += Number(row.total_kg) || 0;
    aggMap.set(key, cur);
  }

  // Sort por venta descendente
  const items = Array.from(aggMap.values())
    .map((a) => ({
      ...a,
      marginPct: a.venta > 0 ? (a.margen / a.venta) * 100 : 0,
    }))
    .sort((a, b) => b.venta - a.venta);

  // Total agregado del día
  const total = items.reduce(
    (acc, it) => ({
      venta: acc.venta + it.venta,
      margen: acc.margen + it.margen,
      kg: acc.kg + it.kg,
    }),
    { venta: 0, margen: 0, kg: 0 }
  );
  const totalWithPct = {
    ...total,
    marginPct: total.venta > 0 ? (total.margen / total.venta) * 100 : 0,
  };

  return NextResponse.json(
    {
      items,
      total: totalWithPct,
    },
    {
      // Cache short HTTP cache (60s) — la data del día no cambia tan seguido.
      // Si el admin refresca data, los días anteriores son inmutables.
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    }
  );
}
