import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countBizDays, findCalendarDayForBizDays } from "@/lib/business-days";

/**
 * GET /api/dashboard/cliente-desglose
 *
 * Devuelve los SKUs que compra un cliente, con la MISMA estructura de 3 años
 * al-día que el encabezado (v/k/m por año 24/25/26 + al-día). Alimenta el
 * desglose expandible de un cliente en la vista "Año vs Año" del tab
 * Clientes/Productos (Mejora 2, V4.3). Antes agrupaba por grupo→SKU con solo
 * el periodo actual; ahora aplana a SKU con comparación de 3 años.
 *
 * Query params:
 *   year:        YYYY (año actual del filtro)
 *   month:       1-12
 *   daysCurrent: día calendario de corte (para el al-día)
 *   cliente:     nombre del cliente
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV
 *
 * Calcula el "al-día" (acumulado al mismo día hábil) por año con los helpers
 * de business-days, idéntico a clientes-por-producto. Respeta RLS.
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
    return NextResponse.json({ rows: [] });
  }

  // Cutoffs al-día (idéntico a clientes-por-producto): mismo número de días
  // hábiles entre años.
  const elapsedBizDays = countBizDays(year, month, daysCurrent);
  const cutoffByYear: Record<number, number> = {
    [year]: daysCurrent,
    [year - 1]: findCalendarDayForBizDays(year - 1, month, elapsedBizDays),
    [year - 2]: findCalendarDayForBizDays(year - 2, month, elapsedBizDays),
  };

  // 1 query: ventas del cliente en el mes, los 3 años, por SKU.
  let query = supabase
    .from("sales_rows")
    .select("sku, fecha, anio, venta, kg, margen")
    .eq("cliente", cliente)
    .eq("mes", month)
    .in("anio", [year - 2, year - 1, year]);
  if (territoriosFilter !== null) {
    query = query.in("territorio", territoriosFilter);
  }
  const { data, error } = await query.limit(50000);

  if (error) {
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }

  // Agregar por SKU: cierre (todo el mes) + al-día (dia <= cutoff del año).
  interface Agg {
    name: string;
    v24: number; v25: number; v26: number;
    k24: number; k25: number; k26: number;
    m24: number; m25: number; m26: number;
    v24_alDia: number; v25_alDia: number; v26_alDia: number;
    k24_alDia: number; k25_alDia: number; k26_alDia: number;
    m24_alDia: number; m25_alDia: number; m26_alDia: number;
  }
  const bySku = new Map<string, Agg>();
  const blank = (name: string): Agg => ({
    name,
    v24: 0, v25: 0, v26: 0,
    k24: 0, k25: 0, k26: 0,
    m24: 0, m25: 0, m26: 0,
    v24_alDia: 0, v25_alDia: 0, v26_alDia: 0,
    k24_alDia: 0, k25_alDia: 0, k26_alDia: 0,
    m24_alDia: 0, m25_alDia: 0, m26_alDia: 0,
  });

  for (const r of data ?? []) {
    const name = r.sku ?? "(sin sku)";
    const anio = Number(r.anio);
    const venta = Number(r.venta) || 0;
    const kg = Number(r.kg) || 0;
    const margen = Number(r.margen) || 0;
    const dia = new Date(r.fecha + "T12:00:00").getDate();

    let agg = bySku.get(name);
    if (!agg) {
      agg = blank(name);
      bySku.set(name, agg);
    }

    const isAlDia = dia <= (cutoffByYear[anio] ?? 0);
    if (anio === year - 2) {
      agg.v24 += venta; agg.k24 += kg; agg.m24 += margen;
      if (isAlDia) { agg.v24_alDia += venta; agg.k24_alDia += kg; agg.m24_alDia += margen; }
    } else if (anio === year - 1) {
      agg.v25 += venta; agg.k25 += kg; agg.m25 += margen;
      if (isAlDia) { agg.v25_alDia += venta; agg.k25_alDia += kg; agg.m25_alDia += margen; }
    } else if (anio === year) {
      agg.v26 += venta; agg.k26 += kg; agg.m26 += margen;
      if (isAlDia) { agg.v26_alDia += venta; agg.k26_alDia += kg; agg.m26_alDia += margen; }
    }
  }

  // Ordenar por venta al-día del año actual (el componente re-ordena igual).
  const rows = Array.from(bySku.values()).sort(
    (a, b) => b.v26_alDia - a.v26_alDia
  );

  return NextResponse.json({ rows });
}
