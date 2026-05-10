"use client";

import {
  Layers,
  AlertTriangle,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Square,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

export interface DailyPoint {
  d: number; // día del mes 1-31
  v: number; // venta
  m: number; // margen
  k: number; // kg
}

export interface MonthlyPoint {
  anio: number;
  mes: number; // 1-12
  venta: number;
  margen: number;
  kg: number;
}

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
  // Daily breakdown — usado por tab Tracking Diario.
  daily: {
    current: DailyPoint[];   // mes actual, ordenado por día
    prevYear: DailyPoint[];  // mismo mes año anterior, ordenado por día
  };
  // Monthly breakdown todos los años — usado por tab Ventas.
  // Cada entrada es (anio, mes, venta, margen, kg) sumando sobre territorio.
  monthly: MonthlyPoint[];
  // Acumulado AL DÍA N del mes actual de cada año (Mejora 2 Commit B).
  // Permite mostrar barras apiladas en el slot del mes actual del chart
  // anual de Ventas: segmento sólido = al-día, segmento translúcido = resto.
  // Para 2026 = lo facturado hasta hoy. Para 2024/25 = acumulado al día
  // calendario equivalente al día hábil que llevamos en 2026.
  currentMonthAlDia?: {
    v24: number; v25: number; v26: number;
    m24: number; m25: number; m26: number;
  };
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
  /** Set de territorios marcados (multi-select). Mejora 7. */
  selected: Set<string>;
  /** Toggle de un territorio: agrega o quita del Set. */
  onToggle: (name: string) => void;
  /** Marca/desmarca todos los territorios activos. */
  onToggleAll: () => void;
  /** Selecciona SOLO ese territorio (deselecciona todos los demás). */
  onSelectOnly: (name: string) => void;
  totalKpi: TerritoryKpi;
  /** KPI agregada de la selección actual (puede ser parcial). */
  selectedKpi: TerritoryKpi;
  // Estado controlado desde el padre (DashboardClient persiste en localStorage)
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Sidebar de territorios — lista filtrada por permisos vía RLS.
 *
 * Mejora 7: multi-select con checkboxes. Click en una fila toggle ese
 * territorio. Click en "Todos" marca/desmarca a todos. Hover muestra botón
 * "Solo" para selección rápida de uno solo (deselecciona los demás).
 *
 * Soporta modo `collapsed`: cuando está cerrado se reduce a una mini-tira de
 * 44px con solo el botón para reabrir. La preferencia se persiste en
 * localStorage desde el componente padre.
 */
export function Sidebar({
  territories,
  selected,
  onToggle,
  onToggleAll,
  onSelectOnly,
  totalKpi,
  selectedKpi,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const total = territories.length;
  const activeTerritories = territories.filter((t) => t.isActive);
  const activeCount = activeTerritories.length;
  const disabledCount = territories.filter((t) => !t.isActive).length;
  const selectedCount = activeTerritories.filter((t) =>
    selected.has(t.name)
  ).length;
  const allSelected = activeCount > 0 && selectedCount === activeCount;
  const noneSelected = selectedCount === 0;

  // ===== Modo colapsado: mini-tira con botón =====
  if (collapsed) {
    return (
      <aside
        className="flex w-11 shrink-0 flex-col items-center border-r py-3 transition-all duration-200"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Mostrar territorios"
          title="Mostrar territorios"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-[var(--bg-surface-muted)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  // ===== Modo expandido: lista completa con checkboxes =====
  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r transition-all duration-200"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="flex items-start justify-between gap-2 border-b px-5 py-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
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
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {selectedCount}
            </span>{" "}
            de {activeCount} activo{activeCount === 1 ? "" : "s"}
            {disabledCount > 0 && (
              <>
                {" · "}
                {disabledCount} apagado{disabledCount === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Ocultar territorios"
          title="Ocultar territorios"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--bg-surface-muted)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {/* Toggle "Todos" — marca/desmarca todos los activos */}
        <SidebarItem
          label={allSelected ? "Todos" : noneSelected ? "Ninguno" : "Mixto"}
          icon={<Layers size={14} />}
          checkboxState={
            allSelected ? "checked" : noneSelected ? "empty" : "partial"
          }
          onClick={onToggleAll}
          disabled={false}
          kpi={allSelected ? totalKpi : selectedKpi}
          isToggleAll
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
            checkboxState={selected.has(t.name) ? "checked" : "empty"}
            onClick={() => onToggle(t.name)}
            onSelectOnly={t.isActive ? () => onSelectOnly(t.name) : undefined}
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

type CheckboxState = "checked" | "empty" | "partial";

function SidebarItem({
  label,
  icon,
  checkboxState,
  onClick,
  onSelectOnly,
  disabled,
  tooltip,
  kpi,
  isToggleAll = false,
}: {
  label: string;
  icon?: React.ReactNode;
  checkboxState: CheckboxState;
  onClick: () => void;
  onSelectOnly?: () => void;
  disabled: boolean;
  tooltip?: string;
  kpi?: TerritoryKpi;
  isToggleAll?: boolean;
}) {
  const hasKpi = kpi && kpi.venta > 0;
  const isChecked = checkboxState === "checked";
  return (
    <div
      className="group relative flex w-full items-stretch rounded-[var(--radius)] transition-colors"
      style={{
        background: isChecked && !isToggleAll ? "var(--accent-soft)" : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        title={tooltip}
        disabled={disabled}
        className="flex flex-1 flex-col gap-0.5 rounded-[var(--radius)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-muted)] disabled:cursor-not-allowed"
        style={{
          color: disabled
            ? "var(--text-muted)"
            : isChecked && !isToggleAll
              ? "var(--accent)"
              : "var(--text-primary)",
          fontWeight: isChecked && !isToggleAll ? 600 : 400,
        }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 truncate text-sm">
            <CheckboxIcon state={checkboxState} disabled={disabled} />
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
            className="ml-6 flex items-baseline gap-1.5 text-[11px] tabular-nums"
            style={{
              color:
                isChecked && !isToggleAll
                  ? "var(--accent)"
                  : "var(--text-muted)",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <span className="font-semibold">{formatMoney(kpi!.venta)}</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span>{kpi!.marginPct.toFixed(1)}%</span>
          </span>
        )}
      </button>
      {/* Botón "Solo" — visible al hover, selecciona SOLO este territorio */}
      {onSelectOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectOnly();
          }}
          aria-label={`Seleccionar solo ${label}`}
          title={`Solo ${label}`}
          className="my-1 mr-1 hidden items-center rounded px-2 text-[10px] font-semibold uppercase tracking-wider transition-colors group-hover:flex hover:bg-[var(--accent-soft)]"
          style={{
            color: "var(--accent)",
          }}
        >
          Solo
        </button>
      )}
    </div>
  );
}

function CheckboxIcon({
  state,
  disabled,
}: {
  state: CheckboxState;
  disabled: boolean;
}) {
  // Tamaño consistente para alineación del texto. Color según estado.
  const color = disabled
    ? "var(--text-muted)"
    : state === "checked"
      ? "var(--accent)"
      : state === "partial"
        ? "var(--accent)"
        : "var(--text-muted)";
  if (state === "checked") {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
        style={{
          background: color,
          borderColor: color,
        }}
      >
        <Check size={11} style={{ color: "white" }} strokeWidth={3} />
      </span>
    );
  }
  if (state === "partial") {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
        style={{
          background: color,
          borderColor: color,
        }}
      >
        <span
          className="h-0.5 w-2.5 rounded-sm"
          style={{ background: "white" }}
        />
      </span>
    );
  }
  return (
    <Square
      size={16}
      strokeWidth={1.5}
      style={{ color, flexShrink: 0 }}
    />
  );
}
