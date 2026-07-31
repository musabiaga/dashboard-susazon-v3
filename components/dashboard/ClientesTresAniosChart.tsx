"use client";

/**
 * ClientesTresAniosChart — vista "Meses (3 Años)" de la gráfica superior del
 * tab Clientes y Productos.
 *
 * Muestra los 12 MESES del año en el eje X, y por cada mes compara los 3 años
 * (2024 · 2025 · 2026) con BARRAS AGRUPADAS de volumen + LÍNEAS de margen % por
 * año. Agrega TODOS los items seleccionados en una sola serie por año (suma
 * venta/kg/margen), igual que la vista "Evolución".
 *
 * Leyenda + tooltip HOMOLOGADOS con el chart del tab Ventas (ChartLegend con
 * secciones Venta/Margen % arriba + tooltip custom con header de mes y Δ% vs '25).
 *
 * Datos: reusa /api/dashboard/clientes-evolution llamándolo 3 veces (uno por
 * año). Los años cerrados van hasta el mes 12; el año en curso hasta `month`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";
import { ChartLegend } from "@/components/dashboard/ChartLegend";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// Colores por año, homologados con el tab Ventas.
const BAR_24 = "rgba(148, 163, 184, 0.85)"; // gris
const BAR_25 = "rgba(59, 130, 246, 0.85)"; // azul
const BAR_26 = "rgba(16, 185, 129, 0.85)"; // verde
const LINE_24 = "#94a3b8";
const LINE_25 = "#3b82f6";
const LINE_26 = "#10b981";

interface MonthlyCell {
  mes: number;
  venta: number;
  kg: number;
  margen: number;
  margen_pct: number;
}
interface ApiResponse {
  meses: { mes: number; label: string }[];
  clientes: { name: string; monthly: MonthlyCell[] }[];
}

interface Props {
  /** Año en curso (ej. 2026). Se comparan year-2, year-1, year. */
  year: number;
  /** Mes tope del año en curso (los años cerrados van a 12). */
  month: number;
  territorios: string[] | null;
  /** Items visibles (nombres de la dimensión activa) a agregar. */
  clientes: string[];
  mode: "pesos" | "kg";
  dim?: "cliente" | "sku";
}

type YearAgg = Map<number, { venta: number; kg: number; margen: number }>;

