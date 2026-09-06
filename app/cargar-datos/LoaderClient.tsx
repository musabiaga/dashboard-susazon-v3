"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  ArrowRight,
  AlertTriangle,
  Clock,
  History,
  Zap,
  User,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

/** Fila de sync_history normalizada por el Server Component. */
export interface SyncRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  rows_imported: number | null;
  source: string;
  errors: unknown[] | null;
  date_from: string | null;
  date_to: string | null;
  /** "cron" = sincronización automática (Vercel Cron); "manual" = botón. */
  trigger: "manual" | "cron";
}

type LastSync = SyncRow;

interface RefreshResult {
  sync_id: string;
  status: "success" | "partial" | "failed";
  sources_processed: string[];
  months_processed: number;
  rows_imported: number;
  errors: Array<{ source: string; month: string; error: string }>;
}

type ApiSource = "susazon" | "suve";

interface Props {
  initialLastSync: LastSync | null;
  initialTotalRows: number;
  /** Últimas 10 corridas (manuales + automáticas), más reciente primero. */
  initialHistory: SyncRow[];
  /** app_settings.sync_auto.enabled */
  syncAutoEnabled: boolean;
  /** true si la env var CRON_SECRET existe en Vercel (solo el booleano). */
  cronSecretConfigured: boolean;
}

