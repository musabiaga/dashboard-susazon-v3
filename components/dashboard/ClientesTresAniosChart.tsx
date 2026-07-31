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
 * Datos: reusa /api/dashboard/clientes-evolution llamándolo 3 veces (uno por
 * año). Los años cerrados van hasta el mes 12; el año en curso hasta `month`.
 * Carga lazy (solo cuando esta vista está activa y cambian los inputs).
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

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// Colores por año, consistentes con el resto del dashboard.
const COL_24 = "#94a3b8"; // gris
const COL_25 = "#3b82f6"; // azul
const COL_26 = "#10b981"; // verde

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
      // Año en curso → hasta `month`; años cerrados → 12 meses completos.
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
        mesLabel: label,
        vol24: vol(a[0], mes),
        vol25: vol(a[1], mes),
        vol26: vol(a[2], mes),
        mp24: mp(a[0], mes),
        mp25: mp(a[1], mes),
        mp26: mp(a[2], mes),
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

  const volFmt = isKg ? formatKilos : formatMoney;
  const y0 = year - 2, y1 = year - 1, y2 = year;
  const yy = (y: number) => `'${String(y % 100).padStart(2, "0")}`;

  return (
    <div>
      <ResponsiveContainer width="100%" height={480}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 60, bottom: 5, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="mesLabel"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => volFmt(Number(v))}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, "auto"]}
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            stroke="var(--border-strong)"
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          />
          <Tooltip
            formatter={(value, name) => {
              if (value == null) return ["—", name as string];
              const isPct = String(name).includes("Margen");
              return [isPct ? `${Number(value).toFixed(1)}%` : volFmt(Number(value)), name as string];
            }}
            contentStyle={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar yAxisId="left" dataKey="vol24" name={`Vol ${yy(y0)}`} fill={COL_24} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="vol25" name={`Vol ${yy(y1)}`} fill={COL_25} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="vol26" name={`Vol ${yy(y2)}`} fill={COL_26} radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="mp24" name={`Margen % ${yy(y0)}`} stroke={COL_24} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          <Line yAxisId="right" type="monotone" dataKey="mp25" name={`Margen % ${yy(y1)}`} stroke={COL_25} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
          <Line yAxisId="right" type="monotone" dataKey="mp26" name={`Margen % ${yy(y2)}`} stroke={COL_26} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
