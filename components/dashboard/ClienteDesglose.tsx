"use client";

/**
 * ClienteDesglose — desglose expandible de un CLIENTE por SKU. Se renderiza
 * dentro de una fila expandida de la tabla del tab "Clientes y Productos"
 * cuando la dimensión de la tabla es Clientes y la vista es "Año vs Año".
 *
 * Carga lazy desde /api/dashboard/cliente-desglose al expandir el cliente y
 * delega el render en DesgloseYoYTable (Mejora 2, V4.3): comparación de 3 años
 * al-día por SKU, idéntica al encabezado del cliente. (Antes agrupaba por
 * grupo→SKU con solo el periodo actual.) Respeta RLS.
 */

import { useEffect, useState } from "react";
import {
  DesgloseYoYTable,
  type DesgloseYoYRow,
} from "@/components/dashboard/DesgloseYoYTable";

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
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
  showKg?: boolean;
}

export function ClienteDesglose({
  cliente,
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
    params.set("cliente", cliente);
    if (context.territorios !== null)
      params.set("territorios", context.territorios.join(","));

    fetch(`/api/dashboard/cliente-desglose?${params.toString()}`)
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
  }, [cliente, context.year, context.month, context.daysCurrent, territoriosKey]);

  return (
    <DesgloseYoYTable
      rows={rows}
      loading={loading}
      error={error}
      title={`Productos que compra · ${cliente} · al día`}
      entityLabel="SKU"
      emptyLabel="Sin facturación en el periodo."
      colSpan={colSpan}
      monthLabel24={monthLabel24}
      monthLabel25={monthLabel25}
      monthLabel26={monthLabel26}
      showKg={showKg}
    />
  );
}
