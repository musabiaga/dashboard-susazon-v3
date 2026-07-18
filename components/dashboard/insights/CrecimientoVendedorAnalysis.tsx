"use client";

/**
 * CrecimientoVendedorAnalysis — 6º sub-análisis de Insights.
 *
 * Tabla comparativa Año Anterior vs Año Actual (Mes + Acumulado, capados al
 * MISMO día) por cliente o producto, filtrable por vendedor (+ territorio /
 * agrupador del sidebar). Evalúa el desempeño y crecimiento de cada vendedor.
 * Una sola consulta trae venta/kg/margen crudos → cambiar de medición es
 * instantáneo. Dos tablas sincronizadas (mismo orden) + orden por columna.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Search } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

type Dimension = "clientes" | "productos";
type Medicion = "kg" | "venta" | "margenPct" | "margenAbs" | "variedad";
type Period = "aa_mes" | "aa_ytd" | "act_mes" | "act_ytd";
type SortCol = "name" | Period | "g_mes" | "g_ytd";

interface Row {
  name: string;
  aa_mes_venta: number; aa_mes_kg: number; aa_mes_margen: number; aa_mes_var: number;
  aa_ytd_venta: number; aa_ytd_kg: number; aa_ytd_margen: number; aa_ytd_var: number;
  act_mes_venta: number; act_mes_kg: number; act_mes_margen: number; act_mes_var: number;
  act_ytd_venta: number; act_ytd_kg: number; act_ytd_margen: number; act_ytd_var: number;
}

interface Props {
  today: { year: number; month: number; day: number };
  territorios: string[] | null;
  contextLabel: string;
  agrupadorId?: string | null;
}

const MEDICIONES: { key: Medicion; label: string }[] = [
  { key: "kg", label: "Kilos" },
  { key: "venta", label: "$ Vendido" },
  { key: "margenPct", label: "Margen %" },
  { key: "margenAbs", label: "Margen $" },
  { key: "variedad", label: "Variedad" },
];
const MES_NOM = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function territoriosKeyOf(t: string[] | null): string {
  if (t === null) return "__ALL__";
  if (t.length === 0) return "__NONE__";
  return [...t].sort().join("|");
}

function cellValue(r: Row, p: Period, m: Medicion): number | null {
  const venta = r[`${p}_venta` as keyof Row] as number;
  const kg = r[`${p}_kg` as keyof Row] as number;
  const margen = r[`${p}_margen` as keyof Row] as number;
  if (m === "kg") return kg;
  if (m === "venta") return venta;
  if (m === "margenAbs") return margen;
  if (m === "variedad") return r[`${p}_var` as keyof Row] as number; // # SKUs (clientes) / # clientes (productos)
  return venta > 0 ? (margen / venta) * 100 : null; // margenPct
}

/** Número ordenable del crecimiento (Nuevo=tope, sin dato=fondo). */
function growthNum(aa: number | null, act: number | null, m: Medicion): number {
  if (m === "margenPct") {
    if (aa === null && act === null) return -Infinity;
    return (act ?? 0) - (aa ?? 0);
  }
  const a = aa ?? 0, b = act ?? 0;
  if (a === 0 && b === 0) return -Infinity;
  if (a === 0 && b > 0) return Number.MAX_SAFE_INTEGER;
  if (a > 0 && b === 0) return -100;
  return ((b - a) / Math.abs(a)) * 100;
}

function growthLabel(aa: number | null, act: number | null, m: Medicion): { txt: string; tone: "up" | "down" | "new" | "neutral" } {
  if (m === "margenPct") {
    if (aa === null && act === null) return { txt: "—", tone: "neutral" };
    const d = (act ?? 0) - (aa ?? 0);
    return { txt: `${d >= 0 ? "+" : ""}${d.toFixed(1)} pp`, tone: d > 0.05 ? "up" : d < -0.05 ? "down" : "neutral" };
  }
  const a = aa ?? 0, b = act ?? 0;
  if (a === 0 && b === 0) return { txt: "—", tone: "neutral" };
  if (a === 0 && b > 0) return { txt: "Nuevo", tone: "new" };
  if (a > 0 && b === 0) return { txt: "−100%", tone: "down" };
  const pct = ((b - a) / Math.abs(a)) * 100;
  return { txt: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, tone: pct > 0 ? "up" : pct < 0 ? "down" : "neutral" };
}

function fmtCell(v: number | null, m: Medicion): string {
  if (v === null) return "—";
  if (m === "kg") return formatKilos(v);
  if (m === "margenPct") return `${v.toFixed(1)}%`;
  if (m === "variedad") return Math.round(v).toLocaleString("es-MX");
  return formatMoney(v);
}

function toneColor(tone: "up" | "down" | "new" | "neutral"): string {
  return tone === "up" || tone === "new" ? "var(--success)" : tone === "down" ? "var(--danger)" : "var(--text-muted)";
}

