"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { SusazonLogo } from "@/components/brand/SusazonLogo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  email: string;
  fullName: string | null;
  role: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  director: "Director",
  gerente_regional: "Gerente Regional",
  vendedor: "Vendedor",
};

export function SetPasswordClient({ email, fullName, role }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validaciones de password
  const minLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const matches = password.length > 0 && password === confirmPassword;
  const allValid = minLength && hasNumber && hasLetter && matches;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!allValid) {
      setError("Verifica que la contraseña cumpla todos los requisitos.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      // Pequeño delay para que el user vea el mensaje de éxito
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error desconocido al fijar contraseña"
      );
      setSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Header con theme selector arriba a la derecha */}
      <header className="flex items-center justify-end p-4">
        <ThemeSelector />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div
          className="w-full max-w-md rounded-[var(--radius-lg)] border p-8"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Logo + saludo */}
          <div className="mb-6 flex flex-col items-center text-center">
            <SusazonLogo width={120} height={60} className="h-12 w-auto" priority />
            <h1
              className="mt-4 text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              ¡Bienvenido{fullName ? `, ${fullName.split(" ")[0]}` : ""}!
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Configura tu contraseña para acceder al Dashboard Comercial
            </p>
          </div>

          {/* Info del usuario */}
          <div
            className="mb-5 rounded-[var(--radius)] border px-3 py-2 text-xs"
            style={{
              background: "var(--bg-surface-muted)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--text-muted)" }}>Email:</span>
              <span
                className="font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {email}
              </span>
            </div>
            {role && (
              <div className="mt-1 flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Rol:</span>
                <span
                  className="font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  {ROLE_LABELS[role] ?? role}
                </span>
              </div>
            )}
          </div>

          {success ? (
            <div
              className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-3 text-sm"
              style={{
                background: "var(--success-soft)",
                borderColor: "var(--success)",
                color: "var(--success)",
              }}
            >
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <div>
                <strong>Contraseña configurada exitosamente.</strong>
                <p className="mt-0.5 text-xs">
                  Redirigiendo al dashboard...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    required
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-[var(--radius)] border py-2.5 pl-9 pr-10 text-sm"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 transition-colors hover:bg-[var(--bg-surface-muted)]"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    placeholder="Repite la contraseña"
                    className="w-full rounded-[var(--radius)] border py-2.5 pl-9 pr-3 text-sm"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              {/* Requisitos */}
              <div
                className="rounded-[var(--radius)] border p-3 text-xs"
                style={{
                  background: "var(--bg-surface-muted)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Requisitos
                </div>
                <ul className="space-y-0.5">
                  <RequirementItem ok={minLength} label="Mínimo 8 caracteres" />
                  <RequirementItem ok={hasLetter} label="Al menos una letra" />
                  <RequirementItem ok={hasNumber} label="Al menos un número" />
                  <RequirementItem ok={matches} label="Las contraseñas coinciden" />
                </ul>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !allValid}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{
                  background: submitting
                    ? "var(--accent-hover)"
                    : "var(--accent)",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Configurando…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Configurar contraseña y entrar
                  </>
                )}
              </button>
            </form>
          )}

          <p
            className="mt-5 text-center text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            Plataforma de uso restringido · Grupo Susazón
          </p>
        </div>
      </div>
    </main>
  );
}

function RequirementItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className="flex items-center gap-2"
      style={{ color: ok ? "var(--success)" : "var(--text-muted)" }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: ok ? "var(--success)" : "var(--text-muted)",
        }}
      />
      {label}
    </li>
  );
}
