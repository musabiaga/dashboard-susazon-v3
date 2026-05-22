import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/clientes-evolution
 *
 * Devuelve la evolución MENSUAL del año en curso (Ene → mes tope) de un
 * conjunto de clientes. Alimenta la vista "Evolución 2026" del toggle de la
 * gráfica superior del tab Clientes (Mejora 2).
 *
 * Lazy: el tab solo lo llama cuando el usuario activa la vista de evolución,
 * y solo para los clientes visibles (top N o seleccionados). Así no infla la
 * carga inicial del dashboard.
 *
 * Query params:
 *   year:        YYYY (año a graficar; típicamente el año en curso)
 *   month:       1-12 (mes tope; se devuelven meses 1..month)
 *   clientes:    CSV de nombres de cliente a incluir (URL-encoded)
 *   territorios: null (todos visibles por RLS) | "" (ninguno) | CSV de territorios
 *
 * Respeta RLS de territorio (lectura directa de kpi_cliente_summary con el
 * client del usuario, security_invoker heredado).
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

  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "month inválido" }, { status: 400 });
  }

  // Clientes a incluir (requerido — el chart solo grafica los visibles).
  const clientesRaw = sp.get("clientes") ?? "";
  const clientes = clientesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (clientes.length === 0) {
    return NextResponse.json({ meses: [], clientes: [] });
  }

  // Territorios: mismo patrón que /insights/concentracion.
  const territoriosRaw = sp.get("territorios");
  let territoriosFilter: string[] | null;
  if (territoriosRaw === null) {
    territoriosFilter = null; // todos visibles por RLS
  } else if (territoriosRaw === "") {
    territoriosFilter = []; // ninguno
  } else {
    territoriosFilter = territoriosRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Si el filtro de territorios es array vacío → universo vacío.
  if (territoriosFilter !== null && territoriosFilter.length === 0) {
    return NextResponse.json({ meses: [], clientes: [] });
  }

  let query = supabase
    .from("kpi_cliente_summary")
    .select("cliente, mes, total_venta, total_kg, total_margen")
    .eq("anio", year)
    .lte("mes", month)
    .in("cliente", clientes);
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

  // Agregar por (cliente, mes) — sumando across territorios visibles.
  // byCliente: name → mes(1-12) → { venta, kg, margen }
  const byCliente = new Map<
    string,
    Map<number, { venta: number; kg: number; margen: number }>
  >();
  for (const r of data ?? []) {
    const name = r.cliente ?? "(sin nombre)";
    const m = Number(r.mes) || 0;
    if (m < 1 || m > 12) continue;
    let perMonth = byCliente.get(name);
    if (!perMonth) {
      perMonth = new Map();
      byCliente.set(name, perMonth);
    }
    const cur = perMonth.get(m) ?? { venta: 0, kg: 0, margen: 0 };
    cur.venta += Number(r.total_venta) || 0;
    cur.kg += Number(r.total_kg) || 0;
    cur.margen += Number(r.total_margen) || 0;
    perMonth.set(m, cur);
  }

  // Meses transcurridos 1..month con etiqueta corta.
  const meses = [];
  for (let m = 1; m <= month; m++) {
    meses.push({ mes: m, label: MONTH_SHORT_ES[m - 1] });
  }

  // Construir respuesta por cliente: serie mensual completa (mes sin venta = 0).
  const clientesOut = clientes.map((name) => {
    const perMonth = byCliente.get(name);
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

  return NextResponse.json({ meses, clientes: clientesOut });
}
