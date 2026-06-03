import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countBizDays, findCalendarDayForBizDays } from "@/lib/business-days";

/**
 * GET /api/dashboard/tracking-clientes-activos
 *
 * Métricas de CLIENTES ACTIVOS para el card del tab Tracking Diario (Fase 10).
 * "Activo" = cliente distinto con compra (venta>0) en el mes en curso, hasta
 * el día de corte (al-día). Comparativos apples-to-apples (mismo día hábil
 * elapsed entre periodos).
 *
 * IMPORTANTE — conteo por NOMBRE (cliente), NO por no_cliente:
 *   Cada ERP (Susazón=0, Suve=1) numera a sus clientes por separado, así que
 *   un mismo cliente físico tiene no_cliente DISTINTO en cada empresa (ej.
 *   "20 CANCUN" = CL-000364 en Susazón y CL-000982 en Suve). Contar por
 *   no_cliente lo duplicaría. El nombre del cliente es consistente entre
 *   empresas, así que un cliente que compra en ambas cuenta UNA sola vez.
 *   Es además la convención del resto del dashboard (tab Clientes/Perdidos
 *   agrupan por nombre).
 *
 * Devuelve:
 *   clientesActivos:   # de clientes distintos con compra este mes al-día
 *   prevYear:          { count, label } — mismo mes año anterior, mismo día hábil
 *   prom90d:           { avg, months } — promedio de los 3 meses previos al
 *                      mismo día hábil
 *   clientesPorVendedor: media de clientes distintos por vendedor (cartera)
 *   ticketPromedio:    venta promedio por cliente activo ($ venta ÷ clientes)
 *
 * Query params: year, month, daysCurrent, territorios (igual que tracking-variedad).
 * Conteo por nombre de cliente. RLS respetada.
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
    clientesActivos: 0,
    prevYear: { count: 0, label: `${MONTH_SHORT_ES[month - 1]} ${(year - 1) % 100}` },
    prom90d: { avg: null as number | null, months: 0 },
    clientesPorVendedor: 0,
    ticketPromedio: 0,
  };
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json(emptyResp);
  }

  const elapsedBizDays = countBizDays(year, month, daysCurrent);

  // Query de clientes de un mes hasta un día de corte.
  const cliQuery = (y: number, m: number, cutoffDay: number, cols: string) => {
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

  // 3 meses previos con su día de corte equivalente.
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
  const prevYearCutoff = findCalendarDayForBizDays(year - 1, month, elapsedBizDays);

  const [curRes, prevYearRes, ...prevMonthsRes] = await Promise.all([
    cliQuery(year, month, daysCurrent, "cliente, vendedor, venta"),
    cliQuery(year - 1, month, prevYearCutoff, "cliente"),
    ...prevMonths.map((pm) => cliQuery(pm.y, pm.m, pm.cutoff, "cliente")),
  ]);

  if (curRes.error) {
    return NextResponse.json({ error: `Error: ${curRes.error.message}` }, { status: 500 });
  }

  // ===== Mes actual: clientes activos + por vendedor + ticket promedio =====
  // Conteo por NOMBRE de cliente (dedup Susazón+Suve, ver comment header).
  const cliSet = new Set<string>();
  const byVendedor = new Map<string, Set<string>>();
  let ventaTotal = 0;
  for (const r of (curRes.data ?? []) as unknown as {
    cliente: string | null;
    vendedor: string | null;
    venta: number | null;
  }[]) {
    const name = r.cliente ?? "";
    if (!name) continue;
    cliSet.add(name);
    ventaTotal += Number(r.venta) || 0;
    const ven = r.vendedor ?? "(sin vendedor)";
    if (!byVendedor.has(ven)) byVendedor.set(ven, new Set());
    byVendedor.get(ven)!.add(name);
  }
  const clientesActivos = cliSet.size;
  const sumVendedor = Array.from(byVendedor.values()).reduce((a, s) => a + s.size, 0);
  const clientesPorVendedor = byVendedor.size > 0 ? sumVendedor / byVendedor.size : 0;
  const ticketPromedio = clientesActivos > 0 ? ventaTotal / clientesActivos : 0;

  // ===== Conteo distinct de cliente (por nombre) para periodos comparativos =====
  const distinctClientes = (
    res: { data: unknown[] | null; error: unknown } | undefined
  ): number | null => {
    if (!res || res.error) return null;
    const s = new Set<string>();
    for (const r of (res.data ?? []) as { cliente: string | null }[]) {
      if (r.cliente) s.add(r.cliente);
    }
    return s.size;
  };
  const prevYearCount = distinctClientes(prevYearRes) ?? 0;

  const prevCounts = prevMonthsRes
    .map((res) => distinctClientes(res))
    .filter((c): c is number => c != null && c > 0);
  const prom90dAvg =
    prevCounts.length > 0
      ? prevCounts.reduce((a, b) => a + b, 0) / prevCounts.length
      : null;

  return NextResponse.json({
    clientesActivos,
    prevYear: {
      count: prevYearCount,
      label: `${MONTH_SHORT_ES[month - 1]} ${(year - 1) % 100}`,
    },
    prom90d: { avg: prom90dAvg, months: prevCounts.length },
    clientesPorVendedor,
    ticketPromedio,
  });
}
