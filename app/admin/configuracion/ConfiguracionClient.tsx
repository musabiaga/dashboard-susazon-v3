"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface Props {
  initialInstructivoEnabled: boolean;
  instructivoUpdatedAt: string | null;
}

export function ConfiguracionClient({
  initialInstructivoEnabled,
  instructivoUpdatedAt,
}: Props) {
  const router = useRouter();
  const [instructivoEnabled, setInstructivoEnabled] = useState(
    initialInstructivoEnabled
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(instructivoUpdatedAt);

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

      {/* Card vacío para configuraciones futuras */}
      <section
        className="rounded-[var(--radius-lg)] border border-dashed p-5 text-center text-xs italic"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        Próximamente: más toggles globales (modo mantenimiento, banners,
        feature flags…).
      </section>
    </div>
  );
}
