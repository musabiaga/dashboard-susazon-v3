import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countBizDays, findCalendarDayForBizDays } from "@/lib/business-days";

/**
 * GET /api/dashboard/tracking-variedad
 *
 * Métricas de VARIEDAD (amplitud del catálogo) para el card "Variedad" del
 * tab Tracking Diario (Fase 10). Todo al-día (hasta el día de corte) y
 * apples-to-apples entre periodos (mismo día hábil elapsed).
 *
 * Devuelve:
 *   skusMes:          # de SKUs distintos vendidos (venta>0) este mes al-día
 *   prevYear:         { count, label } — # SKUs mismo mes año anterior, al
 *                     mismo día hábil equivalente
 *   prom90d:          { avg, months } — promedio de SKUs distintos de los 3
 *                     meses previos, cada uno contado hasta el mismo día hábil
 *   promPorCliente:   media de SKUs distintos por cliente (mes al-día)
 *   promPorVendedor:  media de SKUs distintos por vendedor (mes al-día)
 *
 * Query params:
 *   year:        YYYY
 *   month:       1-12
 *   daysCurrent: día calendario de corte (al-día)
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV
 *
 * 1 query del mes actual (da skusMes + por cliente + por vendedor) + 1 del año
 * anterior + 3 de los meses previos. Todas a sales_rows con venta>0. RLS.
 */

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function cutoffISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  const year = parseInt(sp.get("year") ?? "", 10);
  const month = parseInt(sp.get("month") ?? "", 10);
  const daysCurrent = parseInt(sp.get("daysCurrent") ?? "", 10);

  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month inválido" }, { status: 400 });
  }
  if (!Number.isFinite(daysCurrent) || daysCurrent < 1 || daysCurrent > 31) {
    return NextResponse.json({ error: "daysCurrent inválido" }, { status: 400 });
  }

  // Territorios — mismo patrón que los demás endpoints.
  const territoriosRaw = sp.get("territorios");
  let territoriosFilter: string[] | null;
  if (territoriosRaw === null) territoriosFilter = null;
  else if (territoriosRaw === "") territoriosFilter = [];
  else
    territoriosFilter = territoriosRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const emptyResp = {
    skusMes: 0,
    prevYear: { count: 0, label: `${MONTH_SHORT_ES[month - 1]} ${(year - 1) % 100}` },
    prom90d: { avg: null as number | null, months: 0 },
    promPorCliente: 0,
    promPorVendedor: 0,
  };
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json(emptyResp);
  }

  // Días hábiles transcurridos del mes actual (referencia para apples-to-apples).
  const elapsedBizDays = countBizDays(year, month, daysCurrent);

  // Helper para construir una query de SKUs de un mes hasta un día de corte.
  const skuQuery = (y: number, m: number, cutoffDay: number, cols: string) => {
    let q = supabase
      .from("sales_rows")
      .select(cols)
      .eq("anio", y)
      .eq("mes", m)
      .lte("fecha", cutoffISO(y, m, cutoffDay))
      .gt("venta", 0);
    if (territoriosFilter !== null) q = q.in("territorio", territoriosFilter);
    return q.limit(50000);
  };

  // Meses previos (3) con su día de corte equivalente (mismo día hábil elapsed).
  const prevMonths: { y: number; m: number; cutoff: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    let pm = month - i;
    let py = year;
    while (pm <= 0) {
      pm += 12;
      py -= 1;
    }
    prevMonths.push({
      y: py,
      m: pm,
      cutoff: findCalendarDayForBizDays(py, pm, elapsedBizDays),
    });
  }

  // Año anterior, mismo mes, mismo día hábil equivalente.
  const prevYearCutoff = findCalendarDayForBizDays(year - 1, month, elapsedBizDays);

  // Disparar todas las queries en paralelo.
  const [curRes, prevYearRes, ...prevMonthsRes] = await Promise.all([
    skuQuery(year, month, daysCurrent, "cliente, vendedor, sku"),
    skuQuery(year - 1, month, prevYearCutoff, "sku"),
    ...prevMonths.map((pm) => skuQuery(pm.y, pm.m, pm.cutoff, "sku")),
  ]);

  if (curRes.error) {
    return NextResponse.json({ error: `Error: ${curRes.error.message}` }, { status: 500 });
  }

  // ===== Mes actual: skusMes + por cliente + por vendedor =====
  const skuSet = new Set<string>();
  const byCliente = new Map<string, Set<string>>();
  const byVendedor = new Map<string, Set<string>>();
  for (const r of (curRes.data ?? []) as unknown as {
    cliente: string | null;
    vendedor: string | null;
    sku: string | null;
  }[]) {
    const sku = r.sku ?? "";
    if (!sku) continue;
    skuSet.add(sku);
    const cli = r.cliente ?? "(sin nombre)";
    const ven = r.vendedor ?? "(sin vendedor)";
    if (!byCliente.has(cli)) byCliente.set(cli, new Set());
    byCliente.get(cli)!.add(sku);
    if (!byVendedor.has(ven)) byVendedor.set(ven, new Set());
    byVendedor.get(ven)!.add(sku);
  }
  const skusMes = skuSet.size;
  const sumCliente = Array.from(byCliente.values()).reduce((a, s) => a + s.size, 0);
  const sumVendedor = Array.from(byVendedor.values()).reduce((a, s) => a + s.size, 0);
  const promPorCliente = byCliente.size > 0 ? sumCliente / byCliente.size : 0;
  const promPorVendedor = byVendedor.size > 0 ? sumVendedor / byVendedor.size : 0;

  // ===== Año anterior =====
  const distinctCount = (
    res: { data: unknown[] | null; error: unknown } | undefined
  ): number | null => {
    if (!res || res.error) return null;
    const s = new Set<string>();
    for (const r of (res.data ?? []) as { sku: string | null }[]) {
      if (r.sku) s.add(r.sku);
    }
    return s.size;
  };
  const prevYearCount = distinctCount(prevYearRes) ?? 0;

  // ===== Prom. 90 días (3 meses previos, mismo día hábil) =====
  const prevCounts = prevMonthsRes
    .map((res) => distinctCount(res))
    .filter((c): c is number => c != null && c > 0);
  const prom90dAvg =
    prevCounts.length > 0
      ? prevCounts.reduce((a, b) => a + b, 0) / prevCounts.length
      : null;

  return NextResponse.json({
    skusMes,
    prevYear: {
      count: prevYearCount,
      label: `${MONTH_SHORT_ES[month - 1]} ${(year - 1) % 100}`,
    },
    prom90d: { avg: prom90dAvg, months: prevCounts.length },
    promPorCliente,
    promPorVendedor,
  });
}
