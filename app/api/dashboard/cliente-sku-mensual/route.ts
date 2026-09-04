import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/cliente-sku-mensual
 *
 * Cruce cliente × SKU × mes para el tab "Clientes y Productos":
 *   - anchorDim=sku     + anchorValue=<SKU>     → CLIENTES que lo compraron, por mes.
 *   - anchorDim=cliente + anchorValue=<cliente> → SKUs que compró, por mes.
 *
 * Alimenta el expand mensual bidireccional de la vista "Meses {año}" (el "campo
 * minado": meses vacíos = desde cuándo dejaron de comprar) y el cross-search.
 *
 * Llama a la función SQL insights_cliente_sku_mensual (migr 041, SECURITY
 * INVOKER → respeta RLS de territorio). Devuelve TODAS las entidades del cruce
 * (no se pre-listan) ordenadas por venta total desc.
 *
 * Query params:
 *   year:        YYYY
 *   anchorDim:   "sku" (default) | "cliente"
 *   anchorValue: el SKU o el cliente ancla
 *   territorios: null (todos por RLS) | "" (ninguno) | CSV de territorios
 *
 * Respuesta: { meses: [{mes,label}], clientes: [{name, monthly:[...]}] }
 * (misma forma que /clientes-evolution para reusar el render mensual).
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
  const anchorDim = sp.get("anchorDim") === "cliente" ? "cliente" : "sku";
  const anchorValue = (sp.get("anchorValue") ?? "").trim();

  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return NextResponse.json({ error: "year inválido" }, { status: 400 });
  }
  if (!anchorValue) {
    return NextResponse.json({ meses: [], clientes: [] });
  }

  const territoriosRaw = sp.get("territorios");
  let territorios: string[] | null;
  if (territoriosRaw === null) territorios = null;
  else if (territoriosRaw === "") territorios = [];
  else
    territorios = territoriosRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  if (territorios !== null && territorios.length === 0) {
    return NextResponse.json({ meses: [], clientes: [] });
  }

  const { data, error } = await supabase.rpc("insights_cliente_sku_mensual", {
    p_year: year,
    p_anchor_dim: anchorDim,
    p_anchor_value: anchorValue,
    p_territorios: territorios,
  });
  if (error) {
    return NextResponse.json({ error: `Error: ${error.message}` }, { status: 500 });
  }

  const rows = (data ?? []) as {
    name: string;
    mes: number;
    venta: number;
    kg: number;
    margen: number;
    territorios: string[] | null;
  }[];

  // Agregar por (name, mes) + total por name para ordenar.
  const byName = new Map<string, Map<number, { venta: number; kg: number; margen: number }>>();
  const totalByName = new Map<string, number>();
  // Territorios distintos donde cada entidad hizo venta (unión entre meses),
  // para la Mejora 1: mostrar el/los territorio(s) en la vista "Todos".
  const terrByName = new Map<string, Set<string>>();
  for (const r of rows) {
    const mes = Number(r.mes);
    if (mes < 1 || mes > 12) continue;
    let perMonth = byName.get(r.name);
    if (!perMonth) {
      perMonth = new Map();
      byName.set(r.name, perMonth);
    }
    const cur = perMonth.get(mes) ?? { venta: 0, kg: 0, margen: 0 };
    cur.venta += Number(r.venta) || 0;
    cur.kg += Number(r.kg) || 0;
    cur.margen += Number(r.margen) || 0;
    perMonth.set(mes, cur);
    totalByName.set(r.name, (totalByName.get(r.name) ?? 0) + (Number(r.venta) || 0));
    if (Array.isArray(r.territorios)) {
      let set = terrByName.get(r.name);
      if (!set) {
        set = new Set();
        terrByName.set(r.name, set);
      }
      for (const t of r.territorios) if (t) set.add(t);
    }
  }

  const meses = [];
  for (let m = 1; m <= 12; m++) {
    meses.push({ mes: m, label: MONTH_SHORT_ES[m - 1] });
  }

  // Entidades ordenadas por venta total desc (no se pre-listan).
  const names = Array.from(byName.keys()).sort(
    (a, b) => (totalByName.get(b) ?? 0) - (totalByName.get(a) ?? 0)
  );
  const series = names.map((name) => {
    const perMonth = byName.get(name);
    const monthly = [];
    for (let m = 1; m <= 12; m++) {
      const cell = perMonth?.get(m) ?? { venta: 0, kg: 0, margen: 0 };
      monthly.push({
        mes: m,
        venta: cell.venta,
        kg: cell.kg,
        margen: cell.margen,
        margen_pct: cell.venta > 0 ? (cell.margen / cell.venta) * 100 : 0,
      });
    }
    const territorios = Array.from(terrByName.get(name) ?? []).sort();
    return { name, monthly, territorios };
  });

  return NextResponse.json({ meses, clientes: series });
}
