"use client";

/**
 * ProductoDesglose — desglose expandible de un SKU por CLIENTE (decisión B,
 * simétrico a ClienteDesglose). Se renderiza dentro de una fila expandida de
 * la tabla del tab "Clientes y Productos" cuando la dimensión de la tabla es
 * Productos (SKU) y la vista es "Año vs Año".
 *
 * Carga lazy desde /api/dashboard/clientes-por-producto (reutilizado) al
 * expandir el SKU. Muestra los clientes que compran ese SKU, valores al-día,
 * ordenados por venta. Respeta territorios (RLS).
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

interface ClienteRow {
  name: string;
  v26: number;
  v26_alDia?: number;
  k26?: number;
  k26_alDia?: number;
  m26?: number;
  m26_alDia?: number;
}

interface Props {
  sku: string;
  context: {
    year: number;
    month: number;
    daysCurrent: number;
    territorios: string[] | null;
  };
  /** Para colspan: cuántas columnas tiene la tabla padre. */
  colSpan: number;
}

export function ProductoDesglose({ sku, context, colSpan }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ClienteRow[]>([]);

  const territoriosKey =
    context.territorios === null
      ? "__ALL__"
      : context.territorios.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("year", String(context.year));
    params.set("month", String(context.month));
    params.set("daysCurrent", String(context.daysCurrent));
    params.set("skus", sku);
    params.set("topN", "200");
    if (context.territorios !== null)
      params.set("territorios", context.territorios.join(","));

    fetch(`/api/dashboard/clientes-por-producto?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { rows?: ClienteRow[] }) => {
        if (!cancelled) setRows(json.rows ?? []);
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
  }, [sku, context.year, context.month, context.daysCurrent, territoriosKey]);

  // El endpoint ordena por cierre (v26); re-ordenamos por venta al-día desc
  // para que coincida con los valores que mostramos.
  const sorted = [...rows].sort(
    (a, b) => (b.v26_alDia ?? b.v26 ?? 0) - (a.v26_alDia ?? a.v26 ?? 0)
  );

  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{ padding: 0, background: "var(--bg-surface-muted)" }}
      >
        <div className="px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2
                className="animate-spin"
                size={20}
                style={{ color: "var(--accent)" }}
              />
            </div>
          ) : error ? (
            <p
              className="py-3 text-center text-sm"
              style={{ color: "var(--danger)" }}
            >
              Error: {error}
            </p>
          ) : sorted.length === 0 ? (
            <p
              className="py-3 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Sin clientes para este SKU en el periodo.
            </p>
          ) : (
            <div
              className="overflow-hidden rounded-[var(--radius)] border"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-surface)",
              }}
            >
              <div
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--bg-surface-muted)",
                  color: "var(--text-secondary)",
                }}
              >
                Clientes que compran · {sku} · al día ({sorted.length})
              </div>
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                      Venta
                    </th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                      KG
                    </th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                      Margen $
                    </th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                      Margen %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, i) => {
                    const venta = c.v26_alDia ?? c.v26 ?? 0;
                    const kg = c.k26_alDia ?? c.k26 ?? 0;
                    const margen = c.m26_alDia ?? c.m26 ?? 0;
                    const mgPct = venta > 0 ? (margen / venta) * 100 : null;
                    return (
                      <tr
                        key={c.name + i}
                        className="border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td
                          className="px-3 py-1.5"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {c.name}
                        </td>
                        <td
                          className="px-3 py-1.5 text-right"
                          style={{ fontWeight: 600 }}
                        >
                          {formatMoney(venta)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {formatKilos(kg)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {formatMoney(margen)}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {mgPct == null ? "—" : `${mgPct.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
