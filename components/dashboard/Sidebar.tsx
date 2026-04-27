"use client";

import { Layers, AlertTriangle, Building2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

export interface TerritoryKpi {
  venta: number;
  margen: number;
  kg: number;
  marginPct: number;
  // Mismo mes del año anterior (para YoY). Si no hay data: ceros.
  prevYear: { venta: number; margen: number; kg: number };
  // Acumulado de venta por año (YTD para año actual, full para pasados).
  // Map { 2024: 96500000, 2025: 107700000, 2026: 31700000 }
  acumByYear: Record<number, number>;
}

export interface Territory {
  name: string;
  isActive: boolean;
  reason: string | null;
  kpi: TerritoryKpi;
  // PTTO de venta del mes actual. 0 = no configurado (UI muestra "—").
  ventaBudget: number;
}

interface SidebarProps {
  territories: Territory[];
  selected: string; // "" = "Todos"
  onSelect: (name: string) => void;
  totalKpi: TerritoryKpi;
}

/**
 * Sidebar de territorios — lista filtrada por permisos vía RLS.
 * Click en un territorio cambia el contexto del dashboard a ese.
 * Click en "Todos" agrega todos los territorios visibles.
 */
export function Sidebar({ territories, selected, onSelect, totalKpi }: SidebarProps) {
  const total = territories.length;
  const disabledCount = territories.filter((t) => !t.isActive).length;

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Building2 size={16} style={{ color: "var(--accent)" }} />
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Territorios
          </h2>
        </div>
        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {total} visible{total === 1 ? "" : "s"}
          {disabledCount > 0 && ` · ${disabledCount} apagado${disabledCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <SidebarItem
          label="Todos"
          icon={<Layers size={14} />}
          selected={selected === ""}
          onClick={() => onSelect("")}
          disabled={false}
          kpi={totalKpi}
        />
        <div
          className="my-2 border-t"
          style={{ borderColor: "var(--border)" }}
        />
        {territories.length === 0 && (
          <div
            className="px-3 py-2 text-xs italic"
            style={{ color: "var(--text-muted)" }}
          >
            Sin territorios visibles. Carga datos primero o pide permisos al
            admin.
          </div>
        )}
        {territories.map((t) => (
          <SidebarItem
            key={t.name}
            label={t.name}
            selected={selected === t.name}
            onClick={() => onSelect(t.name)}
            disabled={!t.isActive}
            tooltip={
              !t.isActive
                ? t.reason ?? "Apagado por el administrador"
                : undefined
            }
            kpi={t.kpi}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({
  label,
  icon,
  selected,
  onClick,
  disabled,
  tooltip,
  kpi,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  tooltip?: string;
  kpi?: TerritoryKpi;
}) {
  const hasKpi = kpi && kpi.venta > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className="flex w-full flex-col gap-0.5 rounded-[var(--radius)] px-3 py-2 text-left transition-colors"
      style={{
        background: selected ? "var(--accent-soft)" : "transparent",
        color: selected
          ? "var(--accent)"
          : disabled
          ? "var(--text-muted)"
          : "var(--text-primary)",
        fontWeight: selected ? 600 : 400,
      }}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 truncate text-sm">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        {disabled && (
          <AlertTriangle
            size={12}
            style={{ color: "var(--warning)" }}
          />
        )}
      </span>
      {hasKpi && (
        <span
          className="ml-1 flex items-baseline gap-1.5 text-[11px] tabular-nums"
          style={{
            color: selected ? "var(--accent)" : "var(--text-muted)",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span className="font-semibold">{formatMoney(kpi!.venta)}</span>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <span>{kpi!.marginPct.toFixed(1)}%</span>
        </span>
      )}
    </button>
  );
}
