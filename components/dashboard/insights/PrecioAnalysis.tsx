"use client";

/**
 * PrecioAnalysis — sub-análisis "Dispersión de precio ($/kg)" del tab Insights.
 *
 * Pregunta que resuelve: ¿a qué precio/kg le vendemos el MISMO producto a
 * cada cliente? ¿Quién paga por debajo del promedio y cuánto dinero estamos
 * dejando en la mesa?
 *
 * Flujo:
 *   1. Eliges nivel (SKU | Grupo | Familia) y un item (selector con búsqueda,
 *      default = el de mayor volumen).
 *   2. Se grafica la dispersión: cada cliente = un punto (X = precio/kg
 *      ponderado, Y = volumen kg). Línea de promedio ponderado + umbral
 *      "paga barato" (−X% configurable).
 *   3. Piso de volumen configurable (cubrir X% del volumen) descarta la cola
 *      de compras mínimas que ensucia la dispersión.
 *   4. Tabla ordenada por "dinero en la mesa" = (promedio − precio_cliente) ×
 *      kg, en pesos concretos.
 *
 * Respeta el contexto de territorios del sidebar (RLS).
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
import { Loader2, TrendingDown, Info } from "lucide-react";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/dashboard/DateRangePicker";
import { ItemPicker, type PickerOption } from "./ItemPicker";

type Level = "sku" | "grupo" | "familia";
const LEVEL_LABEL: Record<Level, string> = {
  sku: "SKU",
  grupo: "Grupo",
  familia: "Familia",
};

const SK_LEVEL = "insights-precio-level";
const SK_UMBRAL = "insights-precio-umbral";
const SK_PISO = "insights-precio-piso";

interface Props {
  today: { year: number; month: number; day: number };
  territorios: string[] | null;
  contextLabel: string;
}

interface ClienteRow {
  name: string;
  kg: number;
  venta: number;
  margen: number;
  precioKg: number;
  margenPct: number;
}
interface Detail {
  level: Level;
  item: string;
  universe: {
    kg: number;
    venta: number;
    margen: number;
    precioKg: number;
    margenPct: number;
    totalClientes: number;
  } | null;
  clientes: ClienteRow[];
}

// ===== Formatos compactos =====
function money(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}
function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}
function kgCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M kg`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K kg`;
  return `${Math.round(n)} kg`;
}

function territoriosKeyOf(t: string[] | null): string {
  return t === null ? "__ALL__" : t.length === 0 ? "__NONE__" : t.slice().sort().join("|");
}

export function PrecioAnalysis({ today, territorios, contextLabel }: Props) {
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
  const [level, setLevel] = useState<Level>("sku");
  const [item, setItem] = useState<string | null>(null);
  const [umbralPct, setUmbralPct] = useState(10);
  const [pisoPct, setPisoPct] = useState(95);

  const [items, setItems] = useState<PickerOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar preferencias
  useEffect(() => {
    try {
      const lv = window.localStorage.getItem(SK_LEVEL);
      if (lv === "sku" || lv === "grupo" || lv === "familia") setLevel(lv);
      const u = Number(window.localStorage.getItem(SK_UMBRAL));
      if (Number.isFinite(u) && u >= 0 && u <= 50) setUmbralPct(u);
      const p = Number(window.localStorage.getItem(SK_PISO));
      if (Number.isFinite(p) && p >= 50 && p <= 100) setPisoPct(p);
    } catch {
      // ignore
    }
  }, []);

  const persistLevel = (lv: Level) => {
    setLevel(lv);
    setItem(null); // re-elige top al cambiar de nivel
    try {
      window.localStorage.setItem(SK_LEVEL, lv);
    } catch {
      // ignore
    }
  };
  const persistUmbral = (v: number) => {
    setUmbralPct(v);
    try {
      window.localStorage.setItem(SK_UMBRAL, String(v));
    } catch {
      // ignore
    }
  };
  const persistPiso = (v: number) => {
    setPisoPct(v);
    try {
      window.localStorage.setItem(SK_PISO, String(v));
    } catch {
      // ignore
    }
  };

  const tKey = territoriosKeyOf(territorios);

  // Fetch lista de items (selector)
  useEffect(() => {
    let cancelled = false;
    if (tKey === "__NONE__") {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    const params = new URLSearchParams();
    params.set("from", range.from);
    params.set("to", range.to);
    params.set("level", level);
    if (territorios !== null) params.set("territorios", territorios.join(","));
    fetch(`/api/insights/precio-dispersion?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { items?: PickerOption[] }) => {
        if (cancelled) return;
        const list = json.items ?? [];
        setItems(list);
        // Auto-seleccionar el top por volumen si no hay item válido
        setItem((cur) => {
          if (cur && list.some((o) => o.name === cur)) return cur;
          return list[0]?.name ?? null;
        });
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, level, tKey]);

  // Fetch detalle del item seleccionado
  useEffect(() => {
    let cancelled = false;
    if (!item || tKey === "__NONE__") {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("from", range.from);
    params.set("to", range.to);
    params.set("level", level);
    params.set("item", item);
    if (territorios !== null) params.set("territorios", territorios.join(","));
    fetch(`/api/insights/precio-dispersion?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: Detail) => {
        if (!cancelled) setDetail(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, level, item, tKey]);

  // ===== Derivados: piso de volumen + umbral + oportunidad =====
  const avg = detail?.universe?.precioKg ?? 0;
  const umbralPrecio = avg * (1 - umbralPct / 100);

  const enriched = useMemo(() => {
    if (!detail?.universe || detail.clientes.length === 0) {
      return { visible: [] as Array<ClienteRow & { below: boolean; vsAvgPct: number; oportunidad: number }>, excluded: 0, totalOportunidad: 0, belowCount: 0, minP: 0, maxP: 0 };
    }
    const totalKg = detail.universe.kg;
    const target = totalKg * (pisoPct / 100);
    // clientes ya vienen ordenados por kg desc
    const visibleRaw: ClienteRow[] = [];
    let cum = 0;
    for (const c of detail.clientes) {
      visibleRaw.push(c);
      cum += c.kg;
      if (cum >= target) break;
    }
    const excluded = detail.clientes.length - visibleRaw.length;
    let totalOportunidad = 0;
    let belowCount = 0;
    let minP = Infinity;
    let maxP = -Infinity;
    const visible = visibleRaw.map((c) => {
      const below = c.precioKg < umbralPrecio;
      const vsAvgPct = avg > 0 ? ((c.precioKg - avg) / avg) * 100 : 0;
      const oportunidad =
        c.precioKg < avg ? (avg - c.precioKg) * c.kg : 0;
      if (below) {
        belowCount += 1;
        totalOportunidad += oportunidad;
      }
      if (c.precioKg < minP) minP = c.precioKg;
      if (c.precioKg > maxP) maxP = c.precioKg;
      return { ...c, below, vsAvgPct, oportunidad };
    });
    return { visible, excluded, totalOportunidad, belowCount, minP, maxP };
  }, [detail, pisoPct, umbralPct, avg, umbralPrecio]);

  const tableRows = useMemo(
    () => [...enriched.visible].sort((a, b) => b.oportunidad - a.oportunidad),
    [enriched.visible]
  );

  const xDomain = useMemo<[number, number]>(() => {
    if (enriched.visible.length === 0) return [0, 1];
    const lo = Math.min(enriched.minP, umbralPrecio);
    const hi = Math.max(enriched.maxP, avg);
    const pad = (hi - lo) * 0.08 || hi * 0.08 || 1;
    return [Math.max(0, lo - pad), hi + pad];
  }, [enriched, umbralPrecio, avg]);

  const noDispersion =
    detail != null &&
    !loadingDetail &&
    (detail.clientes.length <= 1 || enriched.visible.length <= 1);

  return (
    <div className="space-y-4">
      {/* Toolbar fechas */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DateRangePicker value={range} onChange={setRange} today={today} />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Nivel */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Nivel
          </span>
          <div
            className="inline-flex items-center gap-0 rounded-[var(--radius)] border p-0.5"
            style={{
              background: "var(--bg-surface-muted)",
              borderColor: "var(--border)",
            }}
          >
            {(["sku", "grupo", "familia"] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => persistLevel(lv)}
                className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: level === lv ? "var(--bg-surface)" : "transparent",
                  color: level === lv ? "var(--accent)" : "var(--text-secondary)",
                  boxShadow: level === lv ? "var(--shadow-card)" : "none",
                }}
              >
                {LEVEL_LABEL[lv]}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de item */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {LEVEL_LABEL[level]}
          </span>
          {loadingItems ? (
            <div
              className="flex h-[34px] min-w-[240px] items-center gap-2 rounded-[var(--radius)] border px-3 text-[12px]"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <Loader2 size={13} className="animate-spin" /> Cargando items…
            </div>
          ) : (
            <ItemPicker
              options={items}
              value={item}
              onChange={setItem}
              placeholder={`Buscar ${LEVEL_LABEL[level].toLowerCase()}…`}
              formatKg={kgCompact}
              formatMoney={money}
            />
          )}
        </div>

        {/* Umbral barato */}
        <label className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Barato si &lt; −
          </span>
          <input
            type="number"
            min={0}
            max={50}
            value={umbralPct}
            onChange={(e) =>
              persistUmbral(Math.max(0, Math.min(50, Number(e.target.value) || 0)))
            }
            className="w-14 rounded-[var(--radius-sm)] border px-2 py-1 text-[12px] tabular-nums"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            % del prom.
          </span>
        </label>

        {/* Piso de volumen */}
        <label className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Cubrir
          </span>
          <input
            type="number"
            min={50}
            max={100}
            value={pisoPct}
            onChange={(e) =>
              persistPiso(Math.max(50, Math.min(100, Number(e.target.value) || 100)))
            }
            className="w-14 rounded-[var(--radius-sm)] border px-2 py-1 text-[12px] tabular-nums"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            % del volumen
          </span>
        </label>
      </div>

      {/* Stats */}
      {detail?.universe && !noDispersion && (
        <div
          className="grid grid-cols-2 gap-3 rounded-[var(--radius-lg)] border p-4 md:grid-cols-4"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <Stat
            label="Precio prom. ponderado"
            value={`${money(avg)}/kg`}
            sub={`${detail.universe.totalClientes} clientes · ${kgCompact(
              detail.universe.kg
            )}`}
          />
          <Stat
            label="Clientes que pagan barato"
            value={String(enriched.belowCount)}
            sub={`< ${money(umbralPrecio)}/kg (−${umbralPct}%)`}
            danger={enriched.belowCount > 0}
          />
          <Stat
            label="💰 Dinero en la mesa"
            value={moneyCompact(enriched.totalOportunidad)}
            sub="si los subes al promedio"
            accent
          />
          <Stat
            label="Rango de precio"
            value={`${money(enriched.minP)} – ${money(enriched.maxP)}`}
            sub={
              enriched.minP > 0
                ? `spread ${(((enriched.maxP - enriched.minP) / enriched.minP) * 100).toFixed(0)}%`
                : ""
            }
          />
        </div>
      )}

      {/* Gráfica / estados */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {tKey === "__NONE__" ? (
          <Empty>Ningún territorio seleccionado.</Empty>
        ) : loadingDetail || (item && !detail) ? (
          <div
            className="flex items-center justify-center gap-2 py-32 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <Loader2 size={16} className="animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <Empty danger>Error: {error}</Empty>
        ) : !item ? (
          <Empty>Sin items para el rango y nivel seleccionados.</Empty>
        ) : noDispersion ? (
          <div
            className="flex flex-col items-center gap-2 py-20 text-center text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <Info size={22} style={{ color: "var(--text-muted)" }} />
            <p>
              <strong>{item}</strong> lo compra{" "}
              {detail?.clientes.length ?? 0}{" "}
              {(detail?.clientes.length ?? 0) === 1 ? "cliente" : "clientes"} en
              el rango — no hay dispersión de precio para analizar.
            </p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Suele pasar con marcas privadas o exclusivas. Elige otro{" "}
              {LEVEL_LABEL[level].toLowerCase()} con más clientes, o sube el
              piso de volumen.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h4
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Dispersión de precio · {item}
              </h4>
              {enriched.excluded > 0 && (
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {enriched.excluded} clientes de cola excluidos (piso {pisoPct}%)
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 40, left: 8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="precioKg"
                  name="Precio/kg"
                  domain={xDomain}
                  tickFormatter={(v) => money(v)}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickLine={false}
                  label={{
                    value: "Precio / kg →",
                    position: "insideBottomRight",
                    offset: -8,
                    fontSize: 11,
                    fill: "var(--text-muted)",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="kg"
                  name="Volumen"
                  tickFormatter={kgCompact}
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <ZAxis type="number" range={[50, 50]} />
                {/* Promedio ponderado */}
                <ReferenceLine
                  x={avg}
                  stroke="var(--text-primary)"
                  strokeDasharray="4 4"
                  label={{
                    value: `prom ${money(avg)}`,
                    position: "top",
                    fontSize: 10,
                    fill: "var(--text-primary)",
                  }}
                />
                {/* Umbral barato */}
                <ReferenceLine
                  x={umbralPrecio}
                  stroke="var(--danger)"
                  strokeDasharray="3 3"
                  label={{
                    value: `−${umbralPct}%`,
                    position: "top",
                    fontSize: 10,
                    fill: "var(--danger)",
                  }}
                />
                <Tooltip
                  content={<PrecioTooltip avg={avg} />}
                  cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
                />
                <Scatter data={enriched.visible} fillOpacity={0.85}>
                  {enriched.visible.map((c, i) => (
                    <Cell
                      key={i}
                      fill={
                        c.below
                          ? "var(--danger)"
                          : c.precioKg < avg
                            ? "var(--warning)"
                            : "var(--success)"
                      }
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div
              className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              <Legend color="var(--danger)" text={`Paga barato (< −${umbralPct}%)`} />
              <Legend color="var(--warning)" text="Bajo promedio" />
              <Legend color="var(--success)" text="En/sobre promedio" />
              <span>· tamaño Y = volumen (kg)</span>
            </div>

            {/* Tabla dinero en la mesa */}
            <div
              className="mt-4 overflow-x-auto rounded-[var(--radius)] border"
              style={{ borderColor: "var(--border)" }}
            >
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr style={{ background: "var(--bg-surface-muted)" }}>
                    <Th>Cliente</Th>
                    <Th align="right">Precio/kg</Th>
                    <Th align="right">vs prom.</Th>
                    <Th align="right">Volumen</Th>
                    <Th align="right">Venta</Th>
                    <Th align="right">Margen %</Th>
                    <Th align="right">💰 En la mesa</Th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((c, i) => (
                    <tr
                      key={c.name}
                      style={{
                        background: c.below
                          ? "var(--danger-soft)"
                          : i % 2 === 0
                            ? "var(--bg-surface)"
                            : "var(--bg-surface-muted)",
                      }}
                    >
                      <Td>
                        <span className="flex items-center gap-1.5">
                          {c.below && (
                            <TrendingDown
                              size={13}
                              style={{ color: "var(--danger)" }}
                            />
                          )}
                          {c.name}
                        </span>
                      </Td>
                      <Td align="right" bold>
                        {money(c.precioKg)}
                      </Td>
                      <Td
                        align="right"
                        color={
                          c.vsAvgPct < 0 ? "var(--danger)" : "var(--success)"
                        }
                      >
                        {c.vsAvgPct >= 0 ? "+" : ""}
                        {c.vsAvgPct.toFixed(1)}%
                      </Td>
                      <Td align="right">{kgCompact(c.kg)}</Td>
                      <Td align="right">{moneyCompact(c.venta)}</Td>
                      <Td align="right">{c.margenPct.toFixed(1)}%</Td>
                      <Td align="right" bold>
                        {c.oportunidad > 0 ? moneyCompact(c.oportunidad) : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Contexto: {contextLabel}. Precio/kg = venta ÷ kg ponderado. "Dinero en la
        mesa" = (promedio − precio del cliente) × su volumen, solo para los que
        pagan bajo el umbral.
      </p>
    </div>
  );
}

// ===== Subcomponentes =====
function Stat({
  label,
  value,
  sub,
  danger = false,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-xl font-bold tabular-nums"
        style={{
          color: danger
            ? "var(--danger)"
            : accent
              ? "var(--accent)"
              : "var(--text-primary)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Empty({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className="py-24 text-center text-sm"
      style={{ color: danger ? "var(--danger)" : "var(--text-muted)" }}
    >
      {children}
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      {text}
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        color: "var(--text-muted)",
        textAlign: align,
      }}
    >
      {children}
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
      style={{
        textAlign: align,
        fontWeight: bold ? 600 : 400,
        color: color ?? "var(--text-primary)",
      }}
    >
      {children}
    </td>
  );
}

interface TooltipDatum {
  name?: string;
  precioKg?: number;
  kg?: number;
  venta?: number;
  margenPct?: number;
  oportunidad?: number;
  below?: boolean;
}
function PrecioTooltip({
  active,
  payload,
  avg,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TooltipDatum }>;
  avg: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  const vsAvg = avg > 0 ? (((d.precioKg ?? 0) - avg) / avg) * 100 : 0;
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2 text-[12px] shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        minWidth: 180,
      }}
    >
      <div
        className="mb-1 font-bold uppercase tracking-wider"
        style={{ color: "var(--text-primary)", wordBreak: "break-word" }}
      >
        {d.name}
      </div>
      <Row k="Precio/kg" v={`${money(d.precioKg ?? 0)} (${vsAvg >= 0 ? "+" : ""}${vsAvg.toFixed(1)}%)`} />
      <Row k="Volumen" v={kgCompact(d.kg ?? 0)} />
      <Row k="Venta" v={money(d.venta ?? 0)} />
      <Row k="Margen %" v={`${(d.margenPct ?? 0).toFixed(1)}%`} />
      {(d.oportunidad ?? 0) > 0 && (
        <Row
          k="💰 En la mesa"
          v={money(d.oportunidad ?? 0)}
          highlight
        />
      )}
    </div>
  );
}
function Row({ k, v, highlight = false }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span
        className="font-semibold tabular-nums"
        style={{ color: highlight ? "var(--accent)" : "var(--text-primary)" }}
      >
        {v}
      </span>
    </div>
  );
}
