"use client";

/**
 * ProductoDesglose — desglose expandible de un SKU por CLIENTE. Se renderiza
 * dentro de una fila expandida de la tabla del tab "Clientes y Productos"
 * cuando la dimensión de la tabla es Productos (SKU) y la vista es "Año vs Año".
 *
 * Carga lazy desde /api/dashboard/clientes-por-producto al expandir el SKU y
 * delega el render en DesgloseYoYTable (Mejora 2, V4.3): comparación de 3 años
 * al-día por cliente, idéntica al encabezado del producto. Respeta RLS.
 */

import { useEffect, useState } from "react";
import {
  DesgloseYoYTable,
  type DesgloseYoYRow,
} from "@/components/dashboard/DesgloseYoYTable";

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
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
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
  const [rows, setRows] = useState<DesgloseYoYRow[]>([]);

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
      .then((json: { rows?: DesgloseYoYRow[] }) => {
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

  return (
    <DesgloseYoYTable
      rows={rows}
      loading={loading}
      error={error}
      title={`Clientes que compran · ${sku} · al día`}
      entityLabel="Cliente"
      emptyLabel="Sin clientes para este SKU en el periodo."
      colSpan={colSpan}
      monthLabel24={monthLabel24}
      monthLabel25={monthLabel25}
      monthLabel26={monthLabel26}
      showKg={showKg}
    />
  );
}
