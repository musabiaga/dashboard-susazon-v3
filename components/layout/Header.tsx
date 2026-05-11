"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BarChart3, Database, Shield } from "lucide-react";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { SusazonLogo } from "@/components/brand/SusazonLogo";
import { InstructivoButton } from "@/components/dashboard/InstructivoButton";

interface HeaderProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  showLogout?: boolean;
  // Si true, muestra el link a /cargar-datos. Pasarlo desde la página
  // según el rol (admin/director ven; otros no).
  canEditData?: boolean;
  // Si true, muestra el link a /admin (solo rol admin).
  isAdmin?: boolean;
  // Si true, muestra el botón Instructivo (controlado por admin desde
  // app_settings.instructivo_visible).
  instructivoVisible?: boolean;
}

export function Header({
  userName,
  userRole,
  onLogout,
  showLogout = true,
  canEditData = false,
  isAdmin = false,
  instructivoVisible = false,
}: HeaderProps) {
  const pathname = usePathname();

  return (
    <header
      className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3"
      style={{ background: "var(--bg-header)" }}
    >
      <div className="flex items-center gap-4">
        <SusazonLogo width={120} height={60} className="h-10 w-auto" priority />
        <div className="hidden flex-col leading-tight md:flex">
          <span
            className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-on-header)" }}
          >
            Dashboard Comercial
          </span>
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "var(--text-on-header-muted)" }}
          >
            Grupo Susazón · V3.0
          </span>
        </div>

        {userName && (
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <NavLink
              href="/dashboard"
              icon={<BarChart3 size={14} />}
              label="Dashboard"
              active={pathname === "/dashboard" || pathname === "/"}
            />
            {canEditData && (
              <NavLink
                href="/cargar-datos"
                icon={<Database size={14} />}
                label="Cargar datos"
                active={pathname?.startsWith("/cargar-datos") ?? false}
              />
            )}
            {isAdmin && (
              <NavLink
                href="/admin"
                icon={<Shield size={14} />}
                label="Admin"
                active={pathname?.startsWith("/admin") ?? false}
              />
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-on-header)" }}
            >
              {userName}
            </span>
            {userRole && (
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-on-header-muted)" }}
              >
                {userRole}
              </span>
            )}
          </div>
        )}

        <InstructivoButton visible={instructivoVisible} />

        <ThemeSelector />

        {showLogout && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        )}
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
      style={{
        color: active
          ? "var(--text-on-header)"
          : "var(--text-on-header-muted)",
        background: active ? "rgba(255,255,255,0.1)" : "transparent",
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
