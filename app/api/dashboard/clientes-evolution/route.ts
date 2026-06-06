import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/clientes-evolution
 *
 * Devuelve la evolución MENSUAL del año en curso (Ene → mes tope) de un
 * conjunto de entidades (clientes o SKUs). Alimenta la vista "Evolución" del
 * toggle de la gráfica superior y la vista "Meses" de la tabla del tab
 * unificado Clientes y Productos (Mejora 2/4 + Fase 2).
 *
 * Lazy: solo se llama cuando se activa la vista, y solo para las entidades
 * visibles (top N o seleccionadas).
 *
 * Query params:
 *   year:        YYYY (año a graficar)
 *   month:       1-12 (mes tope; se devuelven meses 1..month)
 *   dim:         "cliente" (default) | "sku" — dimensión de la evolución
 *   items:       CSV de nombres a incluir (clientes o SKUs según dim).
 *                Fallback: `clientes` (compat con llamados previos).
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV de territorios
 *   skus:        (opcional, SOLO dim=cliente) CSV de SKUs. Si viene, la
 *                evolución del cliente se calcula SOLO con esos productos
 *                (cruce Mejora 3: 1 cliente comprando ciertos SKUs).
 *
 * Respeta RLS de territorio (security_invoker heredado).
 *
 * Respuesta: { meses: [{mes,label}], clientes: [{name, monthly:[...]}] }
 * (la key "clientes" es el arreglo de series — se conserva el nombre por
 *  compatibilidad; en dim=sku contiene series de SKU).
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
  const year = parseInt(sp.get("year") ?? "", 10);
  const month = parseInt(sp.get("month") ?? "", 10);
  const dim = sp.get("dim") === "sku" ? "sku" : "cliente";

  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month inválido" }, { status: 400 });
  }

  // Entidades a incluir (clientes o SKUs según dim). `items` es la key
  // canónica; `clientes` se mantiene como fallback para llamados previos.
  const itemsRaw = sp.get("items") ?? sp.get("clientes") ?? "";
  const items = itemsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (items.length === 0) {
    return NextResponse.json({ meses: [], clientes: [] });
  }

  // Territorios.
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
    return NextResponse.json({ meses: [], clientes: [] });
  }

  // SKUs opcionales (solo aplica en dim=cliente: cruce Mejora 3).
  const skusRaw = sp.get("skus") ?? "";
  const skus = skusRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Cargamos filas normalizadas a { name, mes, venta, kg, margen }.
  let rows: { name: string; mes: number; venta: number; kg: number; margen: number }[] = [];
  let error: { message: string } | null = null;

  if (dim === "sku") {
    // Evolución por SKU — desde la vista pre-agregada kpi_sku_summary.
    let q = supabase
      .from("kpi_sku_summary")
      .select("sku, mes, total_venta, total_kg, total_margen")
      .eq("anio", year)
      .lte("mes", month)
      .in("sku", items);
    if (territoriosFilter !== null) q = q.in("territorio", territoriosFilter);
    const res = await q.limit(50000);
    error = res.error;
    rows = (res.data ?? []).map((r) => ({
      name: r.sku ?? "(sin sku)",
      mes: Number(r.mes),
      venta: Number(r.total_venta) || 0,
      kg: Number(r.total_kg) || 0,
      margen: Number(r.total_margen) || 0,
    }));
  } else if (skus.length > 0) {
    // dim=cliente + filtro de SKUs: ventas de esos productos por cliente
    // (cruce Mejora 3), desde sales_rows.
    let q = supabase
      .from("sales_rows")
      .select("cliente, mes, venta, kg, margen")
      .eq("anio", year)
      .lte("mes", month)
      .in("cliente", items)
      .in("sku", skus);
    if (territoriosFilter !== null) q = q.in("territorio", territoriosFilter);
    const res = await q.limit(50000);
    error = res.error;
    rows = (res.data ?? []).map((r) => ({
      name: r.cliente ?? "(sin nombre)",
      mes: Number(r.mes),
      venta: Number(r.venta) || 0,
      kg: Number(r.kg) || 0,
      margen: Number(r.margen) || 0,
    }));
  } else {
    // dim=cliente: venta total del cliente, desde la vista agregada.
    let q = supabase
      .from("kpi_cliente_summary")
      .select("cliente, mes, total_venta, total_kg, total_margen")
      .eq("anio", year)
      .lte("mes", month)
      .in("cliente", items);
    if (territoriosFilter !== null) q = q.in("territorio", territoriosFilter);
    const res = await q.limit(50000);
    error = res.error;
    rows = (res.data ?? []).map((r) => ({
      name: r.cliente ?? "(sin nombre)",
      mes: Number(r.mes),
      venta: Number(r.total_venta) || 0,
      kg: Number(r.total_kg) || 0,
      margen: Number(r.total_margen) || 0,
    }));
  }

  if (error) {
    return NextResponse.json(
      { error: `Error: ${error.message}` },
      { status: 500 }
    );
  }

  // Agregar por (name, mes).
  const byName = new Map<
    string,
    Map<number, { venta: number; kg: number; margen: number }>
  >();
  for (const r of rows) {
    if (r.mes < 1 || r.mes > 12) continue;
    let perMonth = byName.get(r.name);
    if (!perMonth) {
      perMonth = new Map();
      byName.set(r.name, perMonth);
    }
    const cur = perMonth.get(r.mes) ?? { venta: 0, kg: 0, margen: 0 };
    cur.venta += r.venta;
    cur.kg += r.kg;
    cur.margen += r.margen;
    perMonth.set(r.mes, cur);
  }

  const meses = [];
  for (let m = 1; m <= month; m++) {
    meses.push({ mes: m, label: MONTH_SHORT_ES[m - 1] });
  }

  // Series por entidad (mes sin venta = 0). Respeta el orden de `items`.
  const series = items.map((name) => {
    const perMonth = byName.get(name);
    const monthly = [];
    for (let m = 1; m <= month; m++) {
      const cell = perMonth?.get(m) ?? { venta: 0, kg: 0, margen: 0 };
      monthly.push({
        mes: m,
        venta: cell.venta,
        kg: cell.kg,
        margen: cell.margen,
        margen_pct: cell.venta > 0 ? (cell.margen / cell.venta) * 100 : 0,
      });
    }
    return { name, monthly };
  });

  // key "clientes" conservada por compatibilidad (es el arreglo de series).
  return NextResponse.json({ meses, clientes: series });
}
