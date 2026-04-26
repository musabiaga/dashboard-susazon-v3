"use client";

import { LogOut } from "lucide-react";
import { ThemeSelector } from "@/components/theme/ThemeSelector";
import { SusazonLogo } from "@/components/brand/SusazonLogo";

interface HeaderProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  showLogout?: boolean;
}

export function Header({ userName, userRole, onLogout, showLogout = true }: HeaderProps) {
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