export function ClientesTresAniosChart({
  year,
  month,
  territorios,
  clientes,
  mode,
  dim = "cliente",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byYear, setByYear] = useState<Record<number, ApiResponse> | null>(null);

  const years = [year - 2, year - 1, year];
  const territoriosKey =
    territorios === null ? "__ALL__" : territorios.slice().sort().join("|");
  const clientesKey = clientes.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    if (clientes.length === 0) {
      setByYear({});
      return;
    }
    setLoading(true);
    setError(null);

    const fetchYear = (y: number): Promise<[number, ApiResponse]> => {
      const params = new URLSearchParams();
      params.set("year", String(y));
      params.set("month", String(y === year ? month : 12));
      params.set("dim", dim);
      params.set("items", clientes.join(","));
      if (territorios !== null) params.set("territorios", territorios.join(","));
      return fetch(`/api/dashboard/clientes-evolution?${params.toString()}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json: ApiResponse) => [y, json] as [number, ApiResponse]);
    };

    Promise.all(years.map(fetchYear))
      .then((entries) => {
        if (!cancelled) setByYear(Object.fromEntries(entries));
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
  }, [year, month, territoriosKey, clientesKey, dim]);

  const isKg = mode === "kg";
  const barTitle = isKg ? "Kilos" : "Venta";

  const chartData = useMemo(() => {
    if (!byYear) return [];
    const aggYear = (resp?: ApiResponse): YearAgg => {
      const m: YearAgg = new Map();
      if (!resp) return m;
      for (const c of resp.clientes) {
        for (const cell of c.monthly) {
          const cur = m.get(cell.mes) ?? { venta: 0, kg: 0, margen: 0 };
          cur.venta += cell.venta;
          cur.kg += cell.kg;
          cur.margen += cell.margen;
          m.set(cell.mes, cur);
        }
      }
      return m;
    };
    const a = [aggYear(byYear[year - 2]), aggYear(byYear[year - 1]), aggYear(byYear[year])];
    const vol = (agg: YearAgg, mes: number): number | null => {
      const v = agg.get(mes);
      if (!v) return null;
      return isKg ? v.kg : v.venta;
    };
    const mp = (agg: YearAgg, mes: number): number | null => {
      const v = agg.get(mes);
      if (!v || v.venta <= 0) return null;
      return (v.margen / v.venta) * 100;
    };
    return MONTHS.map((label, i) => {
      const mes = i + 1;
      return {
        month: label,
        vol24: vol(a[0], mes),
        vol25: vol(a[1], mes),
        vol26: vol(a[2], mes),
        margenPct24: mp(a[0], mes),
        margenPct25: mp(a[1], mes),
        margenPct26: mp(a[2], mes),
      };
    });
  }, [byYear, isKg, year]);

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: "var(--accent)" }} />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
        Error cargando comparativo 3 años: {error}
      </p>
    );
  }
  if (clientes.length === 0 || chartData.length === 0) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Sin datos para comparar.
      </p>
    );
  }

  const yLeftFormatter = isKg ? formatKilos : formatMoney;

  return (
    <div>
      <ResponsiveContainer width="100%" height={480}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 60, bottom: 5, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => yLeftFormatter(Number(v))}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, "auto"]}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          />
          <Tooltip content={<TresAniosTooltip isKg={isKg} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend
            verticalAlign="top"
            align="center"
            height={32}
            wrapperStyle={{ paddingBottom: 4 }}
            content={() => (
              <ChartLegend
                sections={[
                  {
                    title: barTitle,
                    visualKind: "barras",
                    items: [
                      { label: "2024", color: BAR_24, type: "bar" },
                      { label: "2025", color: BAR_25, type: "bar" },
                      { label: "2026", color: BAR_26, type: "bar" },
                    ],
                  },
                  {
                    title: "Margen %",
                    visualKind: "líneas",
                    items: [
                      { label: "2024", color: LINE_24, type: "line-dashed" },
                      { label: "2025", color: LINE_25, type: "line-dashed" },
                      { label: "2026", color: LINE_26, type: "line-dashed" },
                    ],
                  },
                ]}
              />
            )}
          />
          <Bar yAxisId="left" dataKey="vol24" name={`${barTitle} 2024`} fill={BAR_24} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="vol25" name={`${barTitle} 2025`} fill={BAR_25} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="vol26" name={`${barTitle} 2026`} fill={BAR_26} radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="margenPct24" name="Margen% 2024" stroke={LINE_24} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2.5, strokeWidth: 1, fill: "white" }} connectNulls={false} />
          <Line yAxisId="right" type="monotone" dataKey="margenPct25" name="Margen% 2025" stroke={LINE_25} strokeWidth={2} dot={{ r: 3, strokeWidth: 1, fill: "white" }} connectNulls={false} />
          <Line yAxisId="right" type="monotone" dataKey="margenPct26" name="Margen% 2026" stroke={LINE_26} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 1, fill: "white" }} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== Tooltip homologado con el del tab Ventas =====
interface TooltipEntry {
  name?: string;
  value?: number | string | null;
  color?: string;
  payload?: Record<string, number | string | null>;
}

function TresAniosTooltip({
  active,
  payload,
  label,
  isKg = false,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  isKg?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const monthIdx = MONTHS.indexOf(label ?? "");
  const monthLong = monthIdx >= 0 ? MONTHS_LONG[monthIdx] : (label ?? "");
  const row = payload[0]?.payload;
  const num = (key: string): number | null => {
    if (!row) return null;
    const v = row[key];
    return typeof v === "number" ? v : null;
  };

  const v25 = num("vol25");
  const v26 = num("vol26");
  const yoyDelta = v25 != null && v25 > 0 && v26 != null ? ((v26 - v25) / v25) * 100 : null;

  const fmtValue = (v: number) => (isKg ? formatKilos(v) : formatMoney(v));
  const sectionTitle = isKg ? "Kilos" : "Venta";
  const volRows = [
    { label: "2024", color: BAR_24, key: "vol24" },
    { label: "2025", color: BAR_25, key: "vol25" },
    { label: "2026", color: BAR_26, key: "vol26" },
  ];
  const mpRows = [
    { label: "2024", color: LINE_24, key: "margenPct24" },
    { label: "2025", color: LINE_25, key: "margenPct25" },
    { label: "2026", color: LINE_26, key: "margenPct26" },
  ];

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border text-xs tabular-nums shadow-lg"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
        minWidth: 220,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="flex items-baseline justify-between gap-3 px-3 py-2"
        style={{ background: "var(--bg-surface-muted)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          {monthLong}
        </span>
        {yoyDelta != null && (
          <span
            className="text-[10px] font-semibold"
            style={{ color: yoyDelta >= 0 ? "var(--success)" : "var(--danger)" }}
          >
            {yoyDelta >= 0 ? "▲" : "▼"} {Math.abs(yoyDelta).toFixed(1)}% vs &apos;25
          </span>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {sectionTitle}
        </div>
        {volRows.map((r) => {
          const v = num(r.key);
          if (v == null) return null;
          return <TooltipRow key={r.label} color={r.color} label={r.label} value={fmtValue(v)} />;
        })}
      </div>

      <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Margen %
        </div>
        {mpRows.map((r) => {
          const v = num(r.key);
          return (
            <TooltipRow key={r.label} color={r.color} label={r.label} value={v != null ? `${v.toFixed(1)}%` : "—"} />
          );
        })}
      </div>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </span>
      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
