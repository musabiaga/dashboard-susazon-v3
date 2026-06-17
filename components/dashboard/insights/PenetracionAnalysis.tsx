"use client";

/**
 * PenetracionAnalysis — sub-análisis "Penetración / Canasta" del tab Insights.
 *
 * Bidireccional:
 *   · Por cliente → # de SKUs distintos que compra (qué tan amplia es su canasta)
 *   · Por SKU     → # de clientes distintos que lo compran (qué tan penetrado está)
 *
 * Para cada fila: conteo + venta + margen del periodo actual vs el MISMO rango
 * del año anterior (alineado día-vs-día) + sus deltas. El scatter (Δ conteo vs
 * Δ venta) deja ver de un vistazo quién amplía-y-crece vs quién angosta-y-cae.
 * Cada fila abre un drill-down con la lista COMPLETA de la otra dimensión,
 * marcando nuevos y perdidos. Respeta el contexto de territorios (RLS).
 */

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  Cell,
} from "recharts";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/dashboard/DateRangePicker";

type Dim = "clientes" | "productos";
type Vol = "pesos" | "kilos";

const DIM: Record<
  Dim,
  { row: string; rowPl: string; count: string; detail: string; detailPl: string }
> = {
  clientes: { row: "Cliente", rowPl: "Clientes", count: "# SKUs", detail: "SKU", detailPl: "SKUs" },
  productos: { row: "Producto", rowPl: "Productos", count: "# Clientes", detail: "Cliente", detailPl: "Clientes" },
};

type SortCol = "name" | "nActual" | "deltaN" | "magActual" | "deltaMag" | "margenPctActual" | "deltaMargenPct";

const SK_DIM = "insights-penetracion-dim";
const SK_VOL = "insights-penetracion-vol";

interface Props {
  today: { year: number; month: number; day: number };
  territorios: string[] | null;
  contextLabel: string;
}

interface ApiItem {
  name: string;
  nActual: number;
  nPrev: number;
  deltaN: number;
  ventaActual: number;
  ventaPrev: number;
  deltaVenta: number;
  margenActual: number;
  margenPrev: number;
  kgActual: number;
  kgPrev: number;
  deltaKg: number;
  margenPctActual: number;
  margenPctPrev: number;
  deltaMargenPct: number;
  esNuevo: boolean;
  esPerdido: boolean;
}
interface DetailItem {
  name: string;
  ventaActual: number;
  ventaPrev: number;
  deltaVenta: number;
  kgActual: number;
  kgPrev: number;
  margenPctActual: number;
  margenPctPrev: number;
  esNuevo: boolean;
  esPerdido: boolean;
}
interface Meta {
  from: string;
  to: string;
  effectiveTo: string;
  prevFrom: string;
  prevTo: string;
  capped: boolean;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}
