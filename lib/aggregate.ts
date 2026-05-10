/**
 * lib/aggregate.ts — funciones puras para agregar datos de varios territorios
 *
 * Diseñado para soportar el multi-select de territorios global (Mejora 7).
 * Cuando el usuario selecciona N territorios en el sidebar, todas las KPIs,
 * charts y tablas del dashboard se reconstruyen agregando los N seleccionados.
 *
 * Hoy el server pre-agrega TODO ("totalKpi" + "datasets.total"), pero esa
 * agregación NO se puede usar para subconjuntos. Estas funciones agregan
 * dinámicamente en el cliente desde la data por-territorio que ya viene
 * (`byTerritory`).
 *
 * Performance: O(N × items_por_territorio). Con 16 territorios y miles de
 * clientes en cada uno, se ejecuta en pocos ms en cliente. Memoizar con
 * useMemo en el padre evita recomputar en cada render.
 */

import type {
  TerritoryKpi,
  Territory,
  DailyPoint,
  MonthlyPoint,
} from "@/components/dashboard/Sidebar";
import type { DimensionRow } from "@/components/dashboard/DimensionTab";
import type { PerdidoRow } from "@/components/dashboard/PerdidosTab";

/**
 * KPI cero/vacío. Usado cuando no hay territorios seleccionados.
 */
export function emptyKpi(): TerritoryKpi {
  return {
    venta: 0,
    margen: 0,
    kg: 0,
    marginPct: 0,
    prevYear: { venta: 0, margen: 0, kg: 0 },
    acumByYear: {},
    daily: { current: [], prevYear: [] },
    monthly: [],
  };
}

/**
 * Suma N KPIs en uno solo. Recompute marginPct desde sumas para evitar
 * el bug clásico de promediar percentages.
 */
export function aggregateKpis(kpis: TerritoryKpi[]): TerritoryKpi {
  if (kpis.length === 0) return emptyKpi();
  if (kpis.length === 1) return kpis[0];

  let venta = 0;
  let margen = 0;
  let kg = 0;
  let pyVenta = 0;
  let pyMargen = 0;
  let pyKg = 0;
  const acumByYear: Record<number, number> = {};
  const dailyCurMap = new Map<number, DailyPoint>();
  const dailyPrevMap = new Map<number, DailyPoint>();
  const monthlyMap = new Map<string, MonthlyPoint>();
  let aldExists = false;
  let v24 = 0, v25 = 0, v26 = 0;
  let m24 = 0, m25 = 0, m26 = 0;

  for (const k of kpis) {
    venta += k.venta;
    margen += k.margen;
    kg += k.kg;
    pyVenta += k.prevYear.venta;
    pyMargen += k.prevYear.margen;
    pyKg += k.prevYear.kg;
    for (const [y, v] of Object.entries(k.acumByYear)) {
      const yn = Number(y);
      acumByYear[yn] = (acumByYear[yn] ?? 0) + v;
    }
    for (const p of k.daily.current) {
      const cur = dailyCurMap.get(p.d) ?? { d: p.d, v: 0, m: 0, k: 0 };
      cur.v += p.v;
      cur.m += p.m;
      cur.k += p.k;
      dailyCurMap.set(p.d, cur);
    }
    for (const p of k.daily.prevYear) {
      const cur = dailyPrevMap.get(p.d) ?? { d: p.d, v: 0, m: 0, k: 0 };
      cur.v += p.v;
      cur.m += p.m;
      cur.k += p.k;
      dailyPrevMap.set(p.d, cur);
    }
    for (const p of k.monthly) {
      const key = `${p.anio}-${p.mes}`;
      const cur = monthlyMap.get(key) ?? {
        anio: p.anio,
        mes: p.mes,
        venta: 0,
        margen: 0,
        kg: 0,
      };
      cur.venta += p.venta;
      cur.margen += p.margen;
      cur.kg += p.kg;
      monthlyMap.set(key, cur);
    }
    if (k.currentMonthAlDia) {
      aldExists = true;
      v24 += k.currentMonthAlDia.v24;
      v25 += k.currentMonthAlDia.v25;
      v26 += k.currentMonthAlDia.v26;
      m24 += k.currentMonthAlDia.m24;
      m25 += k.currentMonthAlDia.m25;
      m26 += k.currentMonthAlDia.m26;
    }
  }

  return {
    venta,
    margen,
    kg,
    marginPct: venta > 0 ? (margen / venta) * 100 : 0,
    prevYear: { venta: pyVenta, margen: pyMargen, kg: pyKg },
    acumByYear,
    daily: {
      current: Array.from(dailyCurMap.values()).sort((a, b) => a.d - b.d),
      prevYear: Array.from(dailyPrevMap.values()).sort((a, b) => a.d - b.d),
    },
    monthly: Array.from(monthlyMap.values()),
    currentMonthAlDia: aldExists
      ? { v24, v25, v26, m24, m25, m26 }
      : undefined,
  };
}

