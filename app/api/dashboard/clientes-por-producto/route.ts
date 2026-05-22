import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countBizDays, findCalendarDayForBizDays } from "@/lib/business-days";

/**
 * GET /api/dashboard/clientes-por-producto
 *
 * Devuelve los clientes que compran un conjunto de SKUs, con la misma
 * estructura que DimensionRow (3 años + al-día), para alimentar la gráfica y
 * la tabla del tab Clientes cuando el buscador está en modo "Productos"
 * (Mejora 3).
 *
 * Lazy: solo se llama cuando el usuario selecciona SKUs en modo Productos.
 *
 * Query params:
 *   year:        YYYY (año actual del filtro)
 *   month:       1-12
 *   daysCurrent: día calendario de corte (para el al-día). Replica el daysCurrent
 *                del server (respeta el selector de día / asOf).
 *   skus:        CSV de SKUs seleccionados (URL-encoded)
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV de territorios
 *   topN:        cuántos clientes devolver (default 50, para alimentar tabla)
 *
 * Calcula el "al-día" (acumulado al mismo día hábil) por año usando los
 * helpers de business-days, idéntico a app/dashboard/page.tsx. Respeta RLS.
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
  const topN = Math.min(Math.max(parseInt(sp.get("topN") ?? "50", 10) || 50, 1), 2000);

  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month inválido" }, { status: 400 });
  }
  if (!Number.isFinite(daysCurrent) || daysCurrent < 1 || daysCurrent > 31) {
    return NextResponse.json({ error: "daysCurrent inválido" }, { status: 400 });
  }

  const skusRaw = sp.get("skus") ?? "";
  const skus = skusRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (skus.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  // Territorios — mismo patrón que los otros endpoints.
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

  // Cutoffs al-día (idéntico a page.tsx): mismo número de días hábiles entre años.
  const elapsedBizDays = countBizDays(year, month, daysCurrent);
  const cutoffByYear: Record<number, number> = {
    [year]: daysCurrent,
    [year - 1]: findCalendarDayForBizDays(year - 1, month, elapsedBizDays),
    [year - 2]: findCalendarDayForBizDays(year - 2, month, elapsedBizDays),
  };

  // 1 query: ventas de los SKUs seleccionados en el mes, los 3 años.
  let query = supabase
    .from("sales_rows")
    .select("cliente, fecha, anio, venta, kg, margen")
    .in("sku", skus)
    .eq("mes", month)
    .in("anio", [year - 2, year - 1, year]);
  if (territoriosFilter !== null) {
    query = query.in("territorio", territoriosFilter);
  }
  const { data, error } = await query.limit(50000);

  if (error) {
    return NextResponse.json(
      { error: `Error: ${error.message}` },
      { status: 500 }
    );
  }

  // Agregar por cliente: cierre (todo el mes) + al-día (dia <= cutoff del año).
  interface Agg {
    name: string;
    v24: number; v25: number; v26: number;
    k24: number; k25: number; k26: number;
    m24: number; m25: number; m26: number;
    v24_alDia: number; v25_alDia: number; v26_alDia: number;
    k24_alDia: number; k25_alDia: number; k26_alDia: number;
    m24_alDia: number; m25_alDia: number; m26_alDia: number;
  }
  const byCliente = new Map<string, Agg>();
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
    const name = r.cliente ?? "(sin nombre)";
    const anio = Number(r.anio);
    const venta = Number(r.venta) || 0;
    const kg = Number(r.kg) || 0;
    const margen = Number(r.margen) || 0;
    const dia = new Date(r.fecha + "T12:00:00").getDate();

    let agg = byCliente.get(name);
    if (!agg) {
      agg = blank(name);
      byCliente.set(name, agg);
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

  // Top N por venta del año actual (cierre del mes).
  const rows = Array.from(byCliente.values())
    .sort((a, b) => b.v26 - a.v26)
    .slice(0, topN);

  return NextResponse.json({ rows });
}
