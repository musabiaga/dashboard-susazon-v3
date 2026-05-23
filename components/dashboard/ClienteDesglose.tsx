"use client";

/**
 * ClienteDesglose — desglose expandible de un cliente por GRUPO de producto,
 * con sub-expansión a SKU (Mejora 5). Se renderiza dentro de una fila
 * expandida de la tabla del tab Clientes.
 *
 * Carga lazy desde /api/dashboard/cliente-desglose al montarse (cuando el
 * usuario expande el cliente). Periodo al-día. Respeta territorios (RLS).
 */

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { formatMoney, formatKilos } from "@/lib/format";

interface SkuRow {
  sku: string;
  venta: number;
  kg: number;
  margen: number;
  margen_pct: number;
}
interface GrupoRow {
  grupo: string;
  venta: number;
  kg: number;
  margen: number;
  margen_pct: number;
  skus: SkuRow[];
}

interface Props {
  cliente: string;
  context: {
    year: number;
    month: number;
    daysCurrent: number;
    territorios: string[] | null;
  };
  /** Para colspan: cuántas columnas tiene la tabla padre. */
  colSpan: number;
}

export function ClienteDesglose({ cliente, context, colSpan }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
    params.set("cliente", cliente);
    if (context.territorios !== null)
      params.set("territorios", context.territorios.join(","));

    fetch(`/api/dashboard/cliente-desglose?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { grupos?: GrupoRow[] }) => {
        if (!cancelled) setGrupos(json.grupos ?? []);
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
  }, [cliente, context.year, context.month, context.daysCurrent, territoriosKey]);

  const toggleGroup = (grupo: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(grupo)) next.delete(grupo);
      else next.add(grupo);
      return next;
    });
  };

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, background: "var(--bg-surface-muted)" }}>
        <div className="px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="animate-spin" size={20} style={{ color: "var(--accent)" }} />
            </div>
          ) : error ? (
            <p className="py-3 text-center text-sm" style={{ color: "var(--danger)" }}>
              Error: {error}
            </p>
          ) : grupos.length === 0 ? (
            <p className="py-3 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Sin facturación en el periodo.
            </p>
          ) : (
            <div
              className="overflow-hidden rounded-[var(--radius)] border"
              style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
            >
              <div
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--bg-surface-muted)",
                  color: "var(--text-secondary)",
                }}
              >
                Facturación por línea de producto · {cliente} · al día
              </div>
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">
                      Grupo / SKU
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
                  {grupos.map((g) => {
                    const open = expandedGroups.has(g.grupo);
                    return (
                      <GroupRows
                        key={g.grupo}
                        grupo={g}
                        open={open}
                        onToggle={() => toggleGroup(g.grupo)}
                      />
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

function GroupRows({
  grupo,
  open,
  onToggle,
}: {
  grupo: GrupoRow;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t"
        style={{ borderColor: "var(--border)" }}
        onClick={onToggle}
      >
        <td className="px-3 py-1.5">
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {open ? (
              <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
            ) : (
              <ChevronRight size={14} style={{ color: "var(--text-secondary)" }} />
            )}
            {grupo.grupo}
            <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>
              ({grupo.skus.length} SKU{grupo.skus.length === 1 ? "" : "s"})
            </span>
          </span>
        </td>
        <td className="px-3 py-1.5 text-right" style={{ fontWeight: 600 }}>
          {formatMoney(grupo.venta)}
        </td>
        <td className="px-3 py-1.5 text-right">{formatKilos(grupo.kg)}</td>
        <td className="px-3 py-1.5 text-right">{formatMoney(grupo.margen)}</td>
        <td className="px-3 py-1.5 text-right">{grupo.margen_pct.toFixed(1)}%</td>
      </tr>
      {open &&
        grupo.skus.map((s) => (
          <tr
            key={s.sku}
            className="border-t"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface-muted)" }}
          >
            <td className="px-3 py-1 pl-9" style={{ color: "var(--text-secondary)" }}>
              {s.sku}
            </td>
            <td className="px-3 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
              {formatMoney(s.venta)}
            </td>
            <td className="px-3 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
              {formatKilos(s.kg)}
            </td>
            <td className="px-3 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
              {formatMoney(s.margen)}
            </td>
            <td className="px-3 py-1 text-right" style={{ color: "var(--text-secondary)" }}>
              {s.margen_pct.toFixed(1)}%
            </td>
          </tr>
        ))}
    </>
  );
}
