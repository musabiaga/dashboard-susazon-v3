"use client";

import { useMemo, useState } from "react";
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
import { AlertCircle } from "lucide-react";

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
}: DashboardClientProps) {
  const [selectedTerritory, setSelectedTerritory] = useState<string>(""); // "" = Todos
  const [activeTab, setActiveTab] = useState<TabKey>("tracking");

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
    // Run-Rate: solo mostrar si daysCurrent >= 5 — antes hay muy poca data
    // para una proyección lineal confiable (varía mucho por día).
    const factor = daysTotal / Math.max(daysCurrent, 1);
    const showRunRate = daysCurrent >= 5 && kpi.venta > 0;
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
            daysCurrent,
            daysTotal,
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
    daysCurrent,
    daysTotal,
  ]);

  return (
    <div className="flex flex-1">
      <Sidebar
        territories={territories}
        selected={effectiveSelected}
        onSelect={setSelectedTerritory}
        totalKpi={totalKpi}
      />

      <main className="flex-1 overflow-x-hidden p-6">
        <div className="mx-auto max-w-7xl space-y-4">
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

          {/* Contexto actual */}
          <div className="flex items-baseline justify-between gap-3">
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {contextLabel}
            </h1>
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {currentMonthLabel}
            </span>
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
