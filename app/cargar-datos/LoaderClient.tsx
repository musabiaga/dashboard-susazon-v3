"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

interface LastSync {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  rows_imported: number | null;
  source: string;
  errors: unknown[] | null;
}

interface RefreshResult {
  sync_id: string;
  status: "success" | "partial" | "failed";
  months_processed: number;
  rows_imported: number;
  errors: Array<{ month: string; error: string }>;
}

interface Props {
  initialLastSync: LastSync | null;
  initialTotalRows: number;
}

export function LoaderClient({ initialLastSync, initialTotalRows }: Props) {
  const router = useRouter();

  // Por defecto, últimos 3 meses
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const [dateFrom, setDateFrom] = useState(fmt(threeMonthsAgo));
  const [dateTo, setDateTo] = useState(fmt(now));

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState(initialLastSync);
  const [totalRows, setTotalRows] = useState(initialTotalRows);

  async function handleRefresh() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/data/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setRunning(false);
        return;
      }

      setResult(json as RefreshResult);
      setLastSync({
        id: json.sync_id,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: json.status,
        rows_imported: json.rows_imported,
        source: "susazon_api",
        errors: json.errors,
      });
      setTotalRows((prev) => prev + json.rows_imported);
      setRunning(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Card 1: Estado actual */}
      <div
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-3">
          <Database
            size={20}
            style={{ color: "var(--accent)" }}
          />
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Estado actual
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat
            label="Filas en base de datos (visibles)"
            value={totalRows.toLocaleString("es-MX")}
          />
          <Stat
            label="Última sincronización"
            value={lastSync ? formatDateTime(lastSync.completed_at ?? lastSync.started_at) : "Nunca"}
            sublabel={
              lastSync
                ? `${lastSync.rows_imported?.toLocaleString("es-MX") ?? 0} filas · ${statusLabel(lastSync.status)}`
                : "Aún no se ha cargado data"
            }
            tone={
              lastSync?.status === "success"
                ? "success"
                : lastSync?.status === "failed"
                ? "danger"
                : lastSync?.status === "partial"
                ? "warning"
                : "neutral"
            }
          />
        </div>
      </div>

      {/* Card 2: Refrescar */}
      <div
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-3">
          <RefreshCw
            size={20}
            style={{ color: "var(--accent)" }}
          />
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Refrescar desde API Susazón
          </h2>
        </div>

        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          Selecciona el rango de meses a importar. Cada mes hace un POST a la
          API y guarda las filas con kg &gt; 0 en <code>sales_rows</code>.
          Tarda ~5–30 segundos por mes según volumen.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DateField
            label="Desde (mes)"
            value={dateFrom}
            onChange={setDateFrom}
          />
          <DateField
            label="Hasta (mes)"
            value={dateTo}
            onChange={setDateTo}
          />
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={running}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60 sm:w-auto"
          style={{
            background: running ? "var(--accent-hover)" : "var(--accent)",
          }}
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Importando datos…
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Iniciar refresh
              <ArrowRight size={14} />
            </>
          )}
        </button>

        {running && (
          <p
            className="mt-3 text-xs italic"
            style={{ color: "var(--text-muted)" }}
          >
            Procesando — no cierres esta pestaña. Cada mes son ~5–30s. Total
            estimado: {monthsBetween(dateFrom, dateTo)} mes(es).
          </p>
        )}

        {result && (
          <ResultPanel result={result} />
        )}

        {error && (
          <div
            className="mt-4 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
            style={{
              background: "var(--danger-soft)",
              borderColor: "var(--danger)",
              color: "var(--danger)",
            }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Card 3: navegación */}
      <div
        className="rounded-[var(--radius)] p-4 text-sm"
        style={{
          background: "var(--bg-surface-muted)",
          color: "var(--text-secondary)",
        }}
      >
        Cuando termines de cargar datos, ve al{" "}
        <a
          href="/dashboard"
          className="font-medium hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Dashboard →
        </a>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const colorMap = {
    neutral: "var(--text-primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
  };
  return (
    <div
      className="rounded-[var(--radius)] p-3"
      style={{ background: "var(--bg-surface-muted)" }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-xl font-semibold"
        style={{ color: colorMap[tone] }}
      >
        {value}
      </div>
      {sublabel && (
        <div
          className="mt-0.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-[10px] font-medium uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      <div className="relative">
        <Calendar
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min="2024-01"
          className="w-full rounded-[var(--radius)] border bg-transparent px-3 py-2 pl-9 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: RefreshResult }) {
  const isSuccess = result.status === "success";
  const isPartial = result.status === "partial";

  const tone = isSuccess
    ? { bg: "var(--success-soft)", border: "var(--success)", icon: <CheckCircle2 size={16} /> }
    : isPartial
    ? { bg: "var(--warning-soft)", border: "var(--warning)", icon: <AlertCircle size={16} /> }
    : { bg: "var(--danger-soft)", border: "var(--danger)", icon: <AlertCircle size={16} /> };

  return (
    <div
      className="mt-4 rounded-[var(--radius)] border px-3 py-3 text-xs"
      style={{
        background: tone.bg,
        borderColor: tone.border,
        color: "var(--text-primary)",
      }}
    >
      <div className="flex items-center gap-2 font-medium">
        {tone.icon}
        <span>
          {isSuccess
            ? "Refresh exitoso"
            : isPartial
            ? "Refresh parcial — algunos meses fallaron"
            : "Refresh falló"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        <span>Meses procesados:</span>
        <span className="font-semibold">{result.months_processed}</span>
        <span>Filas importadas:</span>
        <span className="font-semibold">{result.rows_imported.toLocaleString("es-MX")}</span>
      </div>
      {result.errors.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer">
            Ver {result.errors.length} error(es)
          </summary>
          <ul className="mt-1 list-disc pl-4">
            {result.errors.map((e, i) => (
              <li key={i}>
                <strong>{e.month}:</strong> {e.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function statusLabel(s: string): string {
  return (
    {
      success: "OK",
      partial: "Parcial",
      failed: "Falló",
      running: "En progreso",
    }[s] ?? s
  );
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}
