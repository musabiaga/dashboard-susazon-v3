"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  ShieldAlert,
} from "lucide-react";

type SessionTimeoutValue = 35 | 45 | 60 | 90 | 120 | null;

const TIMEOUT_OPTIONS: { value: SessionTimeoutValue; label: string }[] = [
  { value: null, label: "Sin límite (default)" },
  { value: 35, label: "35 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
  { value: 120, label: "120 min" },
];

interface Props {
  initialInstructivoEnabled: boolean;
  instructivoUpdatedAt: string | null;
  initialSessionTimeoutMinutes: SessionTimeoutValue;
  sessionTimeoutUpdatedAt: string | null;
}

export function ConfiguracionClient({
  initialInstructivoEnabled,
  instructivoUpdatedAt,
  initialSessionTimeoutMinutes,
  sessionTimeoutUpdatedAt,
}: Props) {
  const router = useRouter();
  const [instructivoEnabled, setInstructivoEnabled] = useState(
    initialInstructivoEnabled
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(instructivoUpdatedAt);
  // Estado del timeout de inactividad (independiente del de instructivo)
  const [sessionTimeout, setSessionTimeout] =
    useState<SessionTimeoutValue>(initialSessionTimeoutMinutes);
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [timeoutUpdatedAt, setTimeoutUpdatedAt] = useState(
    sessionTimeoutUpdatedAt
  );

  async function toggleInstructivo() {
    if (saving) return;
    setError(null);
    setSuccess(null);
    const newValue = !instructivoEnabled;
    setSaving(true);
    // Optimistic UI
    setInstructivoEnabled(newValue);

    try {
      const resp = await fetch("/api/admin/settings/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "instructivo_visible",
          enabled: newValue,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        // Revertir UI
        setInstructivoEnabled(!newValue);
        setError(data.error ?? "Error desconocido");
      } else {
        setLastUpdated(data.updated_at);
        setSuccess(
          newValue
            ? "Instructivo VISIBLE — todos los usuarios ya pueden verlo."
            : "Instructivo OCULTO — ningún usuario verá el botón."
        );
        setTimeout(() => setSuccess(null), 3500);
        router.refresh();
      }
    } catch (err) {
      setInstructivoEnabled(!newValue);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function updateSessionTimeout(newValue: SessionTimeoutValue) {
    if (savingTimeout) return;
    setError(null);
    setSuccess(null);
    setSavingTimeout(true);
    const previous = sessionTimeout;
    setSessionTimeout(newValue); // optimistic
    try {
      const resp = await fetch("/api/admin/settings/session-timeout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: newValue }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSessionTimeout(previous); // revertir
        setError(data.error ?? "Error desconocido");
      } else {
        setTimeoutUpdatedAt(data.updated_at);
        setSuccess(
          newValue == null
            ? "Timeout DESACTIVADO — sesiones indefinidas."
            : `Timeout configurado a ${newValue} min de inactividad.`
        );
        setTimeout(() => setSuccess(null), 3500);
        router.refresh();
      }
    } catch (err) {
      setSessionTimeout(previous);
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSavingTimeout(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius)] border px-4 py-3 text-sm"
          style={{
            background: "var(--danger-soft)",
            borderColor: "var(--danger)",
            color: "var(--danger)",
          }}
        >
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius)] border px-4 py-3 text-sm"
          style={{
            background: "var(--success-soft)",
            borderColor: "var(--success)",
            color: "var(--success)",
          }}
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Card: Instructivo */}
      <section
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen
              size={22}
              style={{ color: "var(--accent)" }}
              className="mt-0.5 shrink-0"
            />
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Instructivo del Dashboard
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Controla si el botón &ldquo;Instructivo&rdquo; aparece en el
                header del dashboard. Cuando está activo, todos los usuarios
                (incluidos vendedores y gerentes) pueden abrir el instructivo
                desde cualquier pantalla.
              </p>
              {lastUpdated && (
                <p
                  className="mt-2 text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Última actualización:{" "}
                  {new Date(lastUpdated).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleInstructivo}
            disabled={saving}
            className="flex shrink-0 items-center gap-2 rounded-[var(--radius)] border px-4 py-2 text-sm font-medium uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: instructivoEnabled
                ? "var(--success-soft)"
                : "var(--bg-surface-muted)",
              borderColor: instructivoEnabled
                ? "var(--success)"
                : "var(--border)",
              color: instructivoEnabled
                ? "var(--success)"
                : "var(--text-muted)",
            }}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : instructivoEnabled ? (
              <CheckCircle2 size={14} />
            ) : (
              <Circle size={14} />
            )}
            <span>
              {saving
                ? "Guardando…"
                : instructivoEnabled
                  ? "Visible"
                  : "Oculto"}
            </span>
          </button>
        </div>
      </section>

      {/* Card: Timeout de inactividad */}
      <section
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock
              size={22}
              style={{ color: "var(--accent)" }}
              className="mt-0.5 shrink-0"
            />
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Cierre automático por inactividad
              </h2>
              <p
                className="mt-1 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                Si el usuario no interactúa con el dashboard durante el tiempo
                configurado, su sesión cierra automáticamente. Se muestra un
                aviso de 60 s antes con opción de continuar. Los usuarios
                marcados como{" "}
                <strong>exentos del timeout</strong> en la pestaña Usuarios
                NO se ven afectados.
              </p>
              {timeoutUpdatedAt && (
                <p
                  className="mt-2 text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Última actualización:{" "}
                  {new Date(timeoutUpdatedAt).toLocaleString("es-MX", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <select
              value={sessionTimeout ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const newValue: SessionTimeoutValue =
                  v === ""
                    ? null
                    : (parseInt(v, 10) as 35 | 45 | 60 | 90 | 120);
                updateSessionTimeout(newValue);
              }}
              disabled={savingTimeout}
              className="rounded-[var(--radius)] border px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  sessionTimeout != null
                    ? "var(--success-soft)"
                    : "var(--bg-surface-muted)",
                borderColor:
                  sessionTimeout != null ? "var(--success)" : "var(--border)",
                color:
                  sessionTimeout != null
                    ? "var(--success)"
                    : "var(--text-secondary)",
              }}
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
            {savingTimeout && (
              <span
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                <Loader2 size={10} className="animate-spin" />
                Guardando…
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
