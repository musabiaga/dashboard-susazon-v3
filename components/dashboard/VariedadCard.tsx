"use client";

/**
 * VariedadCard — card "Variedad (SKUs vendidos)" del tab Tracking Diario
 * (Fase 10). Ocupa 2 columnas del grid de stats.
 *
 * Muestra:
 *   - Principal: # de SKUs distintos vendidos este mes (al-día).
 *   - Mini-grid 2×2 secundario:
 *       · vs mismo mes año anterior (Δ% al mismo día hábil)
 *       · vs promedio mensual de los últimos 90 días (Δ%)
 *       · SKUs promedio por cliente
 *       · SKUs promedio por vendedor
 *
 * Carga lazy desde /api/dashboard/tracking-variedad. Respeta territorios
 * (RLS) y el día de corte. Es un conteo → idéntico en vista Pesos y Kilos.
 */

import { useEffect, useState } from "react";
import { Loader2, Boxes } from "lucide-react";

interface VariedadData {
  skusMes: number;
  prevYear: { count: number; label: string };
  prom90d: { avg: number | null; months: number };
  promPorCliente: number;
  promPorVendedor: number;
}

interface Props {
  year: number;
  month: number;
  /** Día de corte del mes (al-día). */
  daysCurrent: number;
  /** Territorios efectivos: null=todos, []=ninguno, [...]=subset. */
  territorios: string[] | null;
}

export function VariedadCard({ year, month, daysCurrent, territorios }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VariedadData | null>(null);
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

    fetch(`/api/dashboard/tracking-variedad?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: VariedadData) => {
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

  // Δ% helper
  const pct = (cur: number, ref: number | null): number | null =>
    ref != null && ref > 0 ? ((cur - ref) / ref) * 100 : null;

  const yoyPct = data ? pct(data.skusMes, data.prevYear.count) : null;
  const p90Pct = data ? pct(data.skusMes, data.prom90d.avg) : null;

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
        <Boxes size={12} style={{ color: "var(--accent)" }} />
        Variedad (SKUs vendidos)
      </div>

      {loading ? (
        <div className="flex h-[68px] items-center">
          <Loader2 className="animate-spin" size={20} style={{ color: "var(--accent)" }} />
        </div>
      ) : error || !data ? (
        <div className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Sin data de variedad.
        </div>
      ) : (
        <div className="mt-1.5 flex items-start gap-4">
          {/* Principal */}
          <div className="shrink-0">
            <div className="flex items-baseline gap-1 tabular-nums">
              <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {data.skusMes.toLocaleString("es-MX")}
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                SKUs
              </span>
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              vendidos al-día
            </div>
          </div>

          {/* Mini-grid 2×2 secundario */}
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <Mini
              label={`vs ${data.prevYear.label}`}
              delta={yoyPct}
              ref={data.prevYear.count}
            />
            <Mini
              label="vs prom. 90d"
              delta={p90Pct}
              ref={data.prom90d.avg}
            />
            <MiniAbs label="SKUs / cliente" value={data.promPorCliente} />
            <MiniAbs label="SKUs / vendedor" value={data.promPorVendedor} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Mini métrica comparativa: Δ% con color + valor de referencia. */
function Mini({
  label,
  delta,
  ref,
}: {
  label: string;
  delta: number | null;
  ref: number | null;
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
        {ref != null && (
          <span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>
            ({Math.round(ref).toLocaleString("es-MX")})
          </span>
        )}
      </div>
    </div>
  );
}

/** Mini métrica absoluta (promedio). */
function MiniAbs({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
        {value.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </div>
    </div>
  );
}