export function CrecimientoVendedorAnalysis({ territorios, contextLabel, agrupadorId = null }: Props) {
  const [dimension, setDimension] = useState<Dimension>("clientes");
  const [medicion, setMedicion] = useState<Medicion>("venta");
  const [vendedor, setVendedor] = useState<string>(""); // "" = Todos
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("act_ytd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [rows, setRows] = useState<Row[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [refDate, setRefDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tKey = territoriosKeyOf(territorios);

  useEffect(() => {
    let cancelled = false;
    if (!agrupadorId && tKey === "__NONE__") {
      setRows([]); setVendedores([]); setRefDate(null);
      return;
    }
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    params.set("dimension", dimension);
    if (vendedor) params.set("vendedor", vendedor);
    if (agrupadorId) params.set("agrupador", agrupadorId);
    else if (territorios !== null) params.set("territorios", territorios.join(","));
    fetch(`/api/insights/crecimiento-vendedor?${params.toString()}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json: { rows?: Row[]; vendedores?: string[]; refDate?: string | null }) => {
        if (cancelled) return;
        setRows(json.rows ?? []);
        // el dropdown de vendedores NO cambia al elegir uno; solo lo poblamos
        // cuando venimos de "Todos" (o si aún está vacío).
        if (!vendedor || vendedores.length === 0) setVendedores(json.vendedores ?? []);
        setRefDate(json.refDate ?? null);
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, vendedor, tKey, agrupadorId]);

  // Etiquetas de fecha
  const { yAct, yAnt, mesNom, dia } = useMemo(() => {
    if (!refDate) return { yAct: 0, yAnt: 0, mesNom: "", dia: 0 };
    const y = Number(refDate.slice(0, 4));
    const mm = Number(refDate.slice(5, 7));
    const d = Number(refDate.slice(8, 10));
    return { yAct: y, yAnt: y - 1, mesNom: MES_NOM[mm], dia: d };
  }, [refDate]);

  // Filtro por búsqueda + orden sincronizado (mismo array alimenta ambas tablas)
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
    const valOf = (r: Row): number => {
      if (sortCol === "g_mes") return growthNum(cellValue(r, "aa_mes", medicion), cellValue(r, "act_mes", medicion), medicion);
      if (sortCol === "g_ytd") return growthNum(cellValue(r, "aa_ytd", medicion), cellValue(r, "act_ytd", medicion), medicion);
      const v = cellValue(r, sortCol as Period, medicion);
      return v === null ? -Infinity : v;
    };
    return [...filtered].sort((a, b) => {
      if (sortCol === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const va = valOf(a), vb = valOf(b);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [rows, query, sortCol, sortDir, medicion]);

  const setSort = (c: SortCol) => {
    if (sortCol === c) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(c); setSortDir(c === "name" ? "asc" : "desc"); }
  };

  const dimLabel = dimension === "clientes" ? "Cliente" : "Producto";
  const mesLbl = mesNom && dia ? `${mesNom} · al día ${dia}` : "Mes";

  // === componentes de UI ===
  const Th = ({ col, children, align = "right" }: { col: SortCol; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      onClick={() => setSort(col)}
      className={`cursor-pointer select-none whitespace-nowrap px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${align === "left" ? "text-left" : "text-right"}`}
      style={{ color: sortCol === col ? "var(--accent)" : "var(--text-secondary)" }}
    >
      <span className="inline-flex items-center gap-1" style={{ flexDirection: align === "right" ? "row-reverse" : "row" }}>
        {children}
        {sortCol === col ? (sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />) : null}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] border p-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <Toggle label="Dimensión" value={dimension} onChange={(v) => setDimension(v as Dimension)}
          options={[{ key: "clientes", label: "Clientes" }, { key: "productos", label: "Productos" }]} />
        <Toggle label="Medición" value={medicion} onChange={(v) => setMedicion(v as Medicion)}
          options={MEDICIONES} />
        {/* Vendedor */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Vendedor</span>
          <select
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            className="rounded-[var(--radius-sm)] border px-2 py-1 text-xs"
            style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)", color: "var(--text-primary)", maxWidth: 220 }}
          >
            <option value="">Todos ({vendedores.length})</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {/* Búsqueda */}
        <div className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${dimLabel.toLowerCase()}…`}
            className="rounded-[var(--radius-sm)] border py-1 pl-7 pr-2 text-xs"
            style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)", color: "var(--text-primary)", width: 180 }}
          />
        </div>
      </div>

      {/* Contexto */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>
          {contextLabel} · {vendedor ? `Vendedor: ${vendedor}` : "Todos los vendedores"} ·{" "}
          <strong style={{ color: "var(--text-secondary)" }}>{sorted.length}</strong> {dimLabel.toLowerCase()}s
          {medicion === "variedad" && (
            <> · <strong style={{ color: "var(--text-secondary)" }}>Variedad</strong> = # de {dimension === "clientes" ? "SKUs distintos" : "clientes distintos"}</>
          )}
        </span>
        {refDate && (
          <span>Comparación justa: ambos años capados al <strong style={{ color: "var(--text-secondary)" }}>{dia} de {mesNom}</strong></span>
        )}
      </div>

      {error && <div className="text-xs" style={{ color: "var(--danger)" }}>{error}</div>}
      {loading && <div className="text-xs" style={{ color: "var(--text-muted)" }}>Cargando…</div>}

      {/* Dos tablas sincronizadas (mismo orden), en un contenedor con scroll común */}
      {!loading && sorted.length > 0 && (
        <div className="max-h-[520px] overflow-auto rounded-[var(--radius-lg)] border" style={{ borderColor: "var(--border)" }}>
          {/* Alturas fijas idénticas (título 26 · encabezado 32 · fila 34) para
              que ambas tablas cuadren renglón a renglón sin importar el contenido. */}
          <div className="flex min-w-full flex-col gap-0 lg:flex-row">
            {/* Tabla 1 — Año Anterior */}
            <table className="w-full border-collapse text-xs lg:w-1/2">
              <thead className="sticky top-0 z-10" style={{ background: "var(--bg-surface-muted)" }}>
                <tr style={{ height: 26 }}>
                  <th colSpan={3} className="px-2.5 pb-0.5 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    Año Anterior · {yAnt || "2025"}
                  </th>
                </tr>
                <tr style={{ height: 32, borderBottom: "1px solid var(--border)" }}>
                  <Th col="name" align="left">{dimLabel}</Th>
                  <Th col="aa_mes">{mesLbl}</Th>
                  <Th col="aa_ytd">Acum</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={"aa-" + r.name} style={{ height: 34, borderBottom: "1px solid var(--border)" }}>
                    <td className="max-w-[240px] truncate px-2.5 py-0" style={{ color: "var(--text-primary)" }} title={r.name}>{r.name}</td>
                    <td className="px-2.5 py-0 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtCell(cellValue(r, "aa_mes", medicion), medicion)}</td>
                    <td className="px-2.5 py-0 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtCell(cellValue(r, "aa_ytd", medicion), medicion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tabla 2 — Año Actual + crecimiento */}
            <table className="w-full border-collapse text-xs lg:w-1/2" style={{ borderLeft: "2px solid var(--border)" }}>
              <thead className="sticky top-0 z-10" style={{ background: "var(--bg-surface-muted)" }}>
                <tr style={{ height: 26 }}>
                  <th colSpan={5} className="px-2.5 pb-0.5 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                    Año Actual · {yAct || "2026"}
                  </th>
                </tr>
                <tr style={{ height: 32, borderBottom: "1px solid var(--border)" }}>
                  <Th col="name" align="left">{dimLabel}</Th>
                  <Th col="act_mes">Avance {mesNom}</Th>
                  <Th col="g_mes">Δ Mes</Th>
                  <Th col="act_ytd">Acum</Th>
                  <Th col="g_ytd">Δ Acum</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const gMes = growthLabel(cellValue(r, "aa_mes", medicion), cellValue(r, "act_mes", medicion), medicion);
                  const gYtd = growthLabel(cellValue(r, "aa_ytd", medicion), cellValue(r, "act_ytd", medicion), medicion);
                  return (
                    <tr key={"act-" + r.name} style={{ height: 34, borderBottom: "1px solid var(--border)" }}>
                      <td className="max-w-[200px] truncate px-2.5 py-0" style={{ color: "var(--text-primary)" }} title={r.name}>{r.name}</td>
                      <td className="px-2.5 py-0 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtCell(cellValue(r, "act_mes", medicion), medicion)}</td>
                      <td className="px-2.5 py-0 text-right font-semibold tabular-nums" style={{ color: toneColor(gMes.tone) }}>{gMes.txt}</td>
                      <td className="px-2.5 py-0 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>{fmtCell(cellValue(r, "act_ytd", medicion), medicion)}</td>
                      <td className="px-2.5 py-0 text-right font-semibold tabular-nums" style={{ color: toneColor(gYtd.tone) }}>{gYtd.txt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && sorted.length === 0 && !error && (
        <div className="rounded-[var(--radius-lg)] border p-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Sin datos para esta selección.
        </div>
      )}
    </div>
  );
}

// ---- sub-toggle reutilizable ----
function Toggle({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { key: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="inline-flex items-center rounded-[var(--radius-sm)] border p-0.5" style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)" }}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
              style={{ background: active ? "var(--bg-surface)" : "transparent", color: active ? "var(--accent)" : "var(--text-secondary)", boxShadow: active ? "var(--shadow-card)" : "none" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
