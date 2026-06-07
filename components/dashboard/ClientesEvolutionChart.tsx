"use client";

/**
 * ClientesEvolutionChart — vista "Evolución {año}" de la gráfica superior del
 * tab Clientes (Mejora 2).
 *
 * Formato consistente con el resto del dashboard: BARRAS de volumen + LÍNEA de
 * margen %. Muestra el AGREGADO de los clientes visibles, mes a mes:
 *   - Barras (eje izq) = volumen total (venta o kilos, según el toggle).
 *   - Línea (eje der)  = margen % del conjunto (margen total / venta total).
 *
 * Carga lazy desde /api/dashboard/clientes-evolution solo cuando esta vista
 * está activa y cambian los inputs (clientes visibles / territorios / mes).
 */

import { useEffect, useState, useMemo } from "react";
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

const BAR_COLOR = "#10b981"; // verde — volumen (consistente con 2026 del dashboard)
const LINE_COLOR = "#f59e0b"; // ámbar — margen % (distinguible de las barras)

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
  /** "pesos" | "kg" — qué métrica grafican las barras. */
  mode: "pesos" | "kg";
  /** (Opcional) SKUs para filtrar la evolución a esos productos (modo
   *  Productos + 1 cliente). Si se omite, usa la venta total del cliente. */
  skus?: string[];
  /** Dimensión de la evolución: "cliente" (default) | "sku". Determina cómo
   *  agrupa el endpoint. La prop `clientes` contiene los nombres de la
   *  dimensión activa. */
  dim?: "cliente" | "sku";
}

export function ClientesEvolutionChart({
  year,
  month,
  territorios,
  clientes,
  mode,
  skus,
  dim = "cliente",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Key estable para refetch (evita loops por identidad de array).
  const territoriosKey =
    territorios === null ? "__ALL__" : territorios.slice().sort().join("|");
  const clientesKey = clientes.slice().sort().join("|");
  const skusKey = (skus ?? []).slice().sort().join("|");

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
    params.set("dim", dim);
    params.set("items", clientes.join(","));
    if (territorios !== null) params.set("territorios", territorios.join(","));
    if (skus && skus.length > 0) params.set("skus", skus.join(","));

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
  }, [year, month, territoriosKey, clientesKey, skusKey, dim]);

  const isKg = mode === "kg";

  // Agregar los clientes visibles por mes → un punto por mes con volumen total
  // y margen % del conjunto (margen total ÷ venta total).
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.meses.map((mObj, idx) => {
      let venta = 0;
      let kg = 0;
      let margen = 0;
      for (const c of data.clientes) {
        const cell = c.monthly[idx];
        if (!cell) continue;
        venta += cell.venta;
        kg += cell.kg;
        margen += cell.margen;
      }
      return {
        mesLabel: mObj.label,
        volumen: isKg ? kg : venta,
        // Margen % del conjunto: siempre sobre venta (no sobre kg).
        margenPct: venta > 0 ? (margen / venta) * 100 : 0,
      };
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
  const volumenLabel = isKg ? "Kilos" : "Venta";

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
            if (n === "Margen %") return [`${v.toFixed(1)}%`, "Margen %"];
            return [valueFormatter(v), volumenLabel];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          yAxisId="left"
          dataKey="volumen"
          name={volumenLabel}
          fill={BAR_COLOR}
          radius={[3, 3, 0, 0]}
          maxBarSize={56}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="margenPct"
          name="Margen %"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
