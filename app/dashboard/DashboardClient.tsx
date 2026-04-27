"use client";

import { useMemo, useState } from "react";
import { Sidebar, type Territory, type TerritoryKpi } from "@/components/dashboard/Sidebar";
import { KpiCardsRow, type KpiData } from "@/components/dashboard/KpiCardsRow";
import { DashboardTabs, TAB_LABELS, type TabKey } from "@/components/dashboard/DashboardTabs";
import { PlaceholderTab } from "@/components/dashboard/PlaceholderTab";
import { AlertCircle } from "lucide-react";

interface DashboardClientProps {
  territories: Territory[];
  totalKpi: TerritoryKpi;
  // Nombre del mes actual ya formateado en el server, para evitar timezone issues
  currentMonthLabel: string;
  // Para Run-Rate: día actual y días totales del mes (computados server-side
  // para coherencia con timezone México).
  daysCurrent: number;
  daysTotal: number;
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
  currentMonthLabel,
  daysCurrent,
  daysTotal,
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
    const kpi =
      effectiveSelected === ""
        ? totalKpi
        : territories.find((t) => t.name === effectiveSelected)?.kpi ?? totalKpi;
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
      runRate: showRunRate
        ? {
            venta: kpi.venta * factor,
            margen: kpi.margen * factor,
            kg: kpi.kg * factor,
            daysCurrent,
            daysTotal,
          }
        : null,
    };
  }, [
    effectiveSelected,
    territories,
    totalKpi,
    currentMonthLabel,
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
            <PlaceholderTab
              title={TAB_LABELS[activeTab]}
              note="Contenido en construcción. Llega en Fase 2d (Tracking Diario) y Fase 3 (resto de tabs con los 4 cambios funcionales pendientes)."
            />
          </DashboardTabs>
        </div>
      </main>
    </div>
  );
}
