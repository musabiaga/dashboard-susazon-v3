"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ShieldAlert, Loader2 } from "lucide-react";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { SusazonLogo } from "@/components/brand/SusazonLogo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("PEGAR_AQUI");

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!SUPABASE_CONFIGURED) {
      await new Promise((r) => setTimeout(r, 400));
      setSubmitting(false);
      setError(
        "Supabase no configurado todavía. Pega las credenciales en .env.local y reinicia el dev server."
      );
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Credenciales incorrectas. Verifica tu correo y contraseña."
            : authError.message
        );
        setSubmitting(false);
        return;
      }

      // Login OK — registrar evento y redirigir
      await supabase.from("audit_log").insert({
        action: "login",
        user_email: email,
        details: { source: "web" },
      });

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al iniciar sesión."
      );
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    if (!SUPABASE_CONFIGURED) {
      setError("Supabase no configurado todavía — disponible cuando lleguen credenciales.");
      return;
    }
    if (!email) {
      setError("Escribe tu correo arriba antes de pedir el reset.");
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      // El redirectTo apunta DIRECTO a /set-password (no al callback) — Supabase
      // verifica el token internamente y crea la sesión antes de hacer el redirect
      // final. Esto bypassa el callback handler que en algunos formatos de email
      // no recibe los params correctos.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password?from=recovery`,
      });
      if (resetError) {
        setError(resetError.message);
      } else {
        setError(`Te enviamos un correo de recuperación a ${email}. Revisa tu bandeja.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al solicitar reset.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-page)]">
      <div className="absolute right-6 top-6 z-10">
        <ThemeSelector />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <div
              className="flex items-center justify-center rounded-[var(--radius-lg)] p-6"
              style={{ background: "var(--bg-header)" }}
            >
              <SusazonLogo width={240} height={120} className="h-20 w-auto" priority />
            </div>
            <h1
              className="mt-4 text-2xl font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              Dashboard Comercial
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Grupo Susazón · V3.0
            </p>
          </div>

          <div
            className="rounded-[var(--radius-lg)] border p-6"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="mb-5 flex items-start gap-3 rounded-[var(--radius)] p-3"
              style={{ background: "var(--warning-soft)", color: "var(--text-primary)" }}
            >
              <ShieldAlert
                size={18}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--warning)" }}
              />
              <div className="text-xs leading-relaxed">
                <strong>Plataforma de uso restringido.</strong> Acceso solo para personal
                autorizado de Grupo Susazón (máximo 15 usuarios). Toda actividad queda
                registrada.
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.nombre@susazon.mx"
                    className="w-full rounded-[var(--radius)] border bg-transparent px-3 py-2.5 pl-9 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-[var(--radius)] border bg-transparent px-3 py-2.5 pl-9 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              {error && (
                <div
                  className="rounded-[var(--radius)] border px-3 py-2 text-xs"
                  style={{
                    background: "var(--danger-soft)",
                    borderColor: "var(--danger)",
                    color: "var(--danger)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
                style={{ background: submitting ? "var(--accent-hover)" : "var(--accent)" }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Iniciar sesión"
                )}
              </button>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  className="text-xs hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={handleForgotPassword}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          </div>

          <div
            className="mt-6 text-center text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Grupo Susazón · {new Date().getFullYear()}
          </div>
        </div>
      </main>
    </div>
  );
}
