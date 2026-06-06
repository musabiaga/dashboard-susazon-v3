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
import { ClientesProductosTab } from "@/components/dashboard/ClientesProductosTab";
import { VendedoresTab } from "@/components/dashboard/VendedoresTab";
import {
  PerdidosTab,
  type PerdidoRow,
} from "@/components/dashboard/PerdidosTab";
import { MonthSelector } from "@/components/dashboard/MonthSelector";
import { DaySelector } from "@/components/dashboard/DaySelector";
import { SessionSecurityProvider } from "@/components/dashboard/SessionSecurityProvider";
import { InsightsTab } from "@/components/dashboard/InsightsTab";
import { AlertCircle, Clock } from "lucide-react";
import {
  aggregateKpis,
  aggregateDimensionRows,
  aggregatePerdidoRows,
  aggregateBudget,
  selectedKpis,
  rowsBySelected,
} from "@/lib/aggregate";
import type { BuildReportInput } from "@/lib/report-pdf/data";
import type { ReportMode } from "@/lib/report-pdf/types";
import { REPORT_TERRITORIES } from "@/lib/report-pdf/types";

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
  /** Día calendario "hoy" CDMX (para el CutoffToggle). */
  actualTodayDay: number;
  /** Día seleccionado vía ?asOf= (null = "Hoy" default). */
  asOfDay: number | null;
  /** Último día del mes en curso con venta > 0 globalmente. null = no hay
   *  venta este mes todavía. Usado para mostrar el CutoffToggle solo cuando
   *  hay desfase data-vs-calendario. */
  lastDayWithSale: number | null;
  /** Días del mes seleccionado con venta > 0 (para el DaySelector). */
  daysWithSale: number[];
  /** Día máximo seleccionable en el DaySelector: hoy CDMX (mes actual) o fin
   *  de mes (histórico). */
  maxAsOfDay: number;
  /** Permiso para descargar Excel desde los tabs (de users_permissions.can_export_excel). */
  canExportExcel: boolean;
  /** Setting global de timeout de inactividad (de app_settings). null = sin timeout. */
  sessionIdleTimeoutMinutes: number | null;
  /** Flag del usuario actual: si true, el timeout no le aplica. */
  sessionTimeoutExempt: boolean;
  /** Fecha ISO "hoy - 90 días" (CDMX). Cliente "Nuevo" en Perdidos si su
   *  first_purchase_date >= este cutoff. */
  newCustomerCutoffDate: string;
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
  actualTodayDay,
  asOfDay,
  lastDayWithSale,
  daysWithSale,
  maxAsOfDay,
  canExportExcel,
  sessionIdleTimeoutMinutes,
  sessionTimeoutExempt,
  newCustomerCutoffDate,
}: DashboardClientProps) {
  // Selección uni-select del sidebar: "" = modo "Todos", o nombre = single.
  // No persiste — cada sesión arranca en "Todos" para mantener UX previa.
  const [selectedTerritory, setSelectedTerritory] = useState<string>("");

  // Mejora 7: set de territorios que incluye el modo "Todos". Se configura
  // desde el ⚙️ del sidebar. Solo se aplica cuando selectedTerritory === "".
  // Persiste en localStorage entre sesiones.
  const AGGREGATED_KEY = "dashboard-aggregated-territories";
  const activeTerritoryNames = useMemo(
    () => territories.filter((t) => t.isActive).map((t) => t.name),
    [territories]
  );
  const [aggregatedTerritories, setAggregatedTerritories] = useState<
    Set<string>
  >(() => new Set(activeTerritoryNames));

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AGGREGATED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (s): s is string =>
              typeof s === "string" && activeTerritoryNames.includes(s)
          );
          // Solo usamos persistencia si tiene contenido válido, si no
          // caemos al default (todos los activos).
          if (valid.length > 0) {
            setAggregatedTerritories(new Set(valid));
          }
        }
      }
    } catch {
      // ignore — usar default
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo en mount

  // Sync localStorage cuando cambia el set agregado (después de hidratado)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        AGGREGATED_KEY,
        JSON.stringify(Array.from(aggregatedTerritories))
      );
    } catch {
      // ignore
    }
  }, [aggregatedTerritories, hydrated]);

  // Si aparecen territorios nuevos los agregamos al set de forma transparente.
  const lastActiveRef = useRef<string[]>(activeTerritoryNames);
  useEffect(() => {
    if (!hydrated) return;
    const prev = new Set(lastActiveRef.current);
    const newOnes = activeTerritoryNames.filter((n) => !prev.has(n));
    if (newOnes.length > 0) {
      setAggregatedTerritories((s) => new Set([...s, ...newOnes]));
    }
    lastActiveRef.current = activeTerritoryNames;
  }, [activeTerritoryNames, hydrated]);

  const handleToggleAggregated = (name: string) => {
    setAggregatedTerritories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const handleToggleAllAggregated = () => {
    setAggregatedTerritories((prev) => {
      const allSelected =
        prev.size === activeTerritoryNames.length &&
        activeTerritoryNames.every((n) => prev.has(n));
      return allSelected ? new Set() : new Set(activeTerritoryNames);
    });
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

  // Si seleccionado actual está apagado, fallback a "Todos" (modo agregado)
  const effectiveSelected = (() => {
    if (!selectedTerritory) return "";
    const t = territories.find((x) => x.name === selectedTerritory);
    return t && t.isActive ? selectedTerritory : "";
  })();

  // Mejora 7: derivación del estado.
  //   - "single": un territorio individual seleccionado
  //   - "aggregated-all": "Todos" + set incluye TODOS los activos (pre-agregado server)
  //   - "aggregated-custom": "Todos" + set personalizado (subset)
  //   - "aggregated-none": "Todos" + set vacío (= empty)
  const aggregatedAll =
    aggregatedTerritories.size === activeTerritoryNames.length &&
    activeTerritoryNames.every((n) => aggregatedTerritories.has(n));
  const selectionMode:
    | "single"
    | "aggregated-all"
    | "aggregated-custom"
    | "aggregated-none" = (() => {
    if (effectiveSelected !== "") return "single";
    if (aggregatedTerritories.size === 0) return "aggregated-none";
    if (aggregatedAll) return "aggregated-all";
    return "aggregated-custom";
  })();

  // KPI agregado memoizado.
  const activeKpi: TerritoryKpi = useMemo(() => {
    if (selectionMode === "single") {
      const t = territories.find((x) => x.name === effectiveSelected);
      return t?.kpi ?? aggregateKpis([]);
    }
    if (selectionMode === "aggregated-all") return totalKpi;
    if (selectionMode === "aggregated-none") return aggregateKpis([]);
    return aggregateKpis(selectedKpis(territories, aggregatedTerritories));
  }, [
    selectionMode,
    territories,
    effectiveSelected,
    totalKpi,
    aggregatedTerritories,
  ]);

  // Budget agregado
  const activeBudget: number = useMemo(() => {
    if (selectionMode === "single") {
      return (
        territories.find((t) => t.name === effectiveSelected)?.ventaBudget ?? 0
      );
    }
    if (selectionMode === "aggregated-all") return totalVentaBudget;
    if (selectionMode === "aggregated-none") return 0;
    return aggregateBudget(territories, aggregatedTerritories);
  }, [
    selectionMode,
    territories,
    effectiveSelected,
    totalVentaBudget,
    aggregatedTerritories,
  ]);

  // Etiqueta legible para header + exports
  const contextLabel = (() => {
    if (selectionMode === "single") return effectiveSelected;
    if (selectionMode === "aggregated-all") return "Todos los territorios";
    if (selectionMode === "aggregated-none")
      return "Todos (sin territorios incluidos)";
    // custom: lista comma-separated. Si son muchos, "N territorios".
    const arr = Array.from(aggregatedTerritories).sort();
    if (arr.length > 4) return `Todos (${arr.length} territorios)`;
    return `Todos (${arr.join(", ")})`;
  })();

  const exportTerritoryLabel = (() => {
    if (selectionMode === "single") return effectiveSelected;
    if (selectionMode === "aggregated-all") return "Todos";
    if (selectionMode === "aggregated-none") return "(ninguno)";
    return Array.from(aggregatedTerritories).sort().join(", ");
  })();

  // ===== Report PDF: input compartido por todos los tabs =====
  // Convertir el selectionMode interno a ReportMode (discriminated union
  // que consume buildReportData). Filtra al universo de 11 territorios.
  // Null cuando no hay nada que reportar (aggregated-none).
  const reportInput: BuildReportInput | null = useMemo(() => {
    if (selectionMode === "aggregated-none") return null;
    const reportSet = new Set<string>(REPORT_TERRITORIES);
    let mode: ReportMode;
    if (selectionMode === "single") {
      if (!reportSet.has(effectiveSelected)) return null; // territorio fuera del scope
      mode = { kind: "single", territory: effectiveSelected };
    } else if (selectionMode === "aggregated-all") {
      const all = activeTerritoryNames.filter((n) => reportSet.has(n));
      if (all.length === 0) return null;
      mode = { kind: "all", territories: all };
    } else {
      // aggregated-custom
      const sel = Array.from(aggregatedTerritories)
        .filter((n) => reportSet.has(n))
        .sort();
      if (sel.length === 0) return null;
      const label =
        sel.length <= 2
          ? sel.join(", ")
          : `${sel.length} territorios seleccionados`;
      mode = { kind: "multi", territories: sel, label };
    }
    return {
      territories,
      selectedKpi: activeKpi,
      selectedBudget: activeBudget,
      mode,
      currentYear,
      currentMonth,
      daysCurrent,
      elapsedBizDays,
      totalBizDays,
      clientes,
    };
  }, [
    selectionMode,
    effectiveSelected,
    activeTerritoryNames,
    aggregatedTerritories,
    territories,
    activeKpi,
    activeBudget,
    currentYear,
    currentMonth,
    daysCurrent,
    elapsedBizDays,
    totalBizDays,
    clientes,
  ]);

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
      {/* Security: idle timeout + remote logout polling. Componente cliente
          que no renderiza nada visible salvo cuando el warning modal aplica. */}
      <SessionSecurityProvider
        sessionIdleTimeoutMinutes={sessionIdleTimeoutMinutes}
        sessionTimeoutExempt={sessionTimeoutExempt}
      />
      <Sidebar
        territories={territories}
        selected={effectiveSelected}
        onSelect={setSelectedTerritory}
        totalKpi={
          // Cuando "Todos" usa el subset agregado, mostramos su KPI; si no,
          // mostramos el total del server pre-agregado.
          selectionMode === "aggregated-custom" ||
          selectionMode === "aggregated-none"
            ? activeKpi
            : totalKpi
        }
        aggregatedTerritories={aggregatedTerritories}
        onToggleAggregated={handleToggleAggregated}
        onToggleAllAggregated={handleToggleAllAggregated}
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

          {/* Contexto actual + selector de mes + (opcional) toggle de corte */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {contextLabel}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle "Cierre vs Hoy" — solo si la data llega antes que
                  el día calendario (típico al refrescar en la mañana).
                  No aplica en histórico ni cuando ya hay venta de hoy. */}
              {/* Selector de día libre — ver el dashboard al cierre de
                  cualquier día del mes seleccionado (Mejora 1). Reemplaza al
                  antiguo CutoffToggle: incluye "Hoy" + el último día con venta
                  + cualquier día arbitrario, todo en un solo control. */}
              <DaySelector
                currentYear={currentYear}
                currentMonth={currentMonth}
                asOfDay={asOfDay}
                maxAsOfDay={maxAsOfDay}
                daysWithSale={daysWithSale}
                isHistorical={isHistorical}
                lastDayWithSale={lastDayWithSale}
              />
              <MonthSelector
                currentYear={currentYear}
                currentMonth={currentMonth}
                todayYear={todayYear}
                todayMonth={todayMonth}
                monthsBack={24}
              />
            </div>
          </div>

          {/* KPIs del mes actual — Todos o del territorio seleccionado */}
          <KpiCardsRow data={activeKpiData} loading={false} />

          {/* Tabs */}
          <DashboardTabs active={activeTab} onChange={setActiveTab}>
            {(() => {
              // Resolución de rows según el modo de selección.
              //   single             → ese territorio directo
              //   aggregated-all     → pre-agregado del server (rápido)
              //   aggregated-custom  → agregar dinámicamente el subset
              //   aggregated-none    → vacío
              const resolveDimRows = (
                ds: DimensionDataset
              ): DimensionRow[] => {
                if (selectionMode === "single")
                  return ds.byTerritory[effectiveSelected] ?? [];
                if (selectionMode === "aggregated-all") return ds.total;
                if (selectionMode === "aggregated-none") return [];
                return aggregateDimensionRows(
                  rowsBySelected(ds.byTerritory, aggregatedTerritories)
                );
              };
              const resolvePerdidoRows = (): PerdidoRow[] => {
                if (selectionMode === "single")
                  return perdidos.byTerritory[effectiveSelected] ?? [];
                if (selectionMode === "aggregated-all") return perdidos.total;
                if (selectionMode === "aggregated-none") return [];
                return aggregatePerdidoRows(
                  rowsBySelected(perdidos.byTerritory, aggregatedTerritories)
                );
              };

              if (activeTab === "tracking") {
                // Territorios efectivos según el sidebar (mismo cálculo que
                // Clientes/Insights) — para el card de Variedad (Fase 10).
                const trackingTerritorios: string[] | null =
                  selectionMode === "single"
                    ? [effectiveSelected]
                    : selectionMode === "aggregated-custom"
                      ? Array.from(aggregatedTerritories)
                      : selectionMode === "aggregated-none"
                        ? []
                        : null; // aggregated-all → no filtrar
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
                    daysCurrent={daysCurrent}
                    variedadTerritorios={trackingTerritorios}
                    territorio={exportTerritoryLabel}
                    canExportExcel={canExportExcel}
                    reportInput={reportInput}
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
                    canExportExcel={canExportExcel}
                    reportInput={reportInput}
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
                    canExportExcel={canExportExcel}
                    reportInput={reportInput}
                    modeStorageKey="grupo-tab-mode"
                  />
                );
              }
              if (activeTab === "clientes-productos") {
                // Tab unificado (Fase 1): toggle maestro Clientes | Productos.
                // Cada vista conserva TODAS sus features actuales; el
                // contenedor solo alterna entre ellas (solo la activa se monta).
                // Territorios efectivos según el sidebar (mismo cálculo que
                // Insights) — para los fetches lazy de la vista Clientes.
                const clientesTerritorios: string[] | null =
                  selectionMode === "single"
                    ? [effectiveSelected]
                    : selectionMode === "aggregated-custom"
                      ? Array.from(aggregatedTerritories)
                      : selectionMode === "aggregated-none"
                        ? []
                        : null; // aggregated-all → no filtrar
                return (
                  <ClientesProductosTab
                    clienteView={
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
                        canExportExcel={canExportExcel}
                        reportInput={reportInput}
                        modeStorageKey="clientes-tab-mode"
                        enableEvolution
                        evolutionContext={{
                          year: currentYear,
                          month: currentMonth,
                          territorios: clientesTerritorios,
                        }}
                        evolutionStorageKey="clientes-chart-view"
                        enableProductSearch
                        productOptions={resolveDimRows(skus).map((r) => r.name)}
                        productSearchContext={{
                          year: currentYear,
                          month: currentMonth,
                          daysCurrent,
                          territorios: clientesTerritorios,
                        }}
                        enableTableViews
                        tableViewsContext={{
                          year: currentYear,
                          month: currentMonth,
                          territorios: clientesTerritorios,
                          daysCurrent,
                          elapsedBizDays,
                        }}
                        enableRowExpand
                        rowExpandContext={{
                          year: currentYear,
                          month: currentMonth,
                          daysCurrent,
                          territorios: clientesTerritorios,
                        }}
                      />
                    }
                    productoView={
                      <ProductosTab
                        rows={resolveDimRows(skus)}
                        monthLabel24={prev2MonthShortYY}
                        monthLabel25={prevMonthShortYY}
                        monthLabel26={monthShortYY}
                        exportTerritory={exportTerritoryLabel}
                        exportPeriodLabel={monthShortYY}
                        canExportExcel={canExportExcel}
                        reportInput={reportInput}
                      />
                    }
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
                    canExportExcel={canExportExcel}
                    newCustomerCutoffDate={newCustomerCutoffDate}
                    reportInput={reportInput}
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
                    canExportExcel={canExportExcel}
                    reportInput={reportInput}
                  />
                );
              }
              if (activeTab === "insights") {
                // Calcular qué territorios pasar al tab Insights según
                // el modo del sidebar:
                //  - single: solo ese territorio
                //  - aggregated-custom: el subset configurado
                //  - aggregated-all: NULL = todos los visibles (no filtra)
                //  - aggregated-none: array vacío = 0 resultados
                const insightsTerritorios: string[] | null =
                  selectionMode === "single"
                    ? [effectiveSelected]
                    : selectionMode === "aggregated-custom"
                      ? Array.from(aggregatedTerritories)
                      : selectionMode === "aggregated-none"
                        ? []
                        : null; // aggregated-all → no filtrar
                return (
                  <InsightsTab
                    today={{
                      year: todayYear,
                      month: todayMonth,
                      day: actualTodayDay,
                    }}
                    territorios={insightsTerritorios}
                    contextLabel={contextLabel}
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
