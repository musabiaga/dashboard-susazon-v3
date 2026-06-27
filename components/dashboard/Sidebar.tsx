"use client";

import { useEffect, useRef, useState } from "react";
import {
  Layers,
  AlertTriangle,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Check,
  Megaphone,
  UserRound,
  Target,
  Tag,
  Star,
  Boxes,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

/** Resuelve el ícono (key string del agrupador) a un componente lucide. */
function agrupadorIcon(key: string | null): LucideIcon {
  switch (key) {
    case "megaphone": return Megaphone;
    case "user": return UserRound;
    case "target": return Target;
    case "tag": return Tag;
    case "star": return Star;
    case "boxes": return Boxes;
    case "flame": return Flame;
    default: return Layers;
  }
}

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
    k24: number; k25: number; k26: number;
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
  /** Agrupadores asignados al usuario actual (sección de contexto, Fase 1). */
  agrupadores?: { id: string; nombre: string; icono: string | null }[];
  /** Si true, oculta los territorios en $0 (vista limpia para KAM/restringido). */
  restrictedView?: boolean;
  /** Selección uni-select. "" = modo "Todos" (agregado). */
  selected: string;
  onSelect: (name: string) => void;
  /** KPI agregada del set "aggregatedTerritories" — se muestra junto al
   *  item "Todos" cuando hay un subset configurado. */
  totalKpi: TerritoryKpi;
  /** Mejora 7: Set de territorios que incluye el modo "Todos". */
  aggregatedTerritories: Set<string>;
  /** Toggle de un territorio dentro del set agregado. */
  onToggleAggregated: (name: string) => void;
  /** Marca/desmarca todos los activos en el set agregado. */
  onToggleAllAggregated: () => void;
  // Estado controlado desde el padre (DashboardClient persiste en localStorage)
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Sidebar de territorios — lista filtrada por permisos vía RLS.
 *
 * UX (Mejora 7):
 *  - Lista inferior: uni-select. Click en un territorio muestra SOLO ese.
 *  - Item "Todos" arriba: modo agregado. Click selecciona modo "Todos".
 *    Junto al label, un ícono ⚙️ abre un dropdown con checkboxes para
 *    configurar QUÉ territorios incluye ese "Todos" (ej. solo costa norte).
 *    El subset se persiste en localStorage. La modificación NO afecta cuando
 *    el usuario está en un territorio individual; solo el modo "Todos".
 *
 * Soporta modo `collapsed`: cuando está cerrado se reduce a una mini-tira de
 * 44px con solo el botón para reabrir. La preferencia se persiste en
 * localStorage desde el componente padre.
 */
export function Sidebar({
  territories,
  agrupadores = [],
  restrictedView = false,
  selected,
  onSelect,
  totalKpi,
  aggregatedTerritories,
  onToggleAggregated,
  onToggleAllAggregated,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  // Vista restringida (KAM/vendedor con acceso acotado): ocultar territorios
  // sin datos ($0) para que vea solo lo suyo. Los $0 no suman al total igual.
  const shown = restrictedView
    ? territories.filter((t) => t.kpi.venta > 0)
    : territories;
  const total = shown.length;
  const activeTerritories = shown.filter((t) => t.isActive);
  const activeCount = activeTerritories.length;
  const disabledCount = shown.filter((t) => !t.isActive).length;
  const aggregatedCount = activeTerritories.filter((t) =>
    aggregatedTerritories.has(t.name)
  ).length;
  const isCustomAggregated =
    aggregatedCount > 0 && aggregatedCount < activeCount;

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

  // ===== Modo expandido: lista completa =====
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
            {total} visible{total === 1 ? "" : "s"}
            {disabledCount > 0 && ` · ${disabledCount} apagado${disabledCount === 1 ? "" : "s"}`}
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
        {/* "Todos" — modo agregado, con ⚙️ al lado para configurar el set */}
        <AggregatedItem
          selected={selected === ""}
          onClick={() => onSelect("")}
          kpi={totalKpi}
          territories={activeTerritories}
          aggregated={aggregatedTerritories}
          aggregatedCount={aggregatedCount}
          activeCount={activeCount}
          isCustomAggregated={isCustomAggregated}
          onToggleAggregated={onToggleAggregated}
          onToggleAllAggregated={onToggleAllAggregated}
        />
        <div
          className="my-2 border-t"
          style={{ borderColor: "var(--border)" }}
        />
        {shown.length === 0 && (
          <div
            className="px-3 py-2 text-xs italic"
            style={{ color: "var(--text-muted)" }}
          >
            {agrupadores.length > 0
              ? "Sin venta en el periodo para tu(s) agrupador(es)."
              : "Sin territorios visibles. Carga datos primero o pide permisos al admin."}
          </div>
        )}
        {shown.map((t) => (
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

        {/* Sección Agrupadores (contexto). La vista enfocada por agrupador
            para usuarios con acceso amplio llega en Fase 2. */}
        {agrupadores.length > 0 && (
          <>
            <div
              className="my-2 border-t"
              style={{ borderColor: "var(--border)" }}
            />
            <div className="flex items-center gap-1.5 px-3 pb-1 pt-1">
              <Layers size={12} style={{ color: "var(--accent)" }} />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Agrupadores
              </span>
            </div>
            {agrupadores.map((a) => {
              const Icon = agrupadorIcon(a.icono);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm"
                  style={{ color: "var(--text-primary)" }}
                  title="Vista enfocada del agrupador — próximamente"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    <Icon size={13} />
                  </span>
                  <span className="flex-1 truncate">{a.nombre}</span>
                </div>
              );
            })}
            <div
              className="px-3 pt-0.5 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              Tu vista ya está acotada a {agrupadores.length === 1 ? "este agrupador" : "tus agrupadores"}.
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}

/**
 * Item "Todos" — combina selección de modo agregado + un ⚙️ que abre el
 * panel para configurar qué territorios suma. Visualmente se ve como un
 * SidebarItem normal con un botón pegado al borde derecho.
 */
function AggregatedItem({
  selected,
  onClick,
  kpi,
  territories,
  aggregated,
  aggregatedCount,
  activeCount,
  isCustomAggregated,
  onToggleAggregated,
  onToggleAllAggregated,
}: {
  selected: boolean;
  onClick: () => void;
  kpi: TerritoryKpi;
  territories: Territory[];
  aggregated: Set<string>;
  aggregatedCount: number;
  activeCount: number;
  isCustomAggregated: boolean;
  onToggleAggregated: (name: string) => void;
  onToggleAllAggregated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const hasKpi = kpi && kpi.venta > 0;
  const allSelected = aggregatedCount === activeCount && activeCount > 0;
  const noneSelected = aggregatedCount === 0;
  const subtitle = allSelected
    ? `Todos los activos (${activeCount})`
    : noneSelected
      ? "Sin territorios"
      : `${aggregatedCount} de ${activeCount}`;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full items-stretch rounded-[var(--radius)] transition-colors"
      style={{
        background: selected ? "var(--accent-soft)" : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 flex-col gap-0.5 rounded-[var(--radius)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-muted)]"
        style={{
          color: selected ? "var(--accent)" : "var(--text-primary)",
          fontWeight: selected ? 600 : 400,
        }}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 truncate text-sm">
            <Layers size={14} />
            <span className="truncate">Todos</span>
            {isCustomAggregated && (
              <span
                className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{
                  background: "var(--warning-soft)",
                  color: "var(--warning)",
                }}
                title="El set 'Todos' fue personalizado"
              >
                custom
              </span>
            )}
          </span>
        </span>
        <span
          className="text-[10px]"
          style={{
            color: selected ? "var(--accent)" : "var(--text-muted)",
            opacity: 0.85,
          }}
        >
          {subtitle}
        </span>
        {hasKpi && (
          <span
            className="flex items-baseline gap-1.5 text-[11px] tabular-nums"
            style={{
              color: selected ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            <span className="font-semibold">{formatMoney(kpi.venta)}</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span>{kpi.marginPct.toFixed(1)}%</span>
          </span>
        )}
      </button>
      {/* Botón ⚙️ — abre el dropdown de configuración del set agregado */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Configurar territorios incluidos en Todos"
        title="Configurar qué territorios incluye Todos"
        className="m-1 flex w-8 shrink-0 items-center justify-center rounded transition-colors hover:bg-[var(--bg-surface)]"
        style={{
          color: open
            ? "var(--accent)"
            : isCustomAggregated
              ? "var(--warning)"
              : "var(--text-muted)",
          background: open ? "var(--bg-surface)" : "transparent",
        }}
      >
        <Settings2 size={14} />
      </button>

      {/* Dropdown con checkboxes — popup absoluto */}
      {open && (
        <div
          className="frost-popover absolute left-0 top-full z-50 mt-1 max-h-[60vh] w-[260px] overflow-y-auto rounded-[var(--radius-lg)] border shadow-lg"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          {/* Header del dropdown */}
          <div
            className="flex items-center justify-between gap-2 border-b px-3 py-2"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-surface-muted)",
            }}
          >
            <div className="flex flex-col">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Configurar &quot;Todos&quot;
              </span>
              <span
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {aggregatedCount} de {activeCount} marcados
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleAllAggregated}
              className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--bg-surface)]"
              style={{
                color: "var(--accent)",
                background: "var(--accent-soft)",
              }}
            >
              {allSelected ? "Limpiar" : "Marcar todos"}
            </button>
          </div>
          {/* Lista de checkboxes */}
          <div className="py-1">
            {territories.map((t) => {
              const checked = aggregated.has(t.name);
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => onToggleAggregated(t.name)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--bg-surface-muted)]"
                  style={{
                    color: checked
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                    fontWeight: checked ? 600 : 400,
                  }}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                    style={{
                      borderColor: checked ? "var(--accent)" : "var(--border)",
                      background: checked ? "var(--accent)" : "transparent",
                    }}
                  >
                    {checked && (
                      <Check size={11} style={{ color: "white" }} strokeWidth={3} />
                    )}
                  </span>
                  <span className="truncate flex-1">{t.name}</span>
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatMoney(t.kpi.venta)}
                  </span>
                </button>
              );
            })}
            {territories.length === 0 && (
              <div
                className="px-3 py-2 text-xs italic"
                style={{ color: "var(--text-muted)" }}
              >
                Sin territorios activos.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  label,
  selected,
  onClick,
  disabled,
  tooltip,
  kpi,
}: {
  label: string;
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
          className="flex items-baseline gap-1.5 text-[11px] tabular-nums"
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
