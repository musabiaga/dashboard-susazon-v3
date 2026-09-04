"use client";

/**
 * ProductoDesglose — desglose expandible de un SKU por CLIENTE (decisión B,
 * simétrico a ClienteDesglose). Se renderiza dentro de una fila expandida de
 * la tabla del tab "Clientes y Productos" cuando la dimensión de la tabla es
 * Productos (SKU) y la vista es "Año vs Año".
 *
 * Carga lazy desde /api/dashboard/clientes-por-producto (reutilizado) al
 * expandir el SKU. Muestra los clientes que compran ese SKU con la MISMA data
 * que el encabezado del producto (Mejora 2, V4.3): comparación de 3 años
 * al-día (venta 24/25/26 + Var%, KG 24/25/26 + Var% KG, Margen $/% + Δpp).
 * Respeta territorios (RLS).
 */

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

interface ClienteRow {
  name: string;
  // Cierre del mes (mes completo) + al-día (mismo día hábil entre años).
  v24?: number; v25?: number; v26?: number;
  k24?: number; k25?: number; k26?: number;
  m24?: number; m25?: number; m26?: number;
  v24_alDia?: number; v25_alDia?: number; v26_alDia?: number;
  k24_alDia?: number; k25_alDia?: number; k26_alDia?: number;
  m24_alDia?: number; m25_alDia?: number; m26_alDia?: number;
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
  /** Etiquetas de mes (Sep 24 / Sep 25 / Sep 26) — mismas que el header. */
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
  /** Si true, muestra las 4 columnas de KG (igual que el header). */
  showKg?: boolean;
}

export function ProductoDesglose({
  sku,
  context,
  colSpan,
  monthLabel24,
  monthLabel25,
  monthLabel26,
  showKg = true,
}: Props) {
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

  // Mostrar SIEMPRE al-día (coherente con el header del producto), con fallback
  // a cierre si el al-día no viene. Ordenar por venta al-día del año actual.
  const computed = rows
    .map((c) => {
      const v24 = c.v24_alDia ?? c.v24 ?? 0;
      const v25 = c.v25_alDia ?? c.v25 ?? 0;
      const v26 = c.v26_alDia ?? c.v26 ?? 0;
      const k24 = c.k24_alDia ?? c.k24 ?? 0;
      const k25 = c.k25_alDia ?? c.k25 ?? 0;
      const k26 = c.k26_alDia ?? c.k26 ?? 0;
      const m26 = c.m26_alDia ?? c.m26 ?? 0;
      const m25 = c.m25_alDia ?? c.m25 ?? 0;
      const varPct = v25 > 0 ? ((v26 - v25) / v25) * 100 : null;
      const varKgPct = k25 > 0 ? ((k26 - k25) / k25) * 100 : null;
      const mgPct26 = v26 > 0 ? (m26 / v26) * 100 : null;
      const mgPct25 = v25 > 0 ? (m25 / v25) * 100 : null;
      const deltaPp =
        mgPct26 != null && mgPct25 != null ? mgPct26 - mgPct25 : null;
      return {
        name: c.name,
        v24, v25, v26, k24, k25, k26, m26,
        varPct, varKgPct, mgPct26, mgPct25, deltaPp,
      };
    })
    .sort((a, b) => b.v26 - a.v26);

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
          ) : computed.length === 0 ? (
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
                Clientes que compran · {sku} · al día ({computed.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] tabular-nums">
                  <thead>
                    <tr style={{ color: "var(--text-muted)" }}>
                      <Th align="left">Cliente</Th>
                      <Th>{monthLabel24}</Th>
                      <Th>{monthLabel25}</Th>
                      <Th>{monthLabel26}</Th>
                      <Th>Var %</Th>
                      {showKg && (
                        <>
                          <Th subtle>{`KG ${monthLabel24}`}</Th>
                          <Th subtle>{`KG ${monthLabel25}`}</Th>
                          <Th subtle>{`KG ${monthLabel26}`}</Th>
                          <Th subtle>Var % KG</Th>
                        </>
                      )}
                      <Th>{`Mg $ ${monthLabel26}`}</Th>
                      <Th>{`Mg % ${monthLabel26}`}</Th>
                      <Th subtle>{`Mg % ${monthLabel25}`}</Th>
                      <Th>Δ pp</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.map((c, i) => (
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
                        <Td>{formatMoney(c.v24)}</Td>
                        <Td>{formatMoney(c.v25)}</Td>
                        <Td>{formatMoney(c.v26)}</Td>
                        <Td color={pctColor(c.varPct)} bold>
                          {fmtPct(c.varPct)}
                        </Td>
                        {showKg && (
                          <>
                            <Td subtle>{formatKilos(c.k24)}</Td>
                            <Td subtle>{formatKilos(c.k25)}</Td>
                            <Td subtle>{formatKilos(c.k26)}</Td>
                            <Td color={pctColor(c.varKgPct)} bold>
                              {fmtPct(c.varKgPct)}
                            </Td>
                          </>
                        )}
                        <Td>{formatMoney(c.m26)}</Td>
                        <Td bold>
                          {c.mgPct26 == null ? "—" : `${c.mgPct26.toFixed(1)}%`}
                        </Td>
                        <Td subtle>
                          {c.mgPct25 == null ? "—" : `${c.mgPct25.toFixed(1)}%`}
                        </Td>
                        <Td color={pctColor(c.deltaPp)} bold>
                          {c.deltaPp == null
                            ? "—"
                            : `${c.deltaPp >= 0 ? "+" : ""}${c.deltaPp.toFixed(1)} pp`}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function pctColor(v: number | null): string {
  if (v == null) return "var(--text-muted)";
  return v >= 0 ? "var(--success)" : "var(--danger)";
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function Th({
  children,
  align = "right",
  subtle = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  subtle?: boolean;
}) {
  return (
    <th
      className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${align === "left" ? "text-left" : "text-right"}`}
      style={subtle ? { color: "var(--text-muted)", opacity: 0.75 } : undefined}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  bold = false,
  subtle = false,
  color,
}: {
  children: ReactNode;
  bold?: boolean;
  subtle?: boolean;
  color?: string;
}) {
  return (
    <td
      className="whitespace-nowrap px-3 py-1.5 text-right"
      style={{
        fontWeight: bold ? 600 : undefined,
        color: color ?? (subtle ? "var(--text-muted)" : "var(--text-secondary)"),
      }}
    >
      {children}
    </td>
  );
}
