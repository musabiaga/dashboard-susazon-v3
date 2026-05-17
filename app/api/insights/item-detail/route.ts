import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/insights/item-detail
 *
 * Devuelve las facturas (sales_rows) que componen el agregado de un item
 * (cliente / grupo / producto) en el rango de fechas. Usado para expandir
 * filas de la tabla Pareto del tab Insights · Concentración.
 *
 * Query params:
 *   from, to: YYYY-MM-DD (rango)
 *   dimension: "clientes" | "grupos" | "productos"
 *   name: nombre del item (cliente / grupo / sku)
 *
 * Devuelve hasta 500 facturas por defecto, ordenadas por fecha desc.
 *
 * Respeta RLS de territorio del usuario (lectura directa de sales_rows
 * con el client del usuario, no service_role).
 */

const ALLOWED_DIMENSIONS = new Set(["clientes", "grupos", "productos"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 500;

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
  const dimension = (sp.get("dimension") ?? "").toLowerCase();
  const name = sp.get("name") ?? "";

  if (!ISO_DATE.test(fromParam) || !ISO_DATE.test(toParam)) {
    return NextResponse.json(
      { error: "from y to deben ser YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (!ALLOWED_DIMENSIONS.has(dimension)) {
    return NextResponse.json(
      { error: `Dimensión inválida` },
      { status: 400 }
    );
  }
  if (!name) {
    return NextResponse.json(
      { error: "name requerido" },
      { status: 400 }
    );
  }

  // Mapeo dimensión → columna de sales_rows
  const column =
    dimension === "clientes"
      ? "cliente"
      : dimension === "grupos"
        ? "grupo"
        : "sku";

  // Para grupos y productos: agrupar por cliente (resume cuáles clientes
  // compraron ese grupo/producto). Para clientes: agrupar por fecha
  // (= facturas individuales del cliente).
  if (dimension === "clientes") {
    // Para clientes: devolver filas por fecha (agregadas si hay múltiples
    // tickets el mismo día — lo cual es común con datos de comercial).
    // Suma venta/kg/margen por fecha + lista de territorios.
    const { data, error } = await supabase
      .from("sales_rows")
      .select("fecha, territorio, venta, margen, kg, vendedor, sku, grupo")
      .eq(column, name)
      .gte("fecha", fromParam)
      .lte("fecha", toParam)
      .order("fecha", { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      return NextResponse.json(
        { error: `Error: ${error.message}` },
        { status: 500 }
      );
    }

    // Agregar por (fecha, territorio) — una "factura del día"
    const byKey = new Map<
      string,
      {
        fecha: string;
        territorio: string;
        venta: number;
        margen: number;
        kg: number;
        skus: Set<string>;
        vendedor: string;
      }
    >();
    for (const r of data ?? []) {
      const key = `${r.fecha}|${r.territorio}`;
      const cur = byKey.get(key);
      const v = Number(r.venta) || 0;
      const m = Number(r.margen) || 0;
      const k = Number(r.kg) || 0;
      if (!cur) {
        byKey.set(key, {
          fecha: r.fecha,
          territorio: r.territorio,
          venta: v,
          margen: m,
          kg: k,
          skus: new Set(r.sku ? [r.sku] : []),
          vendedor: r.vendedor ?? "",
        });
      } else {
        cur.venta += v;
        cur.margen += m;
        cur.kg += k;
        if (r.sku) cur.skus.add(r.sku);
      }
    }
    const items = Array.from(byKey.values())
      .map((r) => ({
        fecha: r.fecha,
        territorio: r.territorio,
        venta: r.venta,
        margen: r.margen,
        kg: r.kg,
        margen_pct: r.venta > 0 ? (r.margen / r.venta) * 100 : 0,
        sku_count: r.skus.size,
        vendedor: r.vendedor,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    return NextResponse.json({
      kind: "facturas_por_fecha",
      total_records: items.length,
      items,
    });
  }

  // Para grupos / productos: agrupar por cliente (qué clientes compraron)
  const { data, error } = await supabase
    .from("sales_rows")
    .select("cliente, venta, margen, kg")
    .eq(column, name)
    .gte("fecha", fromParam)
    .lte("fecha", toParam)
    .limit(50000); // hasta 50k filas; el GROUP BY queda client-side

  if (error) {
    return NextResponse.json(
      { error: `Error: ${error.message}` },
      { status: 500 }
    );
  }

  const byCliente = new Map<
    string,
    { cliente: string; venta: number; margen: number; kg: number }
  >();
  for (const r of data ?? []) {
    const c = r.cliente ?? "(sin nombre)";
    const v = Number(r.venta) || 0;
    const m = Number(r.margen) || 0;
    const k = Number(r.kg) || 0;
    const cur = byCliente.get(c);
    if (!cur) byCliente.set(c, { cliente: c, venta: v, margen: m, kg: k });
    else {
      cur.venta += v;
      cur.margen += m;
      cur.kg += k;
    }
  }
  const items = Array.from(byCliente.values())
    .map((r) => ({
      cliente: r.cliente,
      venta: r.venta,
      margen: r.margen,
      kg: r.kg,
      margen_pct: r.venta > 0 ? (r.margen / r.venta) * 100 : 0,
    }))
    .sort((a, b) => b.venta - a.venta)
    .slice(0, MAX_ROWS);

  return NextResponse.json({
    kind: "clientes_por_dim",
    total_records: items.length,
    items,
  });
}
