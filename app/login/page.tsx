"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Mail, ShieldAlert, Loader2, ArrowRight } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);

  // Trigger de la intro: cambia `mounted` después del primer render
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

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
      const next = encodeURIComponent("/set-password?from=recovery");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${next}`,
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
    <div className="relative flex min-h-screen overflow-hidden bg-[var(--bg-page)]">
      {/* Theme selector arriba a la derecha */}
      <div className="absolute right-6 top-6 z-50">
        <ThemeSelector />
      </div>

      {/* ============ HERO IZQUIERDO (60%) ============ */}
      <section
        className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex"
        style={{ background: "#0c0a1f" }}
      >
        {/* Aurora gradient animado */}
        <div className="login-aurora absolute inset-0" />

        {/* Vignette para profundidad */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)",
          }}
        />

        {/* Grid pattern sutil overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Contenido del hero */}
        <div
          className={`login-hero-content relative z-10 flex flex-col items-center px-12 ${mounted ? "is-loaded" : ""}`}
        >
          {/* Logo InCom GIGANTE (versión limpia extraída del SVG) */}
          <div className="login-hero-logo">
            <Image
              src="/incom-mark@4x.png"
              alt="InCom — Inteligencia Comercial Susazón"
              width={1024}
              height={1024}
              className="h-[440px] w-[440px] drop-shadow-[0_30px_80px_rgba(237,104,8,0.55)] xl:h-[520px] xl:w-[520px]"
              priority
            />
          </div>

          {/* InCom + subtítulo — debajo del logo */}
          <div className="login-hero-text mt-6 text-center">
            <h1
              className="text-6xl font-bold tracking-tight text-white xl:text-7xl"
              style={{
                fontFamily: "var(--font-bebas), sans-serif",
                letterSpacing: "0.04em",
                textShadow: "0 4px 24px rgba(237,104,8,0.35)",
              }}
            >
              InCom
            </h1>
            <p
              className="mt-2 text-xs font-semibold uppercase tracking-[0.5em] text-white/85 xl:text-sm xl:tracking-[0.55em]"
              style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
            >
              Inteligencia Comercial Susazón
              <span className="ml-0.5 align-super text-[8px] xl:text-[10px]">®</span>
            </p>
          </div>
        </div>

        {/* Footer copyright — abajo, discreto */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-white/40">
          © {new Date().getFullYear()} · Grupo Susazón
        </div>
      </section>

      {/* ============ FORM DERECHO (40%) ============ */}
      <section className="flex w-full items-center justify-center px-4 py-12 lg:w-[480px] lg:px-8 xl:w-[540px]">
        <div
          className={`login-form-card w-full max-w-sm ${mounted ? "is-loaded" : ""}`}
        >
          {/* Logo InCom (visible solo en mobile cuando el hero está oculto) */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <Image
              src="/incom-mark@2x.png"
              alt="InCom"
              width={160}
              height={160}
              className="h-32 w-32"
              priority
            />
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-bebas), sans-serif",
                color: "var(--text-primary)",
              }}
            >
              InCom
            </h1>
          </div>

          {/* Logo Susazón — branding del cliente. Auto-switch entre marrón
              (fondos claros) y blanco (fondos oscuros) según el theme. */}
          <div className="mb-8 flex justify-center">
            <SusazonLogo
              surface="page"
              width={240}
              height={120}
              className="h-14 w-auto opacity-90 transition-opacity hover:opacity-100"
              priority
            />
          </div>

          {/* Header del form */}
          <div className="mb-8">
            <h2
              className="text-3xl font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-bebas), sans-serif",
                color: "var(--text-primary)",
                letterSpacing: "0.02em",
              }}
            >
              Iniciar sesión
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Acceso restringido. Personal autorizado únicamente.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Correo
              </label>
              <div
                className="flex items-center gap-2 rounded-[var(--radius)] border px-3 transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]"
                style={{
                  background: "var(--bg-surface-muted)",
                  borderColor: "var(--border)",
                }}
              >
                <Mail size={16} style={{ color: "var(--text-muted)" }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu.nombre@susazon.com.mx"
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Contraseña
              </label>
              <div
                className="flex items-center gap-2 rounded-[var(--radius)] border px-3 transition-all focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]"
                style={{
                  background: "var(--bg-surface-muted)",
                  borderColor: "var(--border)",
                }}
              >
                <Lock size={16} style={{ color: "var(--text-muted)" }} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>

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

            <button
              type="submit"
              disabled={submitting}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "white",
                boxShadow: "0 8px 24px rgba(237, 104, 8, 0.25)",
              }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Acceder
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
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

          {/* Footer credit en mobile (en desktop ya está en el hero) */}
          <div
            className="mt-12 text-center text-[10px] uppercase tracking-[0.3em] lg:hidden"
            style={{ color: "var(--text-muted)" }}
          >
            © {new Date().getFullYear()} · Grupo Susazón
          </div>
        </div>
      </section>

      {/* ============ Estilos: aurora + intro animaciones ============ */}
      <style jsx>{`
        /* Aurora gradient animado — capas de blobs naranjas / cyan / magenta */
        .login-aurora {
          background:
            radial-gradient(circle at 22% 28%, #ed6808 0%, transparent 55%),
            radial-gradient(circle at 78% 72%, #ff7e22 0%, transparent 45%),
            radial-gradient(circle at 80% 18%, #06b6d4 0%, transparent 38%),
            radial-gradient(circle at 18% 80%, #ec4899 0%, transparent 35%);
          filter: blur(60px) saturate(1.3);
          opacity: 0.7;
          animation: login-aurora-shift 18s ease-in-out infinite;
        }
        @keyframes login-aurora-shift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(4%, -2%) scale(1.05); }
          66%      { transform: translate(-3%, 3%) scale(0.97); }
        }

        /* ===== Intro animations (~1.2s total) ===== */
        .login-hero-logo,
        .login-hero-text {
          opacity: 0;
        }
        .login-hero-logo {
          transform: scale(0.85);
        }
        .login-hero-text {
          transform: translateY(16px);
        }
        .login-form-card {
          opacity: 0;
          transform: translateX(24px);
        }

        .is-loaded.login-hero-content .login-hero-logo {
          animation: hero-logo-in 950ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
        }
        .is-loaded.login-hero-content .login-hero-text {
          animation: hero-fade-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 550ms forwards;
        }
        .login-form-card.is-loaded {
          animation: form-slide-in 700ms cubic-bezier(0.16, 1, 0.3, 1) 600ms forwards;
        }

        @keyframes hero-logo-in {
          0%   { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes hero-fade-up {
          0%   { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes form-slide-in {
          0%   { opacity: 0; transform: translateX(24px); }
          100% { opacity: 1; transform: translateX(0); }
        }

        /* Respeta prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .login-hero-logo,
          .login-hero-text,
          .login-form-card {
            opacity: 1 !important;
            transform: none !important;
            animation: none !important;
          }
          .login-aurora { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