/**
 * Agrega DimensionRow[] de N territorios sumando por nombre. Útil para
 * Grupos / Productos / Clientes / Vendedores.
 */
export function aggregateDimensionRows(
  rowsList: DimensionRow[][]
): DimensionRow[] {
  if (rowsList.length === 0) return [];
  if (rowsList.length === 1) return rowsList[0];

  const map = new Map<string, DimensionRow>();
  const NUM_FIELDS: (keyof DimensionRow)[] = [
    "v24", "v25", "v26",
    "k24", "k25", "k26",
    "m24", "m25", "m26",
    "v24_alDia", "v25_alDia", "v26_alDia",
    "k24_alDia", "k25_alDia", "k26_alDia",
    "m24_alDia", "m25_alDia", "m26_alDia",
  ];
  for (const rows of rowsList) {
    for (const r of rows) {
      let cur = map.get(r.name);
      if (!cur) {
        cur = {
          name: r.name,
          empresa: r.empresa,
          v24: 0, v25: 0, v26: 0,
        };
        map.set(r.name, cur);
      }
      for (const f of NUM_FIELDS) {
        const a = (cur[f] as number | undefined) ?? 0;
        const b = (r[f] as number | undefined) ?? 0;
        (cur as unknown as Record<string, unknown>)[f] = a + b;
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Agrega PerdidoRow[] de N territorios sumando por no_cliente. Mantiene
 * cliente y vendedor del primer match encontrado (en multi-territorio
 * podría haber distintos vendedores; usamos el primero como representativo).
 */
export function aggregatePerdidoRows(
  rowsList: PerdidoRow[][]
): PerdidoRow[] {
  if (rowsList.length === 0) return [];
  if (rowsList.length === 1) return rowsList[0];

  const map = new Map<string, PerdidoRow>();
  const NUM_FIELDS: (keyof PerdidoRow)[] = [
    "mes_venta_2024", "mes_kg_2024", "mes_margen_2024",
    "ytd_venta_2024", "ytd_kg_2024", "ytd_margen_2024",
    "mes_venta_alDia_2024", "mes_kg_alDia_2024", "mes_margen_alDia_2024",
    "mes_venta_2025", "mes_kg_2025", "mes_margen_2025",
    "ytd_venta_2025", "ytd_kg_2025", "ytd_margen_2025",
    "mes_venta_alDia_2025", "mes_kg_alDia_2025", "mes_margen_alDia_2025",
    "mes_venta_2026", "mes_kg_2026", "mes_margen_2026",
    "ytd_venta_2026", "ytd_kg_2026", "ytd_margen_2026",
    "mes_venta_alDia_2026", "mes_kg_alDia_2026", "mes_margen_alDia_2026",
  ];
  for (const rows of rowsList) {
    for (const r of rows) {
      const cur = map.get(r.no_cliente);
      if (!cur) {
        map.set(r.no_cliente, { ...r });
        continue;
      }
      for (const f of NUM_FIELDS) {
        const a = (cur[f] as number | undefined) ?? 0;
        const b = (r[f] as number | undefined) ?? 0;
        (cur as unknown as Record<string, unknown>)[f] = a + b;
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Suma los presupuestos de los territorios seleccionados.
 */
export function aggregateBudget(
  territories: Territory[],
  selected: Set<string>
): number {
  let total = 0;
  for (const t of territories) {
    if (selected.has(t.name)) total += t.ventaBudget;
  }
  return total;
}

/**
 * Devuelve el array de TerritoryKpi correspondientes a los territorios
 * seleccionados (en orden alfabético). Útil para pasar a aggregateKpis.
 */
export function selectedKpis(
  territories: Territory[],
  selected: Set<string>
): TerritoryKpi[] {
  return territories
    .filter((t) => selected.has(t.name))
    .map((t) => t.kpi);
}

/**
 * Devuelve los rows de un dataset por-territorio para los territorios
 * seleccionados, como array de arrays (listo para aggregateDimensionRows /
 * aggregatePerdidoRows).
 */
export function rowsBySelected<T>(
  byTerritory: Record<string, T[]>,
  selected: Set<string>
): T[][] {
  const out: T[][] = [];
  for (const t of selected) {
    const rs = byTerritory[t];
    if (rs) out.push(rs);
  }
  return out;
}
