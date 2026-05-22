"use client";

/**
 * ClientesEvolutionChart — vista "Evolución 2026" de la gráfica superior del
 * tab Clientes (Mejora 2).
 *
 * Muestra la evolución MENSUAL (Ene → mes tope) de los clientes visibles:
 *   - Una línea sólida por cliente = venta (o kilos según el toggle), eje izq.
 *   - Una línea punteada por cliente = margen %, eje derecho.
 *
 * Carga lazy desde /api/dashboard/clientes-evolution solo cuando esta vista
 * está activa y cambian los inputs (clientes visibles / territorios / mes).
 */

import { useEffect, useState, useMemo } from "react";
import {
  ComposedChart,
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

// Paleta para distinguir hasta 15 clientes.
const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#d946ef", "#eab308", "#22c55e", "#a855f7",
];

interface MonthlyCell {
  mes: number;
  venta: number;
  kg: number;
  margen: number;
  margen_pct: number;
}
interface ClienteEvolution {
  name: string;
  monthly: MonthlyCell[];
}
interface ApiResponse {
  meses: { mes: number; label: string }[];
  clientes: ClienteEvolution[];
}

interface Props {
  /** Año a graficar (en curso). */
  year: number;
  /** Mes tope (se grafican meses 1..month). */
  month: number;
  /** Territorios efectivos: null=todos, []=ninguno, [...]=subset. */
  territorios: string[] | null;
  /** Nombres de clientes visibles (top N o selección custom). */
  clientes: string[];
  /** "pesos" | "kg" — qué métrica grafica la línea sólida. */
  mode: "pesos" | "kg";
}

export function ClientesEvolutionChart({
  year,
  month,
  territorios,
  clientes,
  mode,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Key estable para refetch (evita loops por identidad de array).
  const territoriosKey =
    territorios === null ? "__ALL__" : territorios.slice().sort().join("|");
  const clientesKey = clientes.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    if (clientes.length === 0) {
      setData({ meses: [], clientes: [] });
      return;
    }
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    params.set("clientes", clientes.join(","));
    if (territorios !== null) params.set("territorios", territorios.join(","));

    fetch(`/api/dashboard/clientes-evolution?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ApiResponse) => {
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
  }, [year, month, territoriosKey, clientesKey, mode]);

  const isKg = mode === "kg";

  // Transformar a formato Recharts: un punto por mes, keys dinámicas por cliente.
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.meses.map((mObj, idx) => {
      const point: Record<string, string | number> = { mesLabel: mObj.label };
      for (const c of data.clientes) {
        const cell = c.monthly[idx];
        if (!cell) continue;
        point[c.name] = isKg ? cell.kg : cell.venta;
        point[`${c.name}__mp`] = cell.margen_pct;
      }
      return point;
    });
  }, [data, isKg]);

  if (loading) {
    return (
      <div className="flex h-[520px] items-center justify-center">
        <Loader2
          className="animate-spin"
          size={28}
          style={{ color: "var(--accent)" }}
        />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
        Error cargando evolución: {error}
      </p>
    );
  }
  if (!data || chartData.length === 0 || data.clientes.length === 0) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Sin data de evolución para los clientes seleccionados.
      </p>
    );
  }

  const valueFormatter = isKg ? formatKilos : formatMoney;

  return (
    <ResponsiveContainer width="100%" height={520}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="mesLabel"
          tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          tickFormatter={(v) => valueFormatter(Number(v))}
          width={70}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--text-muted)" }}
          axisLine={{ stroke: "var(--border)" }}
          tickLine={false}
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
          formatter={(value, name) => {
            const v = Number(value);
            const n = String(name);
            if (n.endsWith("__mp")) {
              return [`${v.toFixed(1)}%`, `Margen % · ${n.replace("__mp", "")}`];
            }
            return [valueFormatter(v), n];
          }}
        />
        {/* Leyenda default — las líneas de margen % tienen legendType="none",
            así que solo aparecen los nombres de cliente (líneas de venta). */}
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {/* Línea sólida (venta/kg) por cliente — eje izquierdo */}
        {data.clientes.map((c, i) => (
          <Line
            key={c.name}
            yAxisId="left"
            type="monotone"
            dataKey={c.name}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
        {/* Línea punteada (margen %) por cliente — eje derecho */}
        {data.clientes.map((c, i) => (
          <Line
            key={`${c.name}__mp`}
            yAxisId="right"
            type="monotone"
            dataKey={`${c.name}__mp`}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls
            legendType="none"
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
