"use client";

import {
  CalendarDays,
  BarChart3,
  Layers3,
  Package,
  Users,
  UserCircle2,
  AlertOctagon,
  Lightbulb,
} from "lucide-react";
import type { ReactNode } from "react";

export type TabKey =
  | "tracking"
  | "ventas"
  | "grupo"
  | "productos"
  | "clientes"
  | "vendedores"
  | "perdidos"
  | "insights";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: ReactNode;
}

const TABS: TabConfig[] = [
  { key: "tracking", label: "Tracking Diario", icon: <CalendarDays size={14} /> },
  { key: "ventas", label: "Ventas", icon: <BarChart3 size={14} /> },
  { key: "grupo", label: "Grupo Producto", icon: <Layers3 size={14} /> },
  { key: "productos", label: "Productos", icon: <Package size={14} /> },
  { key: "clientes", label: "Clientes", icon: <Users size={14} /> },
  { key: "vendedores", label: "Vendedores", icon: <UserCircle2 size={14} /> },
  { key: "perdidos", label: "Perdidos", icon: <AlertOctagon size={14} /> },
  { key: "insights", label: "Insights", icon: <Lightbulb size={14} /> },
];

interface DashboardTabsProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
  children: ReactNode;
}

/**
 * Nav de tabs + contenedor del contenido activo.
 * 7 tabs replicando el V2.2. El contenido de cada tab vive en componentes
 * separados que se renderizan vía `children` desde el padre.
 */
export function DashboardTabs({
  active,
  onChange,
  children,
}: DashboardTabsProps) {
  return (
    <div className="flex flex-col">
      <div
        className="flex flex-wrap gap-1 border-b px-1"
        style={{ borderColor: "var(--border)" }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className="flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                borderColor: isActive ? "var(--accent)" : "transparent",
                color: isActive
                  ? "var(--accent)"
                  : "var(--text-secondary)",
              }}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

export const TAB_LABELS: Record<TabKey, string> = Object.fromEntries(
  TABS.map((t) => [t.key, t.label])
) as Record<TabKey, string>;
