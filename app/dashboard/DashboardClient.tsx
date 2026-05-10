"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type Territory, type TerritoryKpi } from "@/components/dashboard/Sidebar";
import { KpiCardsRow, type KpiData } from "@/components/dashboard/KpiCardsRow";
import { DashboardTabs, TAB_LABELS, type TabKey } from "@/components/dashboard/DashboardTabs";
import { PlaceholderTab } from "@/components/dashboard/PlaceholderTab";
import { TrackingDiarioTab } from "@/components/dashboard/TrackingDiarioTab";
import { VentasTab } from "@/components/dashboard/VentasTab";
import {
  DimensionTab,
  type DimensionRow,
} from "@/components/dashboard/DimensionTab";
import { ProductosTab } from "@/components/dashboard/ProductosTab";
import { VendedoresTab } from "@/components/dashboard/VendedoresTab";
import {
  PerdidosTab,
  type PerdidoRow,
} from "@/components/dashboard/PerdidosTab";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { AlertCircle, Clock } from "lucide-react";
import {
  aggregateKpis,
  aggregateDimensionRows,
  aggregatePerdidoRows,
  aggregateBudget,
  selectedKpis,
  rowsBySelected,
} from "@/lib/aggregate";

interface DimensionDataset {
  byTerritory: Record<string, DimensionRow[]>;
  total: DimensionRow[];
}

interface DashboardClientProps {
  territories: Territory[];
  totalKpi: TerritoryKpi;
  totalVentaBudget: number;
  // Nombre del mes actual ya formateado en el server, para evitar timezone issues
  currentMonthLabel: string;
  monthShortYY: string; // "Abr 26"
  prevMonthShortYY: string; // "Abr 25"
  prev2MonthShortYY: string; // "Abr 24"
  acumYears: number[]; // ej: [2024, 2025, 2026]
  // Para Run-Rate (calendario): día actual y días totales del mes
  daysCurrent: number;
  daysTotal: number;
  // Para Tracking Diario (días hábiles L-S menos feriados LFT)
  elapsedBizDays: number;
  totalBizDays: number;
  currentYear: number;
  currentMonth: number; // 1-12
  // Tab Grupo Producto
  grupos: DimensionDataset;
  // Tab Productos
  skus: DimensionDataset;
  // Tab Clientes
  clientes: DimensionDataset;
  // Tab Vendedores: 2 datasets para toggle Sus/Suve
  vendedores: {
    separados: DimensionDataset;
    unidos: DimensionDataset;
  };
  // Tab Perdidos
  perdidos: {
    byTerritory: Record<string, PerdidoRow[]>;
    total: PerdidoRow[];
  };
  /** True si el mes seleccionado NO es el mes actual (vista histórica). */
  isHistorical: boolean;
  /** Año "hoy" CDMX (para el MonthSelector). */
  todayYear: number;
  /** Mes "hoy" CDMX 1-12 (para el MonthSelector). */
  todayMonth: number;
}

/**
 * Cliente principal del dashboard — gestiona el estado de:
 *   - territorio seleccionado (sidebar)
 *   - tab activo
 *
 * El layout es: Sidebar (izquierda) + Main (KPIs + Tabs).
 *
 * Los KPIs se conectarán a /api/data/snapshot en 2c-ii. Por ahora muestran
 * placeholders. El contenido de cada tab se implementa en 2d/Fase 3.
 */