function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}
function money(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}
function kgCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K kg`;
  return `${sign}${Math.round(abs)} kg`;
}
function signInt(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}
function signPp(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}
function territoriosKeyOf(t: string[] | null): string {
  return t === null ? "__ALL__" : t.length === 0 ? "__NONE__" : t.slice().sort().join("|");
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function PenetracionAnalysis({ today, territorios, contextLabel }: Props) {
  // Default: YTD (1-ene → hoy). La comparación contra el año anterior es del
  // mismo tramo; el server capa al último día con datos.
  const initialRange: DateRange = useMemo(
    () => ({
      from: `${today.year}-01-01`,
      to: `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
    }),
    [today]
  );

  const [range, setRange] = useState<DateRange>(initialRange);
  const [dimension, setDimension] = useState<Dim>("clientes");
  const [vol, setVol] = useState<Vol>("pesos");

  const [items, setItems] = useState<ApiItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<SortCol>("magActual");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Drill-down (lazy + cache)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<Map<string, DetailItem[]>>(() => new Map());
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());
  const [detailError, setDetailError] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    try {
      const d = window.localStorage.getItem(SK_DIM);
      if (d === "clientes" || d === "productos") setDimension(d);
      const v = window.localStorage.getItem(SK_VOL);
      if (v === "pesos" || v === "kilos") setVol(v);
    } catch {
      // ignore
    }
  }, []);

  const persistDim = (d: Dim) => {
    setDimension(d);
    try {
      window.localStorage.setItem(SK_DIM, d);
    } catch {
      // ignore
    }
  };
  const persistVol = (v: Vol) => {
    setVol(v);
    try {
      window.localStorage.setItem(SK_VOL, v);
    } catch {
      // ignore
    }
  };

  const tKey = territoriosKeyOf(territorios);
  const isKg = vol === "kilos";

  // Reset de expansión cuando cambia la consulta (territorio / rango / dimensión).
  useEffect(() => {
    setExpanded(new Set());
    setDetailCache(new Map());
    setDetailLoading(new Set());
    setDetailError(new Map());
  }, [range.from, range.to, dimension, tKey]);

  useEffect(() => {
    let cancelled = false;
    if (tKey === "__NONE__") {
      setItems([]);
      setMeta(null);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("from", range.from);
    params.set("to", range.to);
    params.set("dimension", dimension);
    if (territorios !== null) params.set("territorios", territorios.join(","));
    fetch(`/api/insights/penetracion?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { items?: ApiItem[] } & Partial<Meta>) => {
        if (cancelled) return;
        setItems(json.items ?? []);
        setMeta(
          json.effectiveTo
            ? {
                from: json.from ?? range.from,
                to: json.to ?? range.to,
                effectiveTo: json.effectiveTo,
                prevFrom: json.prevFrom ?? "",
                prevTo: json.prevTo ?? "",
                capped: !!json.capped,
              }
            : null
        );
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, dimension, tKey]);

  // Magnitud activa (pesos vs kilos) por item.
  const magOf = (i: ApiItem) => (isKg ? i.kgActual : i.ventaActual);
  const magPrevOf = (i: ApiItem) => (isKg ? i.kgPrev : i.ventaPrev);
  const magDeltaOf = (i: ApiItem) => (isKg ? i.deltaKg : i.deltaVenta);
  const fmtMag = (n: number) => (isKg ? kgCompact(n) : money(n));
  const fmtMagCompact = (n: number) => (isKg ? kgCompact(n) : moneyCompact(n));

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const n = items.length;
    if (n === 0) {
      return { promActual: 0, promPrev: 0, totalRel: 0, totalRelPrev: 0, nuevos: 0, perdidos: 0 };
    }
    let sumA = 0;
    let sumP = 0;
    let nuevos = 0;
    let perdidos = 0;
    for (const i of items) {
      sumA += i.nActual;
      sumP += i.nPrev;
      if (i.esNuevo) nuevos += 1;
      if (i.esPerdido) perdidos += 1;
    }
    // El promedio "por entidad activa" usa solo entidades con actividad en el periodo.
    const activosA = items.filter((i) => i.nActual > 0).length || 1;
    const activosP = items.filter((i) => i.nPrev > 0).length || 1;
    return {
      promActual: sumA / activosA,
      promPrev: sumP / activosP,
      totalRel: sumA,
      totalRelPrev: sumP,
      nuevos,
      perdidos,
    };
  }, [items]);

  // ===== Scatter: X = Δ conteo, Y = Δ magnitud (acotada por p5..p95) =====
  const yClampDomain = useMemo<[number, number]>(() => {
    const ds = items.map(magDeltaOf).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (ds.length === 0) return [-1, 1];
    const p = (q: number) => ds[clamp(Math.floor(ds.length * q), 0, ds.length - 1)];
    const lo = Math.min(p(0.05), 0);
    const hi = Math.max(p(0.95), 0);
    if (lo === hi) return [lo - 1, hi + 1];
    return [lo, hi];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isKg]);

  const points = useMemo(
    () =>
      items.map((i) => {
        const dN = i.deltaN;
        const dMag = magDeltaOf(i);
        const color =
          dN > 0 && dMag > 0
            ? "var(--success)"
            : dN < 0 && dMag < 0
              ? "var(--danger)"
              : "var(--warning)";
        return {
          name: i.name,
          deltaN: dN,
          magDelta: dMag,
          magDeltaPlot: clamp(dMag, yClampDomain[0], yClampDomain[1]),
          magActual: magOf(i),
          nActual: i.nActual,
          nPrev: i.nPrev,
          zVal: Math.max(1, magOf(i)),
          color,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, yClampDomain, isKg]
  );

  // ===== Tabla ordenable =====
  const handleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };
  const tableRows = useMemo(() => {
    const arr = [...items];
    const mul = sortDir === "asc" ? 1 : -1;
    const val = (i: ApiItem): number | string => {
      switch (sortCol) {
        case "name":
          return i.name;
        case "nActual":
          return i.nActual;
        case "deltaN":
          return i.deltaN;
        case "magActual":
          return magOf(i);
        case "deltaMag":
          return magDeltaOf(i);
        case "margenPctActual":
          return i.margenPctActual;
        case "deltaMargenPct":
          return i.deltaMargenPct;
      }
    };
    arr.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string" || typeof vb === "string")
        return String(va).localeCompare(String(vb)) * mul;
      return (va - vb) * mul;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortCol, sortDir, isKg]);

  // ===== Drill-down =====
  const toggleExpand = (name: string) => {
    const isOpen = expanded.has(name);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(name);
      else next.add(name);
      return next;
    });
    if (isOpen || detailCache.has(name) || detailLoading.has(name)) return;
    if (!meta) return;
    setDetailLoading((prev) => new Set(prev).add(name));
    setDetailError((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
    const params = new URLSearchParams();
    params.set("from", meta.from);
    params.set("to", meta.effectiveTo);
    params.set("dimension", dimension);
    params.set("key", name);
    if (territorios !== null) params.set("territorios", territorios.join(","));
    fetch(`/api/insights/penetracion-detalle?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { items?: DetailItem[] }) => {
        setDetailCache((prev) => new Map(prev).set(name, json.items ?? []));
      })
      .catch((e) => {
        setDetailError((prev) => new Map(prev).set(name, String(e?.message ?? e)));
      })
      .finally(() => {
        setDetailLoading((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      });
  };

  const dl = DIM[dimension];
  const magLabel = isKg ? "Volumen" : "Venta";

  return (
    <div className="space-y-4">
      {/* Fechas */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Dimensión */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Ver
          </span>
          <div
            className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
            style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)" }}
          >
            {(["clientes", "productos"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => persistDim(d)}
                className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: dimension === d ? "var(--bg-surface)" : "transparent",
                  color: dimension === d ? "var(--accent)" : "var(--text-secondary)",
                  boxShadow: dimension === d ? "var(--shadow-card)" : "none",
                }}
              >
                {d === "clientes" ? "Por cliente" : "Por SKU"}
              </button>
            ))}
          </div>
        </div>

        {/* Pesos / Kilos */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Volumen
          </span>
          <div
            className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
            style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)" }}
          >
            {(["pesos", "kilos"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => persistVol(v)}
                className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: vol === v ? "var(--bg-surface)" : "transparent",
                  color: vol === v ? "var(--accent)" : "var(--text-secondary)",
                  boxShadow: vol === v ? "var(--shadow-card)" : "none",
                }}
              >
                {v === "pesos" ? "Pesos" : "Kilos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ventana de comparación */}
      {meta && !loading && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-[11px]"
          style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <span>
            Comparando <strong>{fmtDate(meta.from)} → {fmtDate(meta.effectiveTo)}</strong> vs mismo rango{" "}
            <strong>{fmtDate(meta.prevFrom)} → {fmtDate(meta.prevTo)}</strong>
          </span>
          {meta.capped && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
            >
              ⓘ periodo ajustado al último día con datos ({fmtDate(meta.effectiveTo)}) para una comparación justa
            </span>
          )}
        </div>
      )}

      {/* KPIs */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label={dimension === "clientes" ? "SKUs por cliente (prom.)" : "Clientes por SKU (prom.)"}
            value={kpis.promActual.toFixed(1)}
            sub={`vs ${kpis.promPrev.toFixed(1)} año ant.`}
            subColor={kpis.promActual >= kpis.promPrev ? "var(--success)" : "var(--danger)"}
          />
          <Kpi
            label="Relaciones cliente × SKU"
            value={kpis.totalRel.toLocaleString("es-MX")}
            sub={signInt(kpis.totalRel - kpis.totalRelPrev)}
            subColor={kpis.totalRel >= kpis.totalRelPrev ? "var(--success)" : "var(--danger)"}
          />
          <Kpi label={`Nuevos (${dl.rowPl.toLowerCase()})`} value={String(kpis.nuevos)} sub="sin base año ant." subColor="var(--success)" />
          <Kpi label="Perdidos" value={String(kpis.perdidos)} sub="sin actividad este año" subColor="var(--danger)" />
        </div>
      )}

      {/* Scatter */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
      >
        {tKey === "__NONE__" ? (
          <Empty>Ningún territorio seleccionado.</Empty>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-32 text-sm" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <Empty danger>Error: {error}</Empty>
        ) : points.length === 0 ? (
          <Empty>Sin datos para el rango y filtro seleccionados.</Empty>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 36, left: 18 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="deltaN"
                  name="Δ conteo"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickLine={false}
                  label={{
                    value: `Δ ${dl.count.toLowerCase()} (año vs año) →`,
                    position: "insideBottomRight",
                    offset: -6,
                    fontSize: 11,
                    fill: "var(--text-muted)",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="magDeltaPlot"
                  name="Δ venta"
                  domain={yClampDomain}
                  allowDataOverflow
                  tickFormatter={fmtMagCompact}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  label={{ value: `Δ ${magLabel.toLowerCase()}`, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-muted)" }}
                />
                <ZAxis type="number" dataKey="zVal" range={[40, 420]} name={magLabel} />
                <ReferenceLine x={0} stroke="var(--text-primary)" strokeDasharray="4 4" />
                <ReferenceLine y={0} stroke="var(--text-primary)" strokeDasharray="4 4" />
                <Tooltip content={<PenTooltip isKg={isKg} dl={dl} />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }} />
                <Scatter data={points} fillOpacity={0.7}>
                  {points.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5"><Dot c="var(--success)" /> amplía y crece</span>
              <span className="flex items-center gap-1.5"><Dot c="var(--danger)" /> angosta y cae</span>
              <span className="flex items-center gap-1.5"><Dot c="var(--warning)" /> mixto</span>
              <span>· burbuja = {magLabel.toLowerCase()} actual</span>
            </div>
          </>
        )}
      </div>

      {/* Tabla + drill-down */}
      {!loading && items.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr style={{ background: "var(--bg-surface-muted)" }}>
                <th className="w-8 px-2 py-2" />
                <SortTh col="name" label={dl.row} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="nActual" label={dl.count} align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="deltaN" label="Δ" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="magActual" label={magLabel} align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="deltaMag" label="Δ" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="margenPctActual" label="Margen %" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="deltaMargenPct" label="Δ pp" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const open = expanded.has(r.name);
                const mag = magOf(r);
                const dMag = magDeltaOf(r);
                return (
                  <ItemRows
                    key={r.name}
                    r={r}
                    open={open}
                    zebra={i % 2 === 0}
                    mag={mag}
                    dMag={dMag}
                    fmtMag={fmtMag}
                    onToggle={() => toggleExpand(r.name)}
                    detailLoading={detailLoading.has(r.name)}
                    detailError={detailError.get(r.name)}
                    detail={detailCache.get(r.name)}
                    isKg={isKg}
                    dl={dl}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Contexto: {contextLabel}. {dimension === "clientes"
          ? "Por cliente: # de SKUs distintos que compra."
          : "Por SKU: # de clientes distintos que lo compran."}{" "}
        Comparado contra el mismo tramo de fechas del año anterior. Abre una fila para ver{" "}
        {dimension === "clientes" ? "todos sus SKUs" : "todos sus clientes"} (marcando nuevos y perdidos).
      </p>
    </div>
  );
}

// ===== Filas (item + drill-down) =====
function ItemRows({
  r,
  open,
  zebra,
  mag,
  dMag,
  fmtMag,
  onToggle,
  detailLoading,
  detailError,
  detail,
  isKg,
  dl,
}: {
  r: ApiItem;
  open: boolean;
  zebra: boolean;
  mag: number;
  dMag: number;
  fmtMag: (n: number) => string;
  onToggle: () => void;
  detailLoading: boolean;
  detailError?: string;
  detail?: DetailItem[];
  isKg: boolean;
  dl: (typeof DIM)[Dim];
}) {
  const bg = zebra ? "var(--bg-surface)" : "var(--bg-surface-muted)";
  return (
    <>
      <tr style={{ background: bg, cursor: "pointer" }} onClick={onToggle}>
        <td className="px-2 py-1.5" style={{ color: "var(--text-muted)" }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-1.5" style={{ color: "var(--text-primary)" }}>
          {r.name}
          {r.esNuevo && <Badge kind="nuevo" />}
          {r.esPerdido && <Badge kind="perdido" />}
        </td>
        <td className="px-3 py-1.5 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{r.nActual}</td>
        <DeltaTd v={r.deltaN} text={signInt(r.deltaN)} />
        <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-primary)" }}>{fmtMag(mag)}</td>
        <DeltaTd v={dMag} text={fmtMag(dMag)} />
        <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-primary)" }}>{r.margenPctActual.toFixed(1)}%</td>
        <DeltaTd v={r.deltaMargenPct} text={signPp(r.deltaMargenPct)} />
      </tr>
      {open && (
        <tr style={{ background: bg }}>
          <td />
          <td colSpan={7} className="px-3 pb-3 pt-0">
            {detailLoading ? (
              <div className="flex items-center gap-2 py-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                <Loader2 size={13} className="animate-spin" /> Cargando {dl.detailPl.toLowerCase()}…
              </div>
            ) : detailError ? (
              <div className="py-2 text-[12px]" style={{ color: "var(--danger)" }}>Error: {detailError}</div>
            ) : !detail || detail.length === 0 ? (
              <div className="py-2 text-[12px] italic" style={{ color: "var(--text-muted)" }}>Sin {dl.detailPl.toLowerCase()}.</div>
            ) : (
              <DetailTable detail={detail} isKg={isKg} dl={dl} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DetailTable({ detail, isKg, dl }: { detail: DetailItem[]; isKg: boolean; dl: (typeof DIM)[Dim] }) {
  const fmt = (n: number) => (isKg ? kgCompact(n) : money(n));
  const rows = [...detail].sort((a, b) => (isKg ? b.kgActual - a.kgActual : b.ventaActual - a.ventaActual));
  return (
    <div
      className="rounded-[var(--radius)] border"
      style={{ borderColor: "var(--border)", background: "var(--bg-page)" }}
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        {detail.length} {dl.detailPl.toLowerCase()} ·{" "}
        <span style={{ color: "var(--success)" }}>{detail.filter((d) => d.esNuevo).length} nuevos</span> ·{" "}
        <span style={{ color: "var(--danger)" }}>{detail.filter((d) => d.esPerdido).length} dejó de comprar</span>
      </div>
      <table className="w-full text-[12px] tabular-nums">
        <tbody>
          {rows.map((d) => {
            const mag = isKg ? d.kgActual : d.ventaActual;
            const dMag = d.deltaVenta;
            const magDelta = isKg ? d.kgActual - d.kgPrev : d.deltaVenta;
            return (
              <tr key={d.name} style={{ borderTop: "0.5px solid var(--border)" }}>
                <td className="px-3 py-1" style={{ color: "var(--text-primary)" }}>
                  {d.name}
                  {d.esNuevo && <Badge kind="nuevo" />}
                  {d.esPerdido && <Badge kind="perdido" />}
                </td>
                <td className="px-3 py-1 text-right" style={{ color: "var(--text-secondary)" }}>{fmt(mag)}</td>
                <DeltaTd v={magDelta} text={fmt(magDelta)} small />
                <td className="px-3 py-1 text-right" style={{ color: "var(--text-secondary)" }}>{d.margenPctActual.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===== Subcomponentes =====
function Kpi({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border p-3" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</div>
      <div className="text-[11px]" style={{ color: subColor }}>{sub}</div>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />;
}

function Badge({ kind }: { kind: "nuevo" | "perdido" }) {
  const isN = kind === "nuevo";
  return (
    <span
      className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{
        background: isN ? "var(--success-soft)" : "var(--danger-soft)",
        color: isN ? "var(--success)" : "var(--danger)",
      }}
    >
      {isN ? "nuevo" : "dejó"}
    </span>
  );
}

function DeltaTd({ v, text, small = false }: { v: number; text: string; small?: boolean }) {
  const color = v > 0 ? "var(--success)" : v < 0 ? "var(--danger)" : "var(--text-muted)";
  return (
    <td className={`px-3 ${small ? "py-1" : "py-1.5"} text-right`} style={{ color }}>
      {text}
    </td>
  );
}

function Empty({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="py-24 text-center text-sm" style={{ color: danger ? "var(--danger)" : "var(--text-muted)" }}>
      {children}
    </div>
  );
}

function SortTh({
  col,
  label,
  align = "left",
  sortCol,
  sortDir,
  onSort,
}: {
  col: SortCol;
  label: string;
  align?: "left" | "right";
  sortCol: SortCol;
  sortDir: "asc" | "desc";
  onSort: (col: SortCol) => void;
}) {
  const active = sortCol === col;
  return (
    <th
      className="cursor-pointer select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: active ? "var(--accent)" : "var(--text-muted)", textAlign: align }}
      onClick={() => onSort(col)}
      title="Ordenar por esta columna"
    >
      <span className="inline-flex items-center gap-1 align-middle">
        {label}
        <span style={{ opacity: active ? 1 : 0.25 }}>{active && sortDir === "asc" ? "▲" : "▼"}</span>
      </span>
    </th>
  );
}

interface PointDatum {
  name?: string;
  deltaN?: number;
  magDelta?: number;
  magActual?: number;
  nActual?: number;
  nPrev?: number;
}
function PenTooltip({
  active,
  payload,
  isKg,
  dl,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PointDatum }>;
  isKg: boolean;
  dl: (typeof DIM)[Dim];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  const fmt = (n: number) => (isKg ? kgCompact(n) : money(n));
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2 text-[12px] shadow-lg"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", minWidth: 190 }}
    >
      <div className="mb-1 font-bold" style={{ color: "var(--text-primary)", wordBreak: "break-word" }}>{d.name}</div>
      <Row k={dl.count} v={`${d.nActual ?? 0} (${signInt((d.nActual ?? 0) - (d.nPrev ?? 0))})`} />
      <Row
        k={isKg ? "Δ volumen" : "Δ venta"}
        v={fmt(d.magDelta ?? 0)}
        color={(d.magDelta ?? 0) >= 0 ? "var(--success)" : "var(--danger)"}
      />
      <Row k={isKg ? "Volumen" : "Venta"} v={fmt(d.magActual ?? 0)} />
    </div>
  );
}
function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span className="font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>{v}</span>
    </div>
  );
}
