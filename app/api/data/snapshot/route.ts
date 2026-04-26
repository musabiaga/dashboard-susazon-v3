import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/data/snapshot
 * Devuelve un snapshot agregado del estado actual filtrado por permisos
 * del usuario. Estructura útil para sidebar + KPIs de la pantalla principal.
 *
 * Por ahora devuelve totales por territorio. La estructura D completa
 * (con vendedores, familias, clientes, sku, perdidos) se construirá en Fase 2c
 * cuando armemos el dashboard real.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Las RLS policies filtran automáticamente por territorios visibles.
  const { data: rows, error } = await supabase
    .from("sales_rows")
    .select("territorio, anio, mes, venta, margen, kg")
    .order("anio", { ascending: false })
    .order("mes", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agregación simple: totales anuales y mensuales por territorio
  type TerritoryAgg = {
    t: string;
    v24: number; v25: number; v26: number;
    m24: number; m25: number; m26: number;
    k24: number; k25: number; k26: number;
    months: Record<string, { v: number; m: number; k: number }>;
  };
  const aggregateByTerritory = new Map<string, TerritoryAgg>();

  for (const row of rows ?? []) {
    if (!aggregateByTerritory.has(row.territorio)) {
      aggregateByTerritory.set(row.territorio, {
        t: row.territorio,
        v24: 0, v25: 0, v26: 0,
        m24: 0, m25: 0, m26: 0,
        k24: 0, k25: 0, k26: 0,
        months: {},
      });
    }
    const agg = aggregateByTerritory.get(row.territorio)!;
    const venta = Number(row.venta) || 0;
    const margen = Number(row.margen) || 0;
    const kg = Number(row.kg) || 0;
    const yearKey = String(row.anio).slice(-2);

    if (yearKey === "24") {
      agg.v24 += venta; agg.m24 += margen; agg.k24 += kg;
    } else if (yearKey === "25") {
      agg.v25 += venta; agg.m25 += margen; agg.k25 += kg;
    } else if (yearKey === "26") {
      agg.v26 += venta; agg.m26 += margen; agg.k26 += kg;
    }

    const monthKey = `${row.anio}-${String(row.mes).padStart(2, "0")}`;
    if (!agg.months[monthKey]) agg.months[monthKey] = { v: 0, m: 0, k: 0 };
    agg.months[monthKey].v += venta;
    agg.months[monthKey].m += margen;
    agg.months[monthKey].k += kg;
  }

  // Estado de territorios (cuáles están apagados globalmente)
  const { data: territoryStates } = await supabase
    .from("territories_state")
    .select("territory_name, is_active, reason");

  // Última sincronización
  const { data: lastSync } = await supabase
    .from("sync_history")
    .select("id, started_at, completed_at, status, rows_imported, source")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    territories: Array.from(aggregateByTerritory.values()),
    territory_states: territoryStates ?? [],
    last_sync: lastSync ?? null,
    total_rows: rows?.length ?? 0,
  });
}
