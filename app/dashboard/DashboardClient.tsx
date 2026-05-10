"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [selectedTerritory, setSelectedTerritory] = useState<string>(""); // "" = Todos
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

  // Si seleccionado actual está apagado, fallback a Todos
  const effectiveSelected = (() => {
    if (!selectedTerritory) return "";
    const t = territories.find((x) => x.name === selectedTerritory);
    return t && t.isActive ? selectedTerritory : "";
  })();

  const contextLabel =
    effectiveSelected === "" ? "Todos los territorios" : effectiveSelected;

  // KPI activo según selección (Todos vs territorio específico)
  const activeKpiData: KpiData = useMemo(() => {
    const territory = territories.find((t) => t.name === effectiveSelected);
    const kpi = effectiveSelected === "" ? totalKpi : territory?.kpi ?? totalKpi;
    const ventaBudget =
      effectiveSelected === ""
        ? totalVentaBudget
        : territory?.ventaBudget ?? 0;
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
    effectiveSelected,
    territories,
    totalKpi,
    totalVentaBudget,
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
        selected={effectiveSelected}
        onSelect={setSelectedTerritory}
        totalKpi={totalKpi}
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
              const activeKpi =
                effectiveSelected === ""
                  ? totalKpi
                  : territories.find((t) => t.name === effectiveSelected)
                      ?.kpi ?? totalKpi;
              const activeBudget =
                effectiveSelected === ""
                  ? totalVentaBudget
                  : territories.find((t) => t.name === effectiveSelected)
                      ?.ventaBudget ?? 0;

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
                  />
                );
              }
              if (activeTab === "ventas") {
                return (
                  <VentasTab
                    kpi={activeKpi}
                    cutoffYear={currentYear}
                    cutoffMonth={currentMonth}
                  />
                );
              }
              if (activeTab === "grupo") {
                const grupoRows =
                  effectiveSelected === ""
                    ? grupos.total
                    : grupos.byTerritory[effectiveSelected] ?? [];
                return (
                  <DimensionTab
                    rows={grupoRows}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                    dimensionLabel="Grupo"
                    dimensionLabelPlural="Grupos"
                    topNChart={10}
                    showKg
                  />
                );
              }
              if (activeTab === "productos") {
                const skuRows =
                  effectiveSelected === ""
                    ? skus.total
                    : skus.byTerritory[effectiveSelected] ?? [];
                return (
                  <ProductosTab
                    rows={skuRows}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                  />
                );
              }
              if (activeTab === "clientes") {
                const clienteRows =
                  effectiveSelected === ""
                    ? clientes.total
                    : clientes.byTerritory[effectiveSelected] ?? [];
                return (
                  <DimensionTab
                    rows={clienteRows}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
                    dimensionLabel="Cliente"
                    dimensionLabelPlural="Clientes"
                    topNChart={10}
                    topNTable={50}
                    showKg
                  />
                );
              }
              if (activeTab === "perdidos") {
                const perdidoRows =
                  effectiveSelected === ""
                    ? perdidos.total
                    : perdidos.byTerritory[effectiveSelected] ?? [];
                return (
                  <PerdidosTab
                    rows={perdidoRows}
                    monthShortYY={monthShortYY}
                    prevMonthShortYY={prevMonthShortYY}
                  />
                );
              }
              if (activeTab === "vendedores") {
                const rowsSeparados =
                  effectiveSelected === ""
                    ? vendedores.separados.total
                    : vendedores.separados.byTerritory[effectiveSelected] ??
                      [];
                const rowsUnidos =
                  effectiveSelected === ""
                    ? vendedores.unidos.total
                    : vendedores.unidos.byTerritory[effectiveSelected] ?? [];
                return (
                  <VendedoresTab
                    rowsSeparados={rowsSeparados}
                    rowsUnidos={rowsUnidos}
                    monthLabel24={prev2MonthShortYY}
                    monthLabel25={prevMonthShortYY}
                    monthLabel26={monthShortYY}
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
