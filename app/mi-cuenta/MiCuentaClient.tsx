"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Lock,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  User as UserIcon,
} from "lucide-react";

interface Props {
  userEmail: string;
  userName: string;
  /** Si true, el usuario fue creado con password directa por admin y DEBE
   *  cambiarla antes de poder navegar al resto de la app. */
  mustChangePassword: boolean;
}

export function MiCuentaClient({
  userEmail,
  userName,
  mustChangePassword,
}: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (next.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (next === current) {
      setError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: current,
          new_password: next,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Error desconocido");
      } else {
        setSuccess("¡Contraseña actualizada! Redirigiendo…");
        setCurrent("");
        setNext("");
        setConfirm("");
        // Si tenía must_change_password, se acaba de limpiar → redirigir
        // al dashboard. Si no, mantener al usuario aquí con el feedback.
        setTimeout(() => {
          if (data.cleared_must_change || mustChangePassword) {
            router.push("/dashboard");
            router.refresh();
          } else {
            router.refresh();
          }
        }, 1200);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al guardar."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="flex items-center gap-2 text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          <UserIcon size={22} style={{ color: "var(--accent)" }} />
          Mi cuenta
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Gestiona tus credenciales de acceso.
        </p>
      </div>

      {/* Banner: forzar cambio si aplica */}
      {mustChangePassword && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius)] border px-4 py-3 text-sm"
          style={{
            background: "var(--warning-soft)",
            borderColor: "var(--warning)",
            color: "var(--text-primary)",
          }}
        >
          <ShieldAlert
            size={16}
            className="mt-0.5 shrink-0"
            style={{ color: "var(--warning)" }}
          />
          <div>
            <strong>Debes cambiar tu contraseña</strong> antes de continuar.
            La contraseña actual fue asignada por el administrador y no debe
            seguir circulando. Define una nueva contraseña para activar tu
            cuenta completamente.
          </div>
        </div>
      )}

      {/* Card: datos del perfil (read-only) */}
      <section
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Datos del perfil
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre" value={userName || "—"} />
          <Field label="Email" value={userEmail} />
        </div>
        <p
          className="mt-3 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          Si necesitas cambiar tu nombre o email, contacta al administrador.
        </p>
      </section>

      {/* Card: cambiar contraseña */}
      <section
        className="rounded-[var(--radius-lg)] border p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <h2
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          <KeyRound size={14} />
          Cambiar contraseña
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <PasswordInput
            label="Contraseña actual"
            value={current}
            onChange={setCurrent}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
            required
          />
          <PasswordInput
            label="Contraseña nueva"
            value={next}
            onChange={setNext}
            visible={showNext}
            onToggleVisible={() => setShowNext((v) => !v)}
            autoComplete="new-password"
            required
            helperText="Mínimo 8 caracteres."
          />
          <PasswordInput
            label="Confirmar contraseña nueva"
            value={confirm}
            onChange={setConfirm}
            visible={showNext}
            onToggleVisible={() => setShowNext((v) => !v)}
            autoComplete="new-password"
            required
          />

          {error && (
            <div
              className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
              style={{
                background: "var(--danger-soft)",
                borderColor: "var(--danger)",
                color: "var(--danger)",
              }}
            >
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
              style={{
                background: "var(--success-soft)",
                borderColor: "var(--success)",
                color: "var(--success)",
              }}
            >
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--accent)",
              color: "white",
              boxShadow: "0 6px 16px rgba(237, 104, 8, 0.20)",
            }}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <KeyRound size={16} />
            )}
            <span>
              {submitting ? "Guardando…" : "Actualizar contraseña"}
            </span>
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span
        className="block text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className="mt-0.5 block text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
  required,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-[var(--radius)] border px-3 transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]"
        style={{
          background: "var(--bg-surface-muted)",
          borderColor: "var(--border)",
        }}
      >
        <Lock size={14} style={{ color: "var(--text-muted)" }} />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className="flex-1 bg-transparent py-2.5 text-sm outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="rounded p-1 hover:bg-[var(--bg-surface)]"
          style={{ color: "var(--text-muted)" }}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {helperText && (
        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