export function LoaderClient({
  initialLastSync,
  initialTotalRows,
  initialHistory,
  syncAutoEnabled,
  cronSecretConfigured,
}: Props) {
  const router = useRouter();

  // Por defecto, últimos 3 meses
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const [dateFrom, setDateFrom] = useState(fmt(threeMonthsAgo));
  const [dateTo, setDateTo] = useState(fmt(now));

  // Sources marcadas. Por defecto ambas para que un refresh "lleva todo".
  const [sources, setSources] = useState<Record<ApiSource, boolean>>({
    susazon: true,
    suve: true,
  });
  const enabledSources: ApiSource[] = (
    Object.entries(sources) as Array<[ApiSource, boolean]>
  )
    .filter(([, on]) => on)
    .map(([k]) => k);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState(initialLastSync);
  const [totalRows, setTotalRows] = useState(initialTotalRows);

  // --- Sincronización automática (V4.4) ---
  const [autoEnabled, setAutoEnabled] = useState(syncAutoEnabled);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  useEffect(() => {
    setAutoEnabled(syncAutoEnabled);
  }, [syncAutoEnabled]);

  const lastAuto = initialHistory.find((h) => h.trigger === "cron") ?? null;
  const lastAutoFailed =
    lastAuto !== null && (lastAuto.status === "failed" || lastAuto.status === "partial");

  async function handleToggleAuto(next: boolean) {
    if (autoSaving) return;
    const prev = autoEnabled;
    setAutoEnabled(next); // optimista
    setAutoSaving(true);
    setAutoError(null);
    try {
      const res = await fetch("/api/admin/settings/sync-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAutoEnabled(prev);
        setAutoError(json.error ?? `HTTP ${res.status}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setAutoEnabled(prev);
      setAutoError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setAutoSaving(false);
    }
  }

  // Estimación de tiempo del refresh basado en costos observados:
  //   Susazón (SQL Enterprise): ~5 s/mes
  //   Suve (SQL Express, lento): ~60 s/mes
  // Vercel Hobby plan: 300 s de límite por función (5 min). Pro = 900 s.
  const estimate = useMemo(() => {
    const months = monthsBetween(dateFrom, dateTo);
    const COST_PER_MONTH: Record<ApiSource, number> = {
      susazon: 5,
      suve: 60,
    };
    const perMonthSec = enabledSources.reduce(
      (sum, s) => sum + COST_PER_MONTH[s],
      0
    );
    const totalSec = months * perMonthSec;
    const VERCEL_HOBBY_LIMIT = 300;
    return {
      months,
      totalSec,
      totalMin: totalSec / 60,
      // Warning si supera 280s (deja un buffer de 20s antes del límite real)
      excedeLimite: totalSec > VERCEL_HOBBY_LIMIT - 20,
      limite: VERCEL_HOBBY_LIMIT,
    };
  }, [dateFrom, dateTo, enabledSources]);

  // Sincroniza con el server después de router.refresh() — la cuenta real
  // viene del Server Component (count exacto en Supabase), no de un cálculo
  // optimista local que ignora los deletes de la idempotencia.
  useEffect(() => {
    setTotalRows(initialTotalRows);
  }, [initialTotalRows]);
  useEffect(() => {
    setLastSync(initialLastSync);
  }, [initialLastSync]);

  async function handleRefresh() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/data/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom, dateTo, sources: enabledSources }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setRunning(false);
        return;
      }

      setResult(json as RefreshResult);
      // No actualizamos totalRows ni lastSync optimísticamente —
      // router.refresh() los va a sincronizar con el conteo real en DB
      // vía los useEffect de arriba. Esto evita que el optimistic update
      // ignore los deletes de la idempotencia.
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

      {/* Card 1b: Sincronización automática (V4.4 — Vercel Cron) */}
      <div
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: autoEnabled ? "var(--accent)" : "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock size={20} style={{ color: "var(--accent)" }} />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Sincronización automática
            </h2>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: autoEnabled ? "var(--success-soft)" : "var(--bg-surface-muted)",
                color: autoEnabled ? "var(--success)" : "var(--text-muted)",
              }}
            >
              {autoEnabled ? "Activa" : "Manual"}
            </span>
          </div>

          {/* Switch Manual / Automático */}
          <button
            type="button"
            role="switch"
            aria-checked={autoEnabled}
            disabled={autoSaving}
            onClick={() => handleToggleAuto(!autoEnabled)}
            className="flex items-center gap-2 text-xs font-medium disabled:opacity-60"
            style={{ color: "var(--text-secondary)" }}
            title={autoEnabled ? "Desactivar (volver a manual)" : "Activar sync diaria"}
          >
            <span>Manual</span>
            <span
              className="relative inline-block h-5 w-9 rounded-full transition-colors"
              style={{ background: autoEnabled ? "var(--accent)" : "var(--border)" }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                style={{ left: 2, transform: autoEnabled ? "translateX(16px)" : "translateX(0)" }}
              />
            </span>
            <span style={{ color: autoEnabled ? "var(--accent)" : undefined }}>
              Automático
            </span>
            {autoSaving && <Loader2 size={12} className="animate-spin" />}
          </button>
        </div>

        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Cada día a las <strong>06:00 CDMX</strong> se refresca el{" "}
          <strong>mes en curso</strong> de Susazón + Suve (lo mismo que haces a
          mano). Vercel puede ejecutarla hasta 1 h después de la hora. El botón
          manual de abajo sigue disponible siempre.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat
            label="Próxima corrida"
            value={autoEnabled ? "Mañana 06:00" : "—"}
            sublabel={
              autoEnabled
                ? "CDMX · ventana 06:00–07:00"
                : "Activa el modo Automático para programarla"
            }
            tone={autoEnabled ? "success" : "neutral"}
          />
          <Stat
            label="Última corrida automática"
            value={lastAuto ? formatDateTime(lastAuto.completed_at ?? lastAuto.started_at) : "Aún no ha corrido"}
            sublabel={
              lastAuto
                ? `${lastAuto.rows_imported?.toLocaleString("es-MX") ?? 0} filas · ${statusLabel(lastAuto.status)}`
                : "Aparecerá aquí después de la primera corrida"
            }
            tone={
              !lastAuto
                ? "neutral"
                : lastAuto.status === "success"
                ? "success"
                : lastAuto.status === "failed"
                ? "danger"
                : "warning"
            }
          />
        </div>

        {!cronSecretConfigured && (
          <div
            className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2.5 text-xs"
            style={{
              background: "var(--warning-soft)",
              borderColor: "var(--warning)",
              color: "var(--text-primary)",
            }}
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <div className="leading-relaxed">
              <strong style={{ color: "var(--warning)" }}>Falta CRON_SECRET en Vercel.</strong>{" "}
              Hasta que exista, el cron no puede autenticarse y no corre (aunque
              el modo esté en Automático). Pasos: Vercel → Settings →
              Environment Variables → nueva variable <code>CRON_SECRET</code>{" "}
              (Production) con un valor largo aleatorio → Redeploy. Este aviso
              desaparece solo.
            </div>
          </div>
        )}

        {lastAutoFailed && (
          <div
            className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2.5 text-xs"
            style={{
              background: "var(--danger-soft)",
              borderColor: "var(--danger)",
              color: "var(--text-primary)",
            }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />
            <div className="leading-relaxed">
              <strong style={{ color: "var(--danger)" }}>
                La última sync automática {lastAuto?.status === "partial" ? "fue parcial" : "falló"}.
              </strong>{" "}
              Revisa el historial abajo o lanza un refresh manual del mes en curso.
            </div>
          </div>
        )}

        {autoError && (
          <div
            className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
            style={{ background: "var(--danger-soft)", borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{autoError}</span>
          </div>
        )}
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
            Refrescar desde APIs
          </h2>
        </div>

        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          Selecciona las fuentes y el rango de meses. Cada mes hace un POST a
          cada API marcada y guarda las filas con kg &gt; 0 en{" "}
          <code>sales_rows</code>.
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

        <div className="mt-4">
          <div
            className="mb-2 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Fuentes a importar
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SourceToggle
              label="Susazón"
              hint="SQL Enterprise · ~5s/mes"
              checked={sources.susazon}
              onChange={(v) =>
                setSources((s) => ({ ...s, susazon: v }))
              }
            />
            <SourceToggle
              label="Suve"
              hint="SQL Express · ~60s/mes"
              checked={sources.suve}
              onChange={(v) => setSources((s) => ({ ...s, suve: v }))}
            />
          </div>
        </div>

        {/* Estimación de tiempo + warning si supera el límite del plan Hobby */}
        {enabledSources.length > 0 && !running && (
          <div className="mt-4">
            {estimate.excedeLimite ? (
              <div
                className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2.5 text-xs"
                style={{
                  background: "var(--warning-soft)",
                  borderColor: "var(--warning)",
                  color: "var(--text-primary)",
                }}
              >
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: "var(--warning)" }}
                />
                <div className="flex-1 leading-relaxed">
                  <strong style={{ color: "var(--warning)" }}>
                    Ojo:
                  </strong>{" "}
                  este rango va a tardar aproximadamente{" "}
                  <strong>
                    {estimate.totalMin >= 1
                      ? `${estimate.totalMin.toFixed(1)} min`
                      : `${estimate.totalSec}s`}
                  </strong>{" "}
                  ({estimate.months} mes(es) ×{" "}
                  {enabledSources.length} fuente(s)) y{" "}
                  <strong>excede el límite de 5 minutos</strong> del plan
                  gratuito de Vercel. La función va a cortar a los 300
                  segundos y vas a perder lo procesado.
                  <br />
                  <span style={{ color: "var(--text-secondary)" }}>
                    Recomendaciones para Latam:
                  </span>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">
                    <li>
                      Reduce el rango a máximo{" "}
                      <strong>
                        {Math.max(
                          1,
                          Math.floor(
                            (estimate.limite - 20) /
                              Math.max(
                                1,
                                enabledSources.reduce(
                                  (s, src) =>
                                    s + (src === "susazon" ? 5 : 60),
                                  0
                                )
                              )
                          )
                        )}{" "}
                        meses
                      </strong>{" "}
                      con la(s) fuente(s) marcada(s).
                    </li>
                    <li>
                      O desmarca <strong>Suve</strong> (es la lenta) y
                      refresca solo Susazón —{" "}
                      <strong>aguanta hasta 50+ meses</strong>.
                    </li>
                    <li>
                      Sube tu plan de Vercel a Pro ($20 USD/mes) para
                      tener 15 minutos de límite.
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <Calendar size={12} />
                Estimado:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {estimate.totalSec < 60
                    ? `${estimate.totalSec}s`
                    : `${estimate.totalMin.toFixed(1)} min`}
                </strong>{" "}
                · {estimate.months} mes(es) ×{" "}
                {enabledSources.length} fuente(s)
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleRefresh}
          disabled={running || enabledSources.length === 0}
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
            Procesando — no cierres esta pestaña. Susazón ~5s/mes, Suve ~60s/mes.
            Total estimado: {monthsBetween(dateFrom, dateTo)} mes(es) ×{" "}
            {enabledSources.length} fuente(s).
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

      {/* Card 2b: Historial de sincronizaciones (últimas 10) */}
      <div
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center gap-3">
          <History size={20} style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Historial de sincronizaciones
          </h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            últimas {initialHistory.length}
          </span>
        </div>
        {initialHistory.length === 0 ? (
          <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
            Aún no hay corridas registradas.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  {["Fecha", "Disparo", "Fuentes", "Meses", "Filas", "Duración", "Estado"].map((h, i) => (
                    <th
                      key={h}
                      className={`border-b px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${i >= 4 && i <= 5 ? "text-right" : "text-left"}`}
                      style={{ borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialHistory.map((h, i) => (
                  <tr
                    key={h.id}
                    style={{ background: i % 2 === 1 ? "var(--bg-surface-muted)" : undefined }}
                  >
                    <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                      {formatDateTime(h.started_at)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: h.trigger === "cron" ? "var(--accent-soft)" : "var(--bg-surface-muted)",
                          color: h.trigger === "cron" ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >
                        {h.trigger === "cron" ? <Zap size={10} /> : <User size={10} />}
                        {h.trigger === "cron" ? "Automático" : "Manual"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {sourceLabel(h.source)}
                    </td>
                    <td className="px-2 py-1.5" style={{ color: "var(--text-secondary)" }}>
                      {rangeLabel(h.date_from, h.date_to)}
                    </td>
                    <td className="px-2 py-1.5 text-right" style={{ color: "var(--text-primary)" }}>
                      {(h.rows_imported ?? 0).toLocaleString("es-MX")}
                    </td>
                    <td className="px-2 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>
                      {durationLabel(h.started_at, h.completed_at)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className="font-semibold"
                        style={{
                          color:
                            h.status === "success"
                              ? "var(--success)"
                              : h.status === "failed"
                              ? "var(--danger)"
                              : h.status === "partial"
                              ? "var(--warning)"
                              : "var(--text-muted)",
                        }}
                      >
                        {statusLabel(h.status)}
                      </span>
                      {h.errors && h.errors.length > 0 && (
                        <span className="ml-1" style={{ color: "var(--text-muted)" }}>
                          · {h.errors.length} error(es)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

function SourceToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5 transition-colors"
      style={{
        borderColor: checked ? "var(--accent)" : "var(--border)",
        background: checked ? "var(--accent-soft)" : "var(--bg-surface-muted)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
      />
      <div className="flex-1">
        <div
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </div>
        <div
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {hint}
        </div>
      </div>
    </label>
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
        <span>Fuentes procesadas:</span>
        <span className="font-semibold">{result.sources_processed.join(", ")}</span>
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
                <strong>{e.source} {e.month}:</strong> {e.error}
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

function sourceLabel(source: string): string {
  return source
    .split("+")
    .map((p) => ({ susazon: "Susazón", suve: "Suve" }[p.replace(/_api|_csv/, "")] ?? p))
    .join(" + ");
}

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthKeyLabel(d: string | null): string {
  if (!d) return "—";
  const [y, m] = d.split("-").map(Number);
  if (!y || !m) return d;
  return `${MONTHS_ES[m - 1]} ${y}`;
}

function rangeLabel(from: string | null, to: string | null): string {
  const a = monthKeyLabel(from);
  const b = monthKeyLabel(to);
  return a === b ? a : `${a} → ${b}`;
}

function durationLabel(start: string, end: string | null): string {
  if (!end) return "—";
  const sec = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}
