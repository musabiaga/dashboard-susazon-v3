"use client";

/**
 * MesesHistTable — vista "Meses Hist." (Mejora 3, V4.3): matriz Años × Meses.
 * Réplica de "Meses {año}" pero comparando TODOS los años en registro
 * (2024/2025/2026) mes-a-mes. Cada entidad (cliente o SKU) muestra una fila
 * con el total de los años por mes; al expandirla aparece una sub-fila por año
 * (× 12 meses) para comparar el mismo mes entre años leyendo una columna.
 *
 * Celda = venta o kg según el toggle Pesos/Kilos. Sombreado tipo heatmap por
 * intensidad (relativo al máximo de cada entidad). Carga lazy desde
 * /api/dashboard/dim-mensual-multianio. Respeta territorio/agrupador/RLS.
 */

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";
import type { TableViewsContext } from "@/components/dashboard/ClientesTableViews";

interface YearCells {
  venta: number[];
  kg: number[];
}
interface Entity {
  name: string;
  byYear: Record<string, YearCells>;
  total: YearCells;
}
interface Response {
  years: number[];
  meses: { mes: number; label: string }[];
  entities: Entity[];
}

interface Props {
  clientes: string[];
  context: Omit<TableViewsContext, "currentByClient">;
  mode: "pesos" | "kg";
  dimensionLabel: string;
  dim: "cliente" | "sku";
  agrupadorId: string | null;
}

export function MesesHistTable({
  clientes,
  context,
  mode,
  dimensionLabel,
  dim,
  agrupadorId,
}: Props) {
  const isKg = mode === "kg";
  const fmt = isKg ? formatKilos : formatMoney;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const territoriosKey =
    context.territorios === null
      ? "__ALL__"
      : context.territorios.slice().sort().join("|");
  const clientesKey = clientes.slice().sort().join("|");
  const scopeKey = `${dim}|${territoriosKey}|${agrupadorId ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    if (clientes.length === 0) {
      setData({ years: [], meses: [], entities: [] });
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("dim", dim);
    params.set("items", clientes.join(","));
    if (context.territorios !== null)
      params.set("territorios", context.territorios.join(","));
    if (agrupadorId) params.set("agrupador", agrupadorId);

    fetch(`/api/dashboard/dim-mensual-multianio?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: Response) => {
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
  }, [dim, clientesKey, territoriosKey, agrupadorId]);

  // Cerrar expandidos al cambiar el scope.
  useEffect(() => {
    setExpanded(new Set());
  }, [scopeKey]);

  const years = data?.years ?? [];
  const meses = data?.meses ?? [];

  // Ordenar entidades preservando el orden que ya trae el endpoint (venta 3
  // años desc). Filtramos por si el fetch trae más/menos que el top.
  const entities = data?.entities ?? [];

  const cellsOf = (yc: YearCells) => (isKg ? yc.kg : yc.venta);

  function toggle(name: string) {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin" size={22} style={{ color: "var(--accent)" }} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--danger)" }}>
        Error: {error}
      </div>
    );
  }
  if (entities.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Sin datos para el periodo.
      </div>
    );
  }

  return (
    <>
      <div
        className="border-b px-3 py-1.5 text-[10px] uppercase tracking-wider"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-surface-muted)",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>
          ⓘ Matriz Años × Meses
        </span>
        <span className="ml-2">
          (expande una fila para comparar {years.join(" / ")} mes-a-mes · cierre de cada mes)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] tabular-nums">
          <thead>
            <tr style={{ background: "var(--bg-surface-muted)", color: "var(--text-muted)" }}>
              <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                {dimensionLabel}
              </th>
              {meses.map((m) => (
                <th
                  key={m.mes}
                  className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider"
                >
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e, idx) => {
              const isOpen = expanded.has(e.name);
              const totalCells = cellsOf(e.total);
              const grand = totalCells.reduce((a, b) => a + b, 0);
              // Escala del heatmap: máximo entre las celdas por-año de la
              // entidad (las que se comparan al expandir).
              let maxCell = 0;
              for (const y of years) {
                const yc = e.byYear[String(y)];
                if (!yc) continue;
                for (const v of cellsOf(yc)) if (v > maxCell) maxCell = v;
              }
              return (
                <RowGroup
                  key={e.name}
                  entity={e}
                  idx={idx}
                  isOpen={isOpen}
                  onToggle={() => toggle(e.name)}
                  years={years}
                  totalCells={totalCells}
                  grand={grand}
                  maxCell={maxCell}
                  cellsOf={cellsOf}
                  fmt={fmt}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Renderiza la fila de la entidad (total 3 años por mes) + sub-filas por año. */
function RowGroup({
  entity,
  idx,
  isOpen,
  onToggle,
  years,
  totalCells,
  grand,
  maxCell,
  cellsOf,
  fmt,
}: {
  entity: Entity;
  idx: number;
  isOpen: boolean;
  onToggle: () => void;
  years: number[];
  totalCells: number[];
  grand: number;
  maxCell: number;
  cellsOf: (yc: YearCells) => number[];
  fmt: (n: number) => string;
}) {
  const bg = idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-muted)";
  return (
    <>
      {/* Fila cabecera de la entidad: total de los años por mes */}
      <tr style={{ background: bg }}>
        <td className="px-3 py-1.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-left"
            style={{ color: "var(--text-primary)", fontWeight: 600 }}
            title="Comparar años mes-a-mes"
          >
            {isOpen ? (
              <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
            ) : (
              <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} />
            )}
            {entity.name}
          </button>
        </td>
        {totalCells.map((v, i) => (
          <td
            key={i}
            className="px-2 py-1.5 text-right"
            style={{ color: v > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}
          >
            {v > 0 ? fmt(v) : "—"}
          </td>
        ))}
        <td
          className="px-3 py-1.5 text-right font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {fmt(grand)}
        </td>
      </tr>
      {/* Sub-filas por año */}
      {isOpen &&
        years.map((y) => {
          const yc = entity.byYear[String(y)];
          const cells = yc ? cellsOf(yc) : new Array(12).fill(0);
          const yearTotal = cells.reduce((a, b) => a + b, 0);
          return (
            <tr key={y} style={{ background: "var(--bg-surface-muted)" }}>
              <td
                className="py-1 pl-8 pr-2 text-xs"
                style={{ color: "var(--text-secondary)", fontWeight: 600 }}
              >
                {y}
              </td>
              {cells.map((v, i) => (
                <td
                  key={i}
                  className="px-2 py-1 text-right text-xs"
                  style={
                    v > 0
                      ? { background: heat(v, maxCell), color: "var(--text-primary)" }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {v > 0 ? fmt(v) : "—"}
                </td>
              ))}
              <td
                className="px-3 py-1 text-right text-xs font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {fmt(yearTotal)}
              </td>
            </tr>
          );
        })}
    </>
  );
}

/** Sombreado heatmap: alpha proporcional a v/max sobre el color de acento. */
function heat(v: number, max: number): string {
  if (max <= 0 || v <= 0) return "transparent";
  const alpha = 0.06 + 0.34 * Math.min(1, v / max);
  return `rgba(16, 185, 129, ${alpha.toFixed(3)})`;
}
