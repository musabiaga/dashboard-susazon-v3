"use client";

/**
 * CuadranteAnalysis — sub-análisis "Cuadrante de cartera (BCG)" del tab Insights.
 *
 * Pregunta: ¿a quién cuido, a quién rescato, en quién apuesto, a quién suelto?
 *
 * Cada item de la dimensión (clientes/grupos/productos/territorios) se ubica en
 * un scatter:
 *   · eje X = tamaño (venta del periodo, escala log)
 *   · eje Y = crecimiento YoY % (vs mismo rango calendario del año anterior)
 *   · burbuja = margen $ del periodo
 *
 * Cuatro cuadrantes (umbrales configurables en vivo; tamaño arranca en la
 * mediana, crecimiento en 0%):
 *   ⭐ Estrella   (grande + crece)   🟥 En riesgo (grande + cae)
 *   🔷 Apuesta    (chico + crece)    ⬜ Marginal  (chico + cae)
 *
 * Los "Nuevos" (sin venta el año anterior) no tienen crecimiento calculable →
 * se muestran aparte. Respeta el contexto de territorios del sidebar (RLS).
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
  ReferenceArea,
  Tooltip,
  Cell,
} from "recharts";
import { Loader2, Star, RotateCcw } from "lucide-react";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/dashboard/DateRangePicker";

type Dimension = "clientes" | "grupos" | "productos" | "territorios";
const DIM_LABEL: Record<Dimension, { sg: string; pl: string }> = {
  clientes: { sg: "Cliente", pl: "Clientes" },
  grupos: { sg: "Grupo", pl: "Grupos" },
  productos: { sg: "Producto", pl: "Productos" },
  territorios: { sg: "Territorio", pl: "Territorios" },
};

type Quadrant = "estrella" | "riesgo" | "apuesta" | "marginal";
const QUAD: Record<Quadrant, { label: string; color: string }> = {
  estrella: { label: "Estrella", color: "var(--success)" },
  riesgo: { label: "En riesgo", color: "var(--danger)" },
  apuesta: { label: "Apuesta", color: "var(--accent)" },
  marginal: { label: "Marginal", color: "var(--text-muted)" },
};
const NUEVO_COLOR = "#8b5cf6";

type SortCol = "name" | "ventaActual" | "crecimiento" | "margenPct" | "quad";

const SK_DIM = "insights-cuadrante-dim";
const SK_GROWTH = "insights-cuadrante-growth";

interface Props {
  today: { year: number; month: number; day: number };
  territorios: string[] | null;
  contextLabel: string;
}

interface ApiItem {
  name: string;
  ventaActual: number;
  kgActual: number;
  margenActual: number;
  ventaPrev: number;
  margenPct: number;
  crecimiento: number | null;
}
interface Meta {
  from: string;
  to: string;
  effectiveTo: string;
  prevFrom: string;
  prevTo: string;
  capped: boolean;
}

// Formato corto de fecha ISO → "5 jun 2026"
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

// ===== Formatos =====
function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}
function money(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}
function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;
}
function territoriosKeyOf(t: string[] | null): string {
  return t === null ? "__ALL__" : t.length === 0 ? "__NONE__" : t.slice().sort().join("|");
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function CuadranteAnalysis({ today, territorios, contextLabel }: Props) {
  const initialRange: DateRange = useMemo(
    () => ({
      from: `${today.year}-${String(today.month).padStart(2, "0")}-01`,
      to: `${today.year}-${String(today.month).padStart(2, "0")}-${String(
        today.day
      ).padStart(2, "0")}`,
    }),
    [today]
  );

  const [range, setRange] = useState<DateRange>(initialRange);
  const [dimension, setDimension] = useState<Dimension>("clientes");
  const [growthThreshold, setGrowthThreshold] = useState(0);
  // Umbral de tamaño: null = auto (mediana). Number = fijado por el usuario.
  const [sizeThreshold, setSizeThreshold] = useState<number | null>(null);

  const [items, setItems] = useState<ApiItem[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortCol, setSortCol] = useState<SortCol>("ventaActual");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    try {
      const d = window.localStorage.getItem(SK_DIM);
      if (d === "clientes" || d === "grupos" || d === "productos" || d === "territorios")
        setDimension(d);
      const g = Number(window.localStorage.getItem(SK_GROWTH));
      if (Number.isFinite(g)) setGrowthThreshold(g);
    } catch {
      // ignore
    }
  }, []);

  const persistDim = (d: Dimension) => {
    setDimension(d);
    setSizeThreshold(null); // re-auto a la mediana de la nueva dimensión
    try {
      window.localStorage.setItem(SK_DIM, d);
    } catch {
      // ignore
    }
  };
  const persistGrowth = (v: number) => {
    setGrowthThreshold(v);
    try {
      window.localStorage.setItem(SK_GROWTH, String(v));
    } catch {
      // ignore
    }
  };

  const tKey = territoriosKeyOf(territorios);

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
    fetch(`/api/insights/cuadrante?${params.toString()}`)
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

  // Separar comparables (con crecimiento) de nuevos (sin base).
  const comparables = useMemo(
    () => items.filter((i) => i.crecimiento !== null),
    [items]
  );
  const nuevos = useMemo(
    () => items.filter((i) => i.crecimiento === null).sort((a, b) => b.ventaActual - a.ventaActual),
    [items]
  );

  // Mediana de venta (todos los activos) → default del umbral de tamaño.
  const medianaVenta = useMemo(() => {
    if (items.length === 0) return 0;
    const v = items.map((i) => i.ventaActual).sort((a, b) => a - b);
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }, [items]);

  const effSize = sizeThreshold ?? medianaVenta;

  // Dominio del eje Y (crecimiento): acota outliers extremos usando el p95.
  const yDomain = useMemo<[number, number]>(() => {
    if (comparables.length === 0) return [-50, 50];
    const g = comparables.map((c) => c.crecimiento as number).sort((a, b) => a - b);
    const minG = g[0];
    const p95 = g[Math.min(g.length - 1, Math.floor(g.length * 0.95))];
    const hi = Math.max(growthThreshold + 15, Math.min(200, Math.ceil(p95 / 10) * 10 + 10));
    const lo = Math.min(growthThreshold - 15, Math.max(-105, Math.floor(minG / 10) * 10));
    return [lo, hi];
  }, [comparables, growthThreshold]);

  // Dominio X (log) de venta.
  const xDomain = useMemo<[number, number]>(() => {
    if (comparables.length === 0) return [1, 100];
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of comparables) {
      if (c.ventaActual < lo) lo = c.ventaActual;
      if (c.ventaActual > hi) hi = c.ventaActual;
    }
    return [Math.max(1, lo * 0.8), hi * 1.15];
  }, [comparables]);

  // Asignar cuadrante + valor de plot acotado.
  const quadOf = (c: ApiItem): Quadrant => {
    const big = c.ventaActual >= effSize;
    const grow = (c.crecimiento as number) >= growthThreshold;
    if (big && grow) return "estrella";
    if (big && !grow) return "riesgo";
    if (!big && grow) return "apuesta";
    return "marginal";
  };

  const points = useMemo(
    () =>
      comparables.map((c) => {
        const q = quadOf(c);
        return {
          ...c,
          quad: q,
          color: QUAD[q].color,
          gPlot: clamp(c.crecimiento as number, yDomain[0], yDomain[1]),
          zVal: Math.max(0, c.margenActual),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparables, effSize, growthThreshold, yDomain]
  );

  // Resumen por cuadrante (conteo + % de venta).
  const totalVenta = useMemo(
    () => items.reduce((s, i) => s + i.ventaActual, 0),
    [items]
  );
  const summary = useMemo(() => {
    const acc: Record<Quadrant, { n: number; venta: number }> = {
      estrella: { n: 0, venta: 0 },
      riesgo: { n: 0, venta: 0 },
      apuesta: { n: 0, venta: 0 },
      marginal: { n: 0, venta: 0 },
    };
    for (const p of points) {
      acc[p.quad].n += 1;
      acc[p.quad].venta += p.ventaActual;
    }
    return acc;
  }, [points]);

  // Tabla ordenable (comparables; nuevos van en su propia sección).
  const handleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };
  const tableRows = useMemo(() => {
    const arr = [...points];
    const mul = sortDir === "asc" ? 1 : -1;
    const order: Record<Quadrant, number> = { riesgo: 0, estrella: 1, apuesta: 2, marginal: 3 };
    arr.sort((a, b) => {
      if (sortCol === "name") return a.name.localeCompare(b.name) * mul;
      if (sortCol === "quad") return (order[a.quad] - order[b.quad]) * mul;
      if (sortCol === "crecimiento")
        return (((a.crecimiento as number) - (b.crecimiento as number)) * mul);
      return ((a[sortCol] as number) - (b[sortCol] as number)) * mul;
    });
    return arr;
  }, [points, sortCol, sortDir]);

  const dimLabel = DIM_LABEL[dimension];

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
            Dimensión
          </span>
          <div
            className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
            style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)" }}
          >
            {(["clientes", "grupos", "productos", "territorios"] as const).map((d) => (
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
                {DIM_LABEL[d].pl}
              </button>
            ))}
          </div>
        </div>

        {/* Umbral tamaño */}
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Grande si ≥
          </span>
          <input
            type="number"
            min={0}
            step={1000}
            value={Math.round(effSize)}
            onChange={(e) => setSizeThreshold(Math.max(0, Number(e.target.value) || 0))}
            className="w-28 rounded-[var(--radius-sm)] border px-2 py-1 text-[12px] tabular-nums"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>$</span>
          {sizeThreshold !== null && (
            <button
              type="button"
              onClick={() => setSizeThreshold(null)}
              title="Volver a la mediana"
              className="flex items-center"
              style={{ color: "var(--text-muted)" }}
            >
              <RotateCcw size={13} />
            </button>
          )}
        </label>

        {/* Umbral crecimiento */}
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Crece si ≥
          </span>
          <input
            type="number"
            step={1}
            value={growthThreshold}
            onChange={(e) => persistGrowth(Number(e.target.value) || 0)}
            className="w-16 rounded-[var(--radius-sm)] border px-2 py-1 text-[12px] tabular-nums"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>%</span>
        </label>
      </div>

      {/* Ventana de comparación (mismo tramo de fechas en ambos años) */}
      {meta && !loading && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-[11px]"
          style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <span>
            Comparando{" "}
            <strong>{fmtDate(meta.from)} → {fmtDate(meta.effectiveTo)}</strong>{" "}
            vs mismo rango{" "}
            <strong>{fmtDate(meta.prevFrom)} → {fmtDate(meta.prevTo)}</strong>
          </span>
          {meta.capped && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
            >
              ⓘ periodo actual ajustado al último día con datos ({fmtDate(meta.effectiveTo)}) para una comparación justa
            </span>
          )}
        </div>
      )}

      {/* Resumen por cuadrante */}
      {!loading && points.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["estrella", "riesgo", "apuesta", "marginal"] as const).map((q) => {
            const s = summary[q];
            const sharePct = totalVenta > 0 ? (s.venta / totalVenta) * 100 : 0;
            return (
              <div
                key={q}
                className="rounded-[var(--radius-lg)] border p-3"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: q === "riesgo" ? "var(--danger)" : "var(--border)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: QUAD[q].color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    {QUAD[q].label}
                  </span>
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {s.n}
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {moneyCompact(s.venta)} · {sharePct.toFixed(0)}% de la venta
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráfica */}
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
          <Empty>Sin items comparables para el rango y dimensión seleccionados.</Empty>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={460}>
              <ScatterChart margin={{ top: 20, right: 24, bottom: 36, left: 12 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                {/* Sombreado de cuadrantes */}
                <ReferenceArea x1={effSize} x2={xDomain[1]} y1={growthThreshold} y2={yDomain[1]} fill="var(--success)" fillOpacity={0.06} />
                <ReferenceArea x1={xDomain[0]} x2={effSize} y1={growthThreshold} y2={yDomain[1]} fill="var(--accent)" fillOpacity={0.06} />
                <ReferenceArea x1={effSize} x2={xDomain[1]} y1={yDomain[0]} y2={growthThreshold} fill="var(--danger)" fillOpacity={0.07} />
                <ReferenceArea x1={xDomain[0]} x2={effSize} y1={yDomain[0]} y2={growthThreshold} fill="var(--text-muted)" fillOpacity={0.05} />
                <XAxis
                  type="number"
                  dataKey="ventaActual"
                  name="Venta"
                  scale="log"
                  domain={xDomain}
                  allowDataOverflow
                  tickFormatter={moneyCompact}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickLine={false}
                  label={{ value: "Tamaño (venta, log) →", position: "insideBottomRight", offset: -6, fontSize: 11, fill: "var(--text-muted)" }}
                />
                <YAxis
                  type="number"
                  dataKey="gPlot"
                  name="Crecimiento"
                  domain={yDomain}
                  allowDataOverflow
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  label={{ value: "Crecimiento YoY", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--text-muted)" }}
                />
                <ZAxis type="number" dataKey="zVal" range={[50, 520]} name="Margen" />
                <ReferenceLine x={effSize} stroke="var(--text-primary)" strokeDasharray="4 4" />
                <ReferenceLine y={growthThreshold} stroke="var(--text-primary)" strokeDasharray="4 4" />
                <Tooltip content={<CuadranteTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }} />
                <Scatter data={points} fillOpacity={0.7}>
                  {points.map((p, i) => (
                    <Cell key={i} fill={p.color} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            {/* Etiquetas de cuadrante */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {(["estrella", "apuesta", "riesgo", "marginal"] as const).map((q) => (
                <span key={q} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: QUAD[q].color }} />
                  {QUAD[q].label}
                </span>
              ))}
              <span>· burbuja = margen $</span>
            </div>
          </>
        )}
      </div>

      {/* Nuevos */}
      {nuevos.length > 0 && (
        <div
          className="rounded-[var(--radius-lg)] border p-4"
          style={{ background: "var(--bg-surface)", borderColor: NUEVO_COLOR }}
        >
          <div className="mb-2 flex items-center gap-2">
            <Star size={15} style={{ color: NUEVO_COLOR }} />
            <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Nuevos del periodo · {nuevos.length} {dimLabel.pl.toLowerCase()} · {moneyCompact(nuevos.reduce((s, n) => s + n.ventaActual, 0))}
            </span>
          </div>
          <p className="mb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Sin venta el año anterior → no tienen crecimiento comparable. Top por venta:
          </p>
          <div className="flex flex-wrap gap-2">
            {nuevos.slice(0, 12).map((n) => (
              <span
                key={n.name}
                className="rounded-[var(--radius-sm)] border px-2 py-1 text-[11px]"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {n.name} · <strong>{moneyCompact(n.ventaActual)}</strong>
              </span>
            ))}
            {nuevos.length > 12 && (
              <span className="px-2 py-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                +{nuevos.length - 12} más…
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabla ordenable */}
      {points.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr style={{ background: "var(--bg-surface-muted)" }}>
                <SortTh col="name" label={dimLabel.sg} sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="quad" label="Cuadrante" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="ventaActual" label="Venta" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="crecimiento" label="Crecim. YoY" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="margenPct" label="Margen %" align="right" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {tableRows.map((p, i) => (
                <tr
                  key={p.name}
                  style={{ background: i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-muted)" }}
                >
                  <Td>{p.name}</Td>
                  <Td>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: "var(--bg-surface-muted)", color: QUAD[p.quad].color }}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: QUAD[p.quad].color }} />
                      {QUAD[p.quad].label}
                    </span>
                  </Td>
                  <Td align="right" bold>{money(p.ventaActual)}</Td>
                  <Td align="right" color={(p.crecimiento as number) >= 0 ? "var(--success)" : "var(--danger)"}>
                    {pct(p.crecimiento as number)}
                  </Td>
                  <Td align="right">{p.margenPct.toFixed(1)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Contexto: {contextLabel}. Crecimiento = (venta actual − venta mismo rango año
        anterior) ÷ venta año anterior. Eje X en escala logarítmica; el eje Y acota
        outliers extremos (el valor real va en el tooltip). Umbral de tamaño default =
        mediana ({moneyCompact(medianaVenta)}).
      </p>
    </div>
  );
}

// ===== Subcomponentes =====
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

function Td({
  children,
  align = "left",
  bold = false,
  color,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  bold?: boolean;
  color?: string;
}) {
  return (
    <td
      className="px-3 py-1.5"
      style={{ textAlign: align, fontWeight: bold ? 600 : 400, color: color ?? "var(--text-primary)" }}
    >
      {children}
    </td>
  );
}

interface TooltipDatum {
  name?: string;
  ventaActual?: number;
  ventaPrev?: number;
  crecimiento?: number | null;
  margenActual?: number;
  margenPct?: number;
  quad?: Quadrant;
}
function CuadranteTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TooltipDatum }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  const q = d.quad ? QUAD[d.quad] : null;
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2 text-[12px] shadow-lg"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)", minWidth: 190 }}
    >
      <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)", wordBreak: "break-word" }}>
        {q && <span className="inline-block h-2 w-2 rounded-full" style={{ background: q.color }} />}
        {d.name}
      </div>
      {q && <Row k="Cuadrante" v={q.label} color={q.color} />}
      <Row k="Venta" v={money(d.ventaActual ?? 0)} />
      <Row
        k="Crecim. YoY"
        v={d.crecimiento == null ? "Nuevo" : pct(d.crecimiento)}
        color={d.crecimiento != null && d.crecimiento < 0 ? "var(--danger)" : "var(--success)"}
      />
      <Row k="Margen $" v={money(d.margenActual ?? 0)} />
      <Row k="Margen %" v={`${(d.margenPct ?? 0).toFixed(1)}%`} />
    </div>
  );
}
function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span className="font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {v}
      </span>
    </div>
  );
}
