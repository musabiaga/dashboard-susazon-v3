"use client";

/**
 * ClientesActivosCard — card "Clientes activos" del tab Tracking Diario
 * (Fase 10). Gemelo del VariedadCard. Ocupa 2 columnas del grid.
 *
 * Muestra:
 *   - Principal: # de clientes distintos (no_cliente) con compra este mes al-día.
 *   - Mini-grid 2×2 secundario:
 *       · vs mismo mes año anterior (Δ% al mismo día hábil)
 *       · vs promedio mensual de los últimos 90 días (Δ%)
 *       · Clientes promedio por vendedor (cartera activa)
 *       · Ticket promedio por cliente ($ venta ÷ clientes)
 *
 * Carga lazy desde /api/dashboard/tracking-clientes-activos. Respeta
 * territorios (RLS) y el día de corte. Idéntico en vista Pesos y Kilos.
 */

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface ClientesActivosData {
  clientesActivos: number;
  prevYear: { count: number; label: string };
  prom90d: { avg: number | null; months: number };
  clientesPorVendedor: number;
  ticketPromedio: number;
}

interface Props {
  year: number;
  month: number;
  daysCurrent: number;
  territorios: string[] | null;
}

export function ClientesActivosCard({ year, month, daysCurrent, territorios }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClientesActivosData | null>(null);
  const [error, setError] = useState(false);

  const territoriosKey =
    territorios === null ? "__ALL__" : territorios.slice().sort().join("|");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    params.set("daysCurrent", String(daysCurrent));
    if (territorios !== null) params.set("territorios", territorios.join(","));

    fetch(`/api/dashboard/tracking-clientes-activos?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ClientesActivosData) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, daysCurrent, territoriosKey]);

  const pct = (cur: number, ref: number | null): number | null =>
    ref != null && ref > 0 ? ((cur - ref) / ref) * 100 : null;

  const yoyPct = data ? pct(data.clientesActivos, data.prevYear.count) : null;
  const p90Pct = data ? pct(data.clientesActivos, data.prom90d.avg) : null;

  return (
    <div
      className="col-span-2 rounded-[var(--radius-lg)] border px-4 py-3"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        <Users size={12} style={{ color: "var(--accent)" }} />
        Clientes activos
      </div>

      {loading ? (
        <div className="flex h-[68px] items-center">
          <Loader2 className="animate-spin" size={20} style={{ color: "var(--accent)" }} />
        </div>
      ) : error || !data ? (
        <div className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Sin data de clientes.
        </div>
      ) : (
        <div className="mt-1.5 flex items-start gap-4">
          {/* Principal */}
          <div className="shrink-0">
            <div className="flex items-baseline gap-1 tabular-nums">
              <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {data.clientesActivos.toLocaleString("es-MX")}
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                clientes
              </span>
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              con compra al-día
            </div>
          </div>

          {/* Mini-grid 2×2 secundario */}
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <Mini
              label={`vs ${data.prevYear.label}`}
              delta={yoyPct}
              reference={data.prevYear.count}
            />
            <Mini
              label="vs prom. 90d"
              delta={p90Pct}
              reference={data.prom90d.avg}
            />
            <MiniAbs
              label="Clientes / vendedor"
              value={data.clientesPorVendedor.toLocaleString("es-MX", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            />
            <MiniAbs
              label="Ticket prom. / cliente"
              value={formatMoney(data.ticketPromedio)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  delta,
  reference,
}: {
  label: string;
  delta: number | null;
  reference: number | null;
}) {
  const tone =
    delta == null
      ? "var(--text-muted)"
      : delta >= 0
        ? "var(--success)"
        : "var(--danger)";
  return (
    <div>
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="tabular-nums" style={{ color: tone, fontWeight: 600 }}>
        {delta == null
          ? "—"
          : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%`}
        {reference != null && (
          <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
            ({Math.round(reference).toLocaleString("es-MX")})
          </span>
        )}
      </div>
    </div>
  );
}

function MiniAbs({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
