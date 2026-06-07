"use client";

/**
 * EstacionalidadAnalysis — sub-análisis "Estacionalidad (heatmap)" del tab
 * Insights.
 *
 * Pregunta: ¿qué meses son pico/valle por familia/grupo/territorio/cliente/SKU?
 * ¿Cuándo compro, produzco y promociono?
 *
 * Heatmap mes (Ene–Dic) × dimensión. Cada celda muestra el ÍNDICE de
 * estacionalidad (valor_mes ÷ promedio mensual del item × 100) — 100 = mes
 * típico, >100 pico, <100 valle — o el valor ABSOLUTO (toggle). El índice
 * normaliza por tamaño, así una familia chica y una grande se comparan.
 *
 * Año seleccionable (2026 marcado parcial). Métrica Kg (default, para planear
 * producción/compra) o Pesos. Respeta el contexto de territorios (RLS).
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type Dimension = "clientes" | "grupos" | "productos" | "territorios";
const DIM_LABEL: Record<Dimension, string> = {
  clientes: "Clientes",
  grupos: "Grupos",
  productos: "Productos",
  territorios: "Territorios",
};
const HIGH_CARD = new Set<Dimension>(["clientes", "productos"]);
type Metric = "kg" | "venta";
type Mode = "indice" | "absoluto";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const SK_YEAR = "insights-estac-year";
const SK_DIM = "insights-estac-dim";
const SK_METRIC = "insights-estac-metric";
const SK_MODE = "insights-estac-mode";
const SK_TOPN = "insights-estac-topn";

interface Props {
  today: { year: number; month: number; day: number };
  territorios: string[] | null;
  contextLabel: string;
}

interface Item {
  name: string;
  byMonth: number[];
  total: number;
}
interface ApiResp {
  year: number;
  dimension: Dimension;
  metric: Metric;
  monthsPresent: number[];
  items: Item[];
  total: { byMonth: number[]; complete: boolean };
}

// ===== Formatos =====
function kgC(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}
function moneyC(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}
function territoriosKeyOf(t: string[] | null): string {
  return t === null ? "__ALL__" : t.length === 0 ? "__NONE__" : t.slice().sort().join("|");
}

// Color de celda: índice centrado en 100 (frío < 100, cálido > 100).
function indexColor(idx: number): { bg: string; color: string } {
  const d = idx - 100;
  if (Math.abs(d) < 3) return { bg: "transparent", color: "var(--text-secondary)" };
  const a = Math.min(1, Math.abs(d) / 60);
  if (d > 0) return { bg: `rgba(217,119,87,${(a * 0.9).toFixed(2)})`, color: a > 0.5 ? "#fff" : "var(--text-primary)" };
  return { bg: `rgba(59,130,246,${(a * 0.85).toFixed(2)})`, color: a > 0.5 ? "#fff" : "var(--text-primary)" };
}
// Color de celda: absoluto secuencial (claro → coral).
function absColor(v: number, max: number): { bg: string; color: string } {
  const a = max > 0 ? v / max : 0;
  return { bg: `rgba(217,119,87,${(a * 0.9).toFixed(2)})`, color: a > 0.55 ? "#fff" : "var(--text-primary)" };
}

export function EstacionalidadAnalysis({ today, territorios, contextLabel }: Props) {
  const years = useMemo(
    () => [today.year - 2, today.year - 1, today.year],
    [today.year]
  );
  const [year, setYear] = useState(today.year - 1);
  const [dimension, setDimension] = useState<Dimension>("grupos");
  const [metric, setMetric] = useState<Metric>("kg");
  const [mode, setMode] = useState<Mode>("indice");
  const [topN, setTopN] = useState(15);

  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const y = Number(window.localStorage.getItem(SK_YEAR));
      if (Number.isFinite(y) && y >= today.year - 2 && y <= today.year) setYear(y);
      const d = window.localStorage.getItem(SK_DIM);
      if (d === "clientes" || d === "grupos" || d === "productos" || d === "territorios") setDimension(d);
      const m = window.localStorage.getItem(SK_METRIC);
      if (m === "kg" || m === "venta") setMetric(m);
      const mo = window.localStorage.getItem(SK_MODE);
      if (mo === "indice" || mo === "absoluto") setMode(mo);
      const tn = Number(window.localStorage.getItem(SK_TOPN));
      if (tn === 10 || tn === 15 || tn === 20 || tn === 30) setTopN(tn);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (key: string, v: string) => {
    try {
      window.localStorage.setItem(key, v);
    } catch {
      // ignore
    }
  };

  const tKey = territoriosKeyOf(territorios);

  useEffect(() => {
    let cancelled = false;
    if (tKey === "__NONE__") {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("dimension", dimension);
    params.set("metric", metric);
    params.set("topN", String(topN));
    if (territorios !== null) params.set("territorios", territorios.join(","));
    fetch(`/api/insights/estacionalidad?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ApiResp) => {
        if (!cancelled) setData(json);
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
  }, [year, dimension, metric, topN, tKey]);

  const presentSet = useMemo(() => new Set(data?.monthsPresent ?? []), [data]);
  const nPresent = data?.monthsPresent.length ?? 0;
  const isPartial = year === today.year;

  // Máximo absoluto (para la escala secuencial del modo absoluto).
  const maxAbs = useMemo(() => {
    if (!data) return 0;
    let mx = 0;
    for (const it of data.items) for (const v of it.byMonth) if (v > mx) mx = v;
    return mx;
  }, [data]);

  const fmtVal = (v: number) => (metric === "kg" ? kgC(v) : moneyC(v));

  const cellText = (value: number, avg: number) => {
    if (mode === "indice") return avg > 0 ? String(Math.round((value / avg) * 100)) : "—";
    return fmtVal(value);
  };
  const cellColor = (value: number, avg: number) => {
    if (mode === "indice") return indexColor(avg > 0 ? (value / avg) * 100 : 100);
    return absColor(value, maxAbs);
  };

  const totalAvg = useMemo(() => {
    if (!data || nPresent === 0) return 0;
    const tot = data.total.byMonth.reduce((s, v) => s + v, 0);
    return tot / nPresent;
  }, [data, nPresent]);

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Toggle label="Año" value={String(year)} options={years.map((y) => ({ value: String(y), label: y === today.year ? `${y}*` : String(y) }))} onChange={(v) => { const y = Number(v); setYear(y); persist(SK_YEAR, v); }} />
        <Toggle label="Dimensión" value={dimension} options={(["grupos", "clientes", "productos", "territorios"] as const).map((d) => ({ value: d, label: DIM_LABEL[d] }))} onChange={(v) => { setDimension(v as Dimension); persist(SK_DIM, v); }} />
        <Toggle label="Métrica" value={metric} options={[{ value: "kg", label: "Kg" }, { value: "venta", label: "Pesos" }]} onChange={(v) => { setMetric(v as Metric); persist(SK_METRIC, v); }} />
        <Toggle label="Vista" value={mode} options={[{ value: "indice", label: "Índice" }, { value: "absoluto", label: "Absoluto" }]} onChange={(v) => { setMode(v as Mode); persist(SK_MODE, v); }} />
        {HIGH_CARD.has(dimension) && (
          <Toggle label="Top N" value={String(topN)} options={[10, 15, 20, 30].map((n) => ({ value: String(n), label: `Top ${n}` }))} onChange={(v) => { setTopN(Number(v)); persist(SK_TOPN, v); }} />
        )}
      </div>

      {isPartial && (
        <div className="rounded-[var(--radius)] border px-3 py-2 text-[11px]" style={{ background: "var(--warning-soft)", borderColor: "var(--warning)", color: "var(--warning)" }}>
          ⓘ {year} es un año parcial (datos hasta el mes {nPresent}). El índice se calcula sobre los meses disponibles; los meses sin datos van en blanco.
        </div>
      )}

      {/* Heatmap */}
      <div className="rounded-[var(--radius-lg)] border" style={{ background: "var(--bg-surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}>
        {tKey === "__NONE__" ? (
          <Empty>Ningún territorio seleccionado.</Empty>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-32 text-sm" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <Empty danger>Error: {error}</Empty>
        ) : !data || data.items.length === 0 ? (
          <Empty>Sin datos para el año y dimensión seleccionados.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px] tabular-nums">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ background: "var(--bg-surface-muted)", color: "var(--text-muted)" }}>
                    {DIM_LABEL[dimension]}
                  </th>
                  {MESES.map((mLabel, i) => {
                    const present = presentSet.has(i + 1);
                    return (
                      <th key={i} className="px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wider" style={{ background: "var(--bg-surface-muted)", color: present ? "var(--text-secondary)" : "var(--text-muted)", opacity: present ? 1 : 0.4 }}>
                        {mLabel}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => {
                  const avg = nPresent > 0 ? it.total / nPresent : 0;
                  return (
                    <tr key={it.name}>
                      <td className="sticky left-0 z-10 max-w-[220px] truncate px-3 py-1.5" style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderTop: "1px solid var(--border)" }} title={it.name}>
                        {it.name}
                      </td>
                      {it.byMonth.map((v, i) => {
                        const present = presentSet.has(i + 1);
                        if (!present) {
                          return <td key={i} className="px-1.5 py-1.5 text-center" style={{ borderTop: "1px solid var(--border)", background: "repeating-linear-gradient(45deg,transparent,transparent 4px,var(--bg-surface-muted) 4px,var(--bg-surface-muted) 8px)" }} />;
                        }
                        const { bg, color } = cellColor(v, avg);
                        const idx = avg > 0 ? Math.round((v / avg) * 100) : 0;
                        return (
                          <td
                            key={i}
                            className="px-1.5 py-1.5 text-center"
                            style={{ background: bg, color, borderTop: "1px solid var(--border)", minWidth: 46 }}
                            title={`${it.name} · ${MESES[i]} ${year}\n${metric === "kg" ? "Kg" : "Venta"}: ${fmtVal(v)}\nÍndice: ${idx} (100 = mes típico)`}
                          >
                            {cellText(v, avg)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Fila TOTAL */}
                <tr>
                  <td className="sticky left-0 z-10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: "var(--bg-surface-muted)", color: "var(--text-primary)", borderTop: "2px solid var(--border)" }}>
                    Total {data.total.complete ? "" : "(top N)"}
                  </td>
                  {data.total.byMonth.map((v, i) => {
                    const present = presentSet.has(i + 1);
                    if (!present) return <td key={i} style={{ borderTop: "2px solid var(--border)", background: "var(--bg-surface-muted)" }} />;
                    const { bg, color } = cellColor(v, totalAvg);
                    const idx = totalAvg > 0 ? Math.round((v / totalAvg) * 100) : 0;
                    return (
                      <td key={i} className="px-1.5 py-1.5 text-center font-semibold" style={{ background: bg, color, borderTop: "2px solid var(--border)" }} title={`Total · ${MESES[i]} ${year}\n${metric === "kg" ? "Kg" : "Venta"}: ${fmtVal(v)}\nÍndice: ${idx}`}>
                        {cellText(v, totalAvg)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {mode === "indice" ? (
          <>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(59,130,246,0.7)" }} /> Valle (&lt;100)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border" style={{ borderColor: "var(--border)" }} /> Típico (≈100)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(217,119,87,0.85)" }} /> Pico (&gt;100)</span>
            <span>· índice = valor del mes ÷ promedio mensual del item × 100</span>
          </>
        ) : (
          <span>Color por magnitud ({metric === "kg" ? "kilos" : "pesos"}) del mes. Cambia a <strong>Índice</strong> para comparar patrones entre items de distinto tamaño.</span>
        )}
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Contexto: {contextLabel}. {DIM_LABEL[dimension]}
        {HIGH_CARD.has(dimension) ? ` (top ${topN} por ${metric === "kg" ? "kilos" : "venta"})` : " (completos)"}. Año {year}
        {isPartial ? " (parcial)" : ""}.
      </p>
    </div>
  );
}

// ===== Subcomponentes =====
function Toggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5" style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)" }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              style={{
                background: active ? "var(--bg-surface)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                boxShadow: active ? "var(--shadow-card)" : "none",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Empty({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="py-24 text-center text-sm" style={{ color: danger ? "var(--danger)" : "var(--text-muted)" }}>
      {children}
    </div>
  );
}