export function DashboardClient({
  territories,
  totalKpi,
  totalVentaBudget,
  currentMonthLabel,
  monthShortYY,
  prevMonthShortYY,
  prev2MonthShortYY,
  acumYears,
  daysCurrent,
  daysTotal,
  elapsedBizDays,
  totalBizDays,
  currentYear,
  currentMonth,
  grupos,
  skus,
  clientes,
  vendedores,
  perdidos,
  isHistorical,
  todayYear,
  todayMonth,
}: DashboardClientProps) {
  // Mejora 7: multi-select de territorios global. Set vacío = ninguno.
  // Default = TODOS los territorios activos seleccionados (equivalente al
  // antiguo "Todos"). Persistencia en localStorage.
  const SELECTED_KEY = "dashboard-selected-territories";
  const activeTerritoryNames = useMemo(
    () =>
      territories
        .filter((t) => t.isActive)
        .map((t) => t.name),
    [territories]
  );
  const [selectedTerritories, setSelectedTerritories] = useState<Set<string>>(
    () => new Set(activeTerritoryNames)
  );
  // Hidratación cliente-side desde localStorage. Si la persistencia es
  // inválida (territorios renombrados, apagados, etc.) cae al default.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SELECTED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (s): s is string =>
              typeof s === "string" && activeTerritoryNames.includes(s)
          );
          if (valid.length > 0) {
            setSelectedTerritories(new Set(valid));
          }
        }
      }
    } catch {
      // ignore — usar default
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo en mount

  // Sync localStorage cada vez que cambia la selección (después de hidratado)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        SELECTED_KEY,
        JSON.stringify(Array.from(selectedTerritories))
      );
    } catch {
      // ignore
    }
  }, [selectedTerritories, hydrated]);

  // Si aparecen territorios nuevos (ej: admin reactiva uno) los agregamos al
  // Set actual de forma transparente.
  const lastActiveRef = useRef<string[]>(activeTerritoryNames);
  useEffect(() => {
    if (!hydrated) return;
    const prev = new Set(lastActiveRef.current);
    const newOnes = activeTerritoryNames.filter((n) => !prev.has(n));
    if (newOnes.length > 0) {
      setSelectedTerritories((s) => new Set([...s, ...newOnes]));
    }
    lastActiveRef.current = activeTerritoryNames;
  }, [activeTerritoryNames, hydrated]);

  const handleToggleTerritory = (name: string) => {
    setSelectedTerritories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const handleToggleAll = () => {
    setSelectedTerritories((prev) => {
      // Si todos están seleccionados → limpiar. Si hay alguno desmarcado o
      // vacío → marcar todos los activos.
      const allSelected =
        prev.size === activeTerritoryNames.length &&
        activeTerritoryNames.every((n) => prev.has(n));
      return allSelected ? new Set() : new Set(activeTerritoryNames);
    });
  };
  const handleSelectOnly = (name: string) => {
    setSelectedTerritories(new Set([name]));
  };

  const [activeTab, setActiveTab] = useState<TabKey>("tracking");

  // Estado de sidebar collapsible. Default = abierto.
  // Se persiste en localStorage para que recuerde la preferencia del usuario
  // entre sesiones. Lectura via useEffect (no SSR) para evitar mismatch hidratación.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dashboard-sidebar-collapsed");
      if (saved === "true") setSidebarCollapsed(true);
    } catch {
      // localStorage no disponible (modo incognito estricto, etc.) — usar default
    }
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          "dashboard-sidebar-collapsed",
          next ? "true" : "false"
        );
      } catch {
        // ignore
      }
      return next;
    });
  };

  const disabledTerritories = territories.filter((t) => !t.isActive);

  // Mejora 7: derivación del estado agregado a partir del Set de selección.
  // Casos optimizados:
  //   - "all": todos los activos seleccionados → usar pre-agregados del server
  //   - "single": exactamente 1 → tomar ese territorio directo
  //   - "multi": 2+ pero no todos → agregar dinámicamente en cliente
  //   - "none": 0 seleccionados → mostrar empty state
  const selectionMode: "all" | "single" | "multi" | "none" = (() => {
    if (selectedTerritories.size === 0) return "none";
    if (
      selectedTerritories.size === activeTerritoryNames.length &&
      activeTerritoryNames.every((n) => selectedTerritories.has(n))
    )
      return "all";
    if (selectedTerritories.size === 1) return "single";
    return "multi";
  })();
  const singleSelected: string =
    selectionMode === "single"
      ? Array.from(selectedTerritories)[0]
      : "";

  // KPI agregado de los territorios seleccionados (memoizado).
  const activeKpi: TerritoryKpi = useMemo(() => {
    if (selectionMode === "all") return totalKpi;
    if (selectionMode === "none") return aggregateKpis([]);
    if (selectionMode === "single") {
      const t = territories.find((x) => x.name === singleSelected);
      return t?.kpi ?? aggregateKpis([]);
    }
    return aggregateKpis(selectedKpis(territories, selectedTerritories));
  }, [selectionMode, totalKpi, territories, selectedTerritories, singleSelected]);

  // Budget agregado
  const activeBudget: number = useMemo(() => {
    if (selectionMode === "all") return totalVentaBudget;
    if (selectionMode === "none") return 0;
    if (selectionMode === "single") {
      return (
        territories.find((t) => t.name === singleSelected)?.ventaBudget ?? 0
      );
    }
    return aggregateBudget(territories, selectedTerritories);
  }, [
    selectionMode,
    totalVentaBudget,
    territories,
    selectedTerritories,
    singleSelected,
  ]);

  // Etiqueta legible para mostrar en el header + pasar a exports
  const contextLabel = (() => {
    if (selectionMode === "none") return "Sin territorios seleccionados";
    if (selectionMode === "all") return "Todos los territorios";
    if (selectionMode === "single") return singleSelected;
    // multi: lista comma-separated. Si son muchos, usar "N territorios".
    const arr = Array.from(selectedTerritories).sort();
    if (arr.length > 4) return `${arr.length} territorios`;
    return arr.join(", ");
  })();

  // Etiqueta para los exports (más compacta — usa "Todos" en all)
  const exportTerritoryLabel = (() => {
    if (selectionMode === "none") return "(ninguno)";
    if (selectionMode === "all") return "Todos";
    if (selectionMode === "single") return singleSelected;
    return Array.from(selectedTerritories).sort().join(", ");
  })();

  // KPI cards data (mismo cálculo de antes pero usando activeKpi/activeBudget)
  const activeKpiData: KpiData = useMemo(() => {
    const kpi = activeKpi;
    const ventaBudget = activeBudget;
    // Run-Rate: usa días HÁBILES (L-S menos feriados LFT), NO calendario.
    // Antes usaba días calendario, lo que subestimaba la velocidad real porque
    // dividía la venta por días que el negocio no opera (domingos + feriados).
    // Ejemplo: si llevas $25M en día calendario 7 (= día hábil 5), proyección:
    //   - Calendario: 25/7 × 30 = $107M (subestimado, divide por días no
    //     vendidos)
    //   - Hábil:      25/5 × 26 = $130M (real, refleja ritmo de venta)
    // Mostrar Run-Rate solo si elapsedBizDays >= 4 (suficiente data para
    // proyección lineal confiable; antes usábamos 5 días calendario ≈ 4 hábiles).
    const factor = totalBizDays / Math.max(elapsedBizDays, 1);
    const showRunRate = elapsedBizDays >= 4 && kpi.venta > 0;
    return {
      venta: kpi.venta,
      margen: kpi.margen,
      kg: kpi.kg,
      marginPct: kpi.marginPct,
      monthLabel: currentMonthLabel,
      monthShortYY,
      prevMonthShortYY,
      prevYear: kpi.prevYear,
      acumByYear: kpi.acumByYear,
      acumYears,
      runRate: showRunRate
        ? {
            venta: kpi.venta * factor,
            margen: kpi.margen * factor,
            kg: kpi.kg * factor,
            // Días hábiles transcurridos / totales (NO calendario)
            daysCurrent: elapsedBizDays,
            daysTotal: totalBizDays,
          }
        : null,
      ventaBudget,
    };
  }, [
    activeKpi,
    activeBudget,
    currentMonthLabel,
    monthShortYY,
    prevMonthShortYY,
    acumYears,
    elapsedBizDays,
    totalBizDays,
  ]);

  return (
    <div className="flex flex-1">
      <Sidebar
        territories={territories}
        selected={selectedTerritories}
        onToggle={handleToggleTerritory}
        onToggleAll={handleToggleAll}
        onSelectOnly={handleSelectOnly}
        totalKpi={totalKpi}
        selectedKpi={activeKpi}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
      />

      <main className="flex-1 overflow-x-hidden p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Banner cuando se está viendo un mes histórico (no el actual) */}
          {isHistorical && (
            <div
              className="flex items-center justify-between gap-2 rounded-[var(--radius)] border px-4 py-3 text-xs"
              style={{
                background: "var(--warning-soft)",
                borderColor: "var(--warning)",
                color: "var(--text-primary)",
              }}
            >
              <div className="flex items-start gap-2">
                <Clock
                  size={14}
                  className="mt-0.5 shrink-0"
                  style={{ color: "var(--warning)" }}
                />
                <span>
                  <strong>Estás viendo un mes histórico</strong>
                  {" — "}
                  <strong>{currentMonthLabel}</strong>. Los datos son de un
                  período cerrado y pueden no reflejar la operación actual.
                </span>
              </div>
              <Link
                href="/dashboard"
                className="rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[var(--warning)] hover:text-white"
                style={{
                  borderColor: "var(--warning)",
                  color: "var(--warning)",
                }}
              >
                Volver al mes actual
              </Link>
            </div>
          )}

          {disabledTerritories.length > 0 && (
            <div
              className="flex items-start gap-2 rounded-[var(--radius)] border px-4 py-3 text-xs"
              style={{
                background: "var(--warning-soft)",
                borderColor: "var(--warning)",
                color: "var(--text-primary)",
              }}
            >
              <AlertCircle
                size={14}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--warning)" }}
              />
              <span>
                <strong>Aviso:</strong>{" "}
                {disabledTerritories.length === 1
                  ? `El territorio ${disabledTerritories[0].name} está`
                  : `${disabledTerritories.length} territorios están`}{" "}
                temporalmente apagados por el administrador.
              </span>
            </div>
          )}

          {/* Contexto actual + selector de mes */}
          <div className="flex items-center justify-between gap-3">
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {contextLabel}
            </h1>
            <MonthSelector
              currentYear={currentYear}
              currentMonth={currentMonth}
              todayYear={todayYear}
              todayMonth={todayMonth}
              monthsBack={24}
            />
          </div>

          {/* KPIs del mes actual — Todos o del territorio seleccionado */}
          <KpiCardsRow data={activeKpiData} loading={false} />

          {/* Tabs */}
          <DashboardTabs active={activeTab} onChange={setActiveTab}>
            {(() => {
              // Helper inline para resolver rows según selectionMode.
              // En "all" usa el pre-agregado (rápido); en "single" toma directo;
              // en "multi"/"none" agrega dinámicamente.
              const resolveDimRows = (
                ds: DimensionDataset
              ): DimensionRow[] => {
                if (selectionMode === "all") return ds.total;
                if (selectionMode === "none") return [];
                if (selectionMode === "single")
                  return ds.byTerritory[singleSelected] ?? [];
                return aggregateDimensionRows(
                  rowsBySelected(ds.byTerritory, selectedTerritories)
                );
              };
              const resolvePerdidoRows = (): PerdidoRow[] => {
                if (selectionMode === "all") return perdidos.total;
                if (selectionMode === "none") return [];
                if (selectionMode === "single")
                  return perdidos.byTerritory[singleSelected] ?? [];
                return aggregatePerdidoRows(
                  rowsBySelected(perdidos.byTerritory, selectedTerritories)
                );
              };

              if (activeTab === "tracking") {
                return (
                  <TrackingDiarioTab
                    kpi={activeKpi}
                    ventaBudget={activeBudget}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                    monthShortYY={monthShortYY}
                    prevMonthShortYY={prevMonthShortYY}
                    elapsedBizDays={elapsedBizDays}
                    totalBizDays={totalBizDays}
                    territorio={exportTerritoryLabel}
                  />
                );
              }
              if (activeTab === "ventas") {
                return (
                  <VentasTab
                    kpi={activeKpi}
                    cutoffYear={currentYear}
                    cutoffMonth={currentMonth}
                    exportTerritory={exportTerritoryLabel}
                    exportPeriodLabel={monthShortYY}
                  />
                );
              }
              if (activeTab === "grupo") {
                return (
                  <DimensionTab
                    rows={resolveDimRows(grupos)}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                    dimensionLabel="Grupo"
                    dimensionLabelPlural="Grupos"
                    topNChart={10}
                    showKg
                    exportTabName="GrupoProducto"
                    exportPeriodLabel={monthShortYY}
                    exportTerritory={exportTerritoryLabel}
                  />
                );
              }
              if (activeTab === "productos") {
                return (
                  <ProductosTab
                    rows={resolveDimRows(skus)}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                    exportTerritory={exportTerritoryLabel}
                    exportPeriodLabel={monthShortYY}
                  />
                );
              }
              if (activeTab === "clientes") {
                return (
                  <DimensionTab
                    rows={resolveDimRows(clientes)}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                    dimensionLabel="Cliente"
                    dimensionLabelPlural="Clientes"
                    topNChart={10}
                    topNTable={50}
                    showKg
                    enableMultiSelect
                    selectionStorageKey="clientes-selected"
                    multiSelectMaxItems={15}
                    multiSelectPlaceholder="Buscar cliente…"
                    exportTabName="Clientes"
                    exportPeriodLabel={monthShortYY}
                    exportTerritory={exportTerritoryLabel}
                  />
                );
              }
              if (activeTab === "perdidos") {
                // Mejora 7: ya no hay TerritoryFilter local. El sidebar es la
                // fuente única; pasamos los rows ya agregados.
                return (
                  <PerdidosTab
                    rows={resolvePerdidoRows()}
                    monthShortYY={monthShortYY}
                    prevMonthShortYY={prevMonthShortYY}
                    currentTerritory={exportTerritoryLabel}
                  />
                );
              }
              if (activeTab === "vendedores") {
                return (
                  <VendedoresTab
                    rowsSeparados={resolveDimRows(vendedores.separados)}
                    rowsUnidos={resolveDimRows(vendedores.unidos)}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                    exportPeriodLabel={monthShortYY}
                    exportTerritory={exportTerritoryLabel}
                  />
                );
              }
              return (
                <PlaceholderTab
                  title={TAB_LABELS[activeTab]}
                  note="Contenido en construcción. Llega próximamente en Fase 3."
                />
              );
            })()}
          </DashboardTabs>
        </div>
      </main>
    </div>
  );
}
