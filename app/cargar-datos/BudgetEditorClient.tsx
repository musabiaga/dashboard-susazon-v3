"use client";

/**
 * BudgetEditorClient — Editor de Presupuestos (PTTO) por territorio × mes.
 *
 * V4.4 (Cargar Datos "más robusto"):
 *   - Fila de referencia "Real {año-1}" bajo cada territorio con % meta vs real
 *     (toggle Mostrar/Ocultar).
 *   - Menú de acciones por territorio: copiar meta/real del año anterior +X%,
 *     repartir un total anual (parejo o con la estacionalidad real del año
 *     anterior), limpiar fila.
 *   - Paneles fijos (header + 1ª columna + TOTAL), mes en curso resaltado,
 *     aviso de territorios sin meta, Descartar cambios, aviso al salir con
 *     cambios sin guardar, "última edición por … el …".
 *   - Exportar a Excel (3 hojas: Metas, Real año anterior, Meta vs Real).
 *
 * Guardado: POST /api/budgets/bulk con SOLO las celdas modificadas (dirty).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Target,
  Calendar,
  MoreHorizontal,
  RotateCcw,
  Eye,
  EyeOff,
  Info,
  Copy,
  Divide,
  Eraser,
} from "lucide-react";
import { formatMoneyExact, formatDateTime } from "@/lib/format";
import { exportToExcelMultiSheet, todayISO, type ExcelExportOptions } from "@/lib/export-excel";
import { ExportExcelButton } from "@/components/dashboard/ExportExcelButton";

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

export interface BudgetCell {
  territorio: string;
  mes: number; // 1-12
  venta_budget: number;
}
export interface RealCell {
  territorio: string;
  mes: number;
  venta: number;
}
export interface LastEdit {
  at: string;
  by: string | null;
}

interface BudgetEditorClientProps {
  year: number;
  availableYears: number[];
  territories: string[];
  initialBudgets: BudgetCell[];
  /** Venta real del año anterior por territorio/mes (referencia). */
  prevYearReal: RealCell[];
  /** Metas del año anterior (para "copiar meta año anterior"). */
  prevYearBudgets: BudgetCell[];
  lastEdit: LastEdit | null;
  /** Mes en curso (CDMX) si el año editado es el actual; null si no. */
  currentMonth: number | null;
}

function key(t: string, m: number) {
  return `${t}|${m}`;
}

export function BudgetEditorClient({
  year,
  availableYears,
  territories,
  initialBudgets,
  prevYearReal,
  prevYearBudgets,
  lastEdit,
  currentMonth,
}: BudgetEditorClientProps) {
  const router = useRouter();
  const prevYear = year - 1;

  // Map: "territorio|mes" → venta_budget
  const initialMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of initialBudgets) m.set(key(b.territorio, b.mes), b.venta_budget);
    return m;
  }, [initialBudgets]);
  const realMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of prevYearReal) m.set(key(r.territorio, r.mes), r.venta);
    return m;
  }, [prevYearReal]);
  const prevBudgetMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of prevYearBudgets) m.set(key(b.territorio, b.mes), b.venta_budget);
    return m;
  }, [prevYearBudgets]);
  const hasReal = realMap.size > 0;

  const [budgets, setBudgets] = useState<Map<string, number>>(initialMap);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReal, setShowReal] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Si el server re-fetchea (cambio de año / router.refresh), resincronizar.
  useEffect(() => {
    setBudgets(initialMap);
    setDirty(new Set());
  }, [initialMap]);

  // Aviso del navegador al salir con cambios sin guardar.
  useEffect(() => {
    if (dirty.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty.size]);

  // Cerrar el menú de acciones al hacer click fuera.
  useEffect(() => {
    if (menuFor === null) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest("[data-rowmenu]")) setMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuFor]);

  function getCell(t: string, m: number): number {
    return budgets.get(key(t, m)) ?? 0;
  }
  function getReal(t: string, m: number): number {
    return realMap.get(key(t, m)) ?? 0;
  }
  function setCell(t: string, m: number, value: number) {
    const k = key(t, m);
    setBudgets((prev) => {
      const next = new Map(prev);
      if (value <= 0) next.delete(k);
      else next.set(k, value);
      return next;
    });
    setDirty((prev) => new Set(prev).add(k));
    setSavedAt(null);
  }
  /** Aplica 12 valores a una fila marcando dirty solo lo que cambió. */
  function applyRow(t: string, values: number[]) {
    setBudgets((prev) => {
      const next = new Map(prev);
      values.forEach((v, i) => {
        const k = key(t, i + 1);
        if (v <= 0) next.delete(k);
        else next.set(k, v);
      });
      return next;
    });
    setDirty((prev) => {
      const n = new Set(prev);
      values.forEach((v, i) => {
        const k = key(t, i + 1);
        if ((budgets.get(k) ?? 0) !== v) n.add(k);
      });
      return n;
    });
    setSavedAt(null);
    setMenuFor(null);
  }

  // Totales por fila / columna / grand total — recomputan al cambiar budgets.
  const rowTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of territories) {
      let sum = 0;
      for (const mes of MESES) sum += budgets.get(key(t, mes)) ?? 0;
      m.set(t, sum);
    }
    return m;
  }, [budgets, territories]);
  const colTotals = useMemo(() => {
    const arr: number[] = new Array(12).fill(0);
    for (const t of territories)
      for (const mes of MESES) arr[mes - 1] += budgets.get(key(t, mes)) ?? 0;
    return arr;
  }, [budgets, territories]);
  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  const realRowTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of territories) {
      let sum = 0;
      for (const mes of MESES) sum += realMap.get(key(t, mes)) ?? 0;
      m.set(t, sum);
    }
    return m;
  }, [realMap, territories]);
  const realColTotals = useMemo(() => {
    const arr: number[] = new Array(12).fill(0);
    for (const t of territories)
      for (const mes of MESES) arr[mes - 1] += realMap.get(key(t, mes)) ?? 0;
    return arr;
  }, [realMap, territories]);
  const realGrandTotal = realColTotals.reduce((a, b) => a + b, 0);

  const territoriesSinMeta = territories.filter((t) => (rowTotals.get(t) ?? 0) === 0);
  const territoriesConMeta = territories.length - territoriesSinMeta.length;

  // ---------- Acciones por fila ----------
  function askPct(): number | null {
    const s = window.prompt(
      "¿Qué % aplicar sobre la base? (ej. 8 → +8 %, -5 → -5 %, 0 → igual)",
      "8"
    );
    if (s === null) return null;
    const n = parseFloat(s.replace(",", "."));
    if (isNaN(n)) {
      window.alert("Porcentaje inválido.");
      return null;
    }
    return n;
  }
  function askTotal(t: string): number | null {
    const s = window.prompt(
      `Total anual ${year} para "${t}" (pesos, sin formato):`,
      String(rowTotals.get(t) || "")
    );
    if (s === null) return null;
    const n = parseFloat(s.replace(/[$,\s]/g, ""));
    if (isNaN(n) || n <= 0) {
      window.alert("Total inválido.");
      return null;
    }
    return n;
  }
  function copyFrom(t: string, source: "meta" | "real") {
    const base = MESES.map((m) =>
      source === "meta" ? prevBudgetMap.get(key(t, m)) ?? 0 : realMap.get(key(t, m)) ?? 0
    );
    if (base.every((v) => v === 0)) {
      window.alert(`No hay ${source === "meta" ? "meta" : "real"} ${prevYear} para "${t}".`);
      return;
    }
    const p = askPct();
    if (p === null) return;
    applyRow(t, base.map((v) => Math.round(v * (1 + p / 100))));
  }
  function distribute(t: string, mode: "parejo" | "estacional") {
    let weights: number[];
    if (mode === "parejo") {
      weights = new Array(12).fill(1 / 12);
    } else {
      const real = MESES.map((m) => realMap.get(key(t, m)) ?? 0);
      const sum = real.reduce((a, b) => a + b, 0);
      if (sum <= 0) {
        window.alert(`No hay real ${prevYear} para "${t}" — usa el reparto parejo.`);
        return;
      }
      weights = real.map((v) => v / sum);
    }
    const total = askTotal(t);
    if (total === null) return;
    const values = weights.map((w) => Math.round(total * w));
    // Corregir redondeo en el último mes con peso para que la suma cierre exacta.
    const diff = Math.round(total) - values.reduce((a, b) => a + b, 0);
    if (diff !== 0) {
      let idx = 11;
      while (idx > 0 && weights[idx] === 0) idx--;
      values[idx] += diff;
    }
    applyRow(t, values);
  }
  function clearRow(t: string) {
    if (!window.confirm(`¿Limpiar las 12 metas de "${t}"? (se guarda al dar Guardar)`)) return;
    applyRow(t, new Array(12).fill(0));
  }

  // ---------- Año / guardar / descartar ----------
  function handleYearChange(newYear: number) {
    if (dirty.size > 0) {
      const ok = confirm(
        `Hay ${dirty.size} cambios sin guardar. Cambiar de año los descarta. ¿Continuar?`
      );
      if (!ok) return;
    }
    router.push(`/cargar-datos?year=${newYear}`);
  }
  function handleDiscard() {
    if (dirty.size === 0) return;
    if (!confirm(`¿Descartar ${dirty.size} cambio(s) sin guardar?`)) return;
    setBudgets(initialMap);
    setDirty(new Set());
    setError(null);
    setSavedAt(null);
  }
  async function handleSave() {
    if (dirty.size === 0 || saving) return;
    setSaving(true);
    setError(null);
    const dirtyRows = Array.from(dirty).map((k) => {
      const [territorio, mesStr] = k.split("|");
      return {
        territorio,
        anio: year,
        mes: parseInt(mesStr, 10),
        venta_budget: budgets.get(k) ?? 0,
      };
    });
    try {
      const res = await fetch("/api/budgets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: dirtyRows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      setSavedAt(new Date());
      setDirty(new Set());
      setSaving(false);
      router.refresh(); // server re-fetch para que dashboard refleje cambios
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
      setSaving(false);
    }
  }

  // ---------- Excel ----------
  async function handleExport() {
    const monthCols = MONTHS_SHORT.map((m, i) => ({
      header: `${m} ${year}`,
      key: `m${i + 1}`,
      width: 14,
      numFmt: "$#,##0",
    }));
    const columns = [
      { header: "Territorio", key: "territorio", width: 30 },
      ...monthCols,
      { header: `Total ${year}`, key: "total", width: 18, numFmt: "$#,##0" },
    ];
    const rowOf = (t: string, get: (m: number) => number, total: number) => {
      const r: Record<string, unknown> = { territorio: t };
      MESES.forEach((m) => {
        const v = get(m);
        r[`m${m}`] = v > 0 ? v : null;
      });
      r.total = total;
      return r;
    };
    const subtitle = `Grupo Susazón · ${territories.length} territorios · generado ${todayISO()}${
      dirty.size > 0 ? " · incluye cambios SIN guardar" : ""
    }`;
    const sheets: Array<Omit<ExcelExportOptions, "fileName">> = [
      {
        sheetName: `Metas ${year}`,
        title: `Metas de venta (PTTO) ${year}`,
        subtitle,
        summary: [
          { label: "Total anual", value: grandTotal, numFmt: "$#,##0" },
          { label: "Promedio mensual", value: Math.round(grandTotal / 12), numFmt: "$#,##0" },
          { label: "Territorios con meta", value: `${territoriesConMeta} de ${territories.length}` },
          ...(hasReal
            ? [{ label: `vs real ${prevYear}`, value: realGrandTotal > 0 ? grandTotal / realGrandTotal - 1 : 0, numFmt: "+0.0%;-0.0%" }]
            : []),
        ],
        columns,
        rows: territories.map((t) => rowOf(t, (m) => getCell(t, m), rowTotals.get(t) ?? 0)),
        totalRow: rowOf("TOTAL", (m) => colTotals[m - 1], grandTotal),
      },
    ];
    if (hasReal) {
      const realCols = columns.map((c) => ({
        ...c,
        header: c.header.replace(String(year), String(prevYear)),
      }));
      sheets.push({
        sheetName: `Real ${prevYear}`,
        title: `Venta real ${prevYear} (referencia)`,
        subtitle: `Cierre de cada mes · ${territories.length} territorios`,
        summary: [{ label: "Total anual", value: realGrandTotal, numFmt: "$#,##0" }],
        columns: realCols,
        rows: territories.map((t) => rowOf(t, (m) => getReal(t, m), realRowTotals.get(t) ?? 0)),
        totalRow: rowOf("TOTAL", (m) => realColTotals[m - 1], realGrandTotal),
      });
      const pctCols = columns.map((c) =>
        c.key === "territorio" ? c : { ...c, numFmt: "+0.0%;-0.0%", header: c.header.replace(` ${year}`, "") }
      );
      const pctRow = (t: string, meta: (m: number) => number, real: (m: number) => number, mt: number, rt: number) => {
        const r: Record<string, unknown> = { territorio: t };
        MESES.forEach((m) => {
          const rv = real(m);
          r[`m${m}`] = rv > 0 && meta(m) > 0 ? meta(m) / rv - 1 : null;
        });
        r.total = rt > 0 && mt > 0 ? mt / rt - 1 : null;
        return r;
      };
      sheets.push({
        sheetName: `Meta vs Real`,
        title: `Meta ${year} vs Real ${prevYear} (% de variación)`,
        subtitle: "Vacío = sin meta o sin real en ese mes",
        columns: pctCols,
        rows: territories.map((t) =>
          pctRow(t, (m) => getCell(t, m), (m) => getReal(t, m), rowTotals.get(t) ?? 0, realRowTotals.get(t) ?? 0)
        ),
        totalRow: pctRow("TOTAL", (m) => colTotals[m - 1], (m) => realColTotals[m - 1], grandTotal, realGrandTotal),
      });
    }
    await exportToExcelMultiSheet(`Metas_PTTO_${year}_${todayISO()}`, sheets);
  }

  // ---------- Render ----------
  const stickyHeadBg = "var(--bg-surface-muted)";
  const isCurrent = (m: number) => currentMonth === m;

  return (
    <div
      className="rounded-[var(--radius-lg)] border p-5"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Target size={20} style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Editor de Presupuestos (PTTO)
          </h2>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: territoriesSinMeta.length === 0 ? "var(--success-soft)" : "var(--bg-surface-muted)",
              color: territoriesSinMeta.length === 0 ? "var(--success)" : "var(--text-secondary)",
            }}
            title={
              territoriesSinMeta.length > 0
                ? `Sin meta ${year}: ${territoriesSinMeta.join(", ")}`
                : `Los ${territories.length} territorios tienen meta ${year}`
            }
          >
            {territoriesConMeta}/{territories.length} con meta
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasReal && (
            <button
              type="button"
              onClick={() => setShowReal((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-surface-muted)]"
              style={{
                borderColor: showReal ? "var(--accent)" : "var(--border)",
                color: showReal ? "var(--accent)" : "var(--text-primary)",
                background: showReal ? "var(--accent-soft)" : "var(--bg-surface)",
              }}
              title="Mostrar/ocultar la fila de referencia con la venta real del año anterior"
            >
              {showReal ? <Eye size={14} /> : <EyeOff size={14} />}
              Real {prevYear}
            </button>
          )}
          <ExportExcelButton
            onExport={handleExport}
            label="Excel"
            title={`Descargar metas ${year} en Excel (${hasReal ? "3 hojas" : "1 hoja"})`}
            disabled={territories.length === 0}
          />
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
            <select
              value={year}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              className="rounded-[var(--radius)] border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {dirty.size > 0 && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-muted)] disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              title="Volver a los valores guardados"
            >
              <RotateCcw size={14} />
              Descartar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={dirty.size === 0 || saving}
            className="flex items-center gap-2 rounded-[var(--radius)] px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: dirty.size === 0 ? "var(--text-muted)" : "var(--accent)" }}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save size={14} />
                Guardar {dirty.size > 0 ? `(${dirty.size})` : ""}
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        Ingresa el objetivo de venta en pesos por mes y territorio. Los cambios
        se reflejan en el dashboard al guardar. Solo admin/director pueden
        editar. Usa el menú <MoreHorizontal size={12} className="inline" /> de
        cada territorio para copiar el año anterior o repartir un total anual.
      </p>

      {/* Meta-info: última edición + sin meta */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>
          Última edición {year}:{" "}
          {lastEdit ? (
            <strong style={{ color: "var(--text-secondary)" }}>
              {lastEdit.by ?? "—"} · {formatDateTime(lastEdit.at)}
            </strong>
          ) : (
            <strong style={{ color: "var(--text-secondary)" }}>sin metas guardadas</strong>
          )}
        </span>
        {territoriesSinMeta.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Info size={12} />
            Sin meta {year}: {territoriesSinMeta.join(", ")}
          </span>
        )}
        {currentMonth !== null && (
          <span>
            Mes en curso resaltado: <strong style={{ color: "var(--accent)" }}>{MONTHS_SHORT[currentMonth - 1]}</strong>
          </span>
        )}
      </div>

      {/* Status messages */}
      {savedAt && (
        <div
          className="mt-3 flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
          style={{ background: "var(--success-soft)", borderColor: "var(--success)", color: "var(--success)" }}
        >
          <CheckCircle2 size={14} />
          Guardado{" "}
          {savedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}
      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
          style={{ background: "var(--danger-soft)", borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {territories.length === 0 ? (
        <div
          className="mt-4 rounded-[var(--radius)] p-4 text-center text-sm"
          style={{ background: "var(--bg-surface-muted)", color: "var(--text-muted)" }}
        >
          No hay territorios visibles. Carga datos primero o pide permisos al admin.
        </div>
      ) : (
        /* Paneles fijos: scroll propio → header arriba, 1ª columna izquierda, TOTAL abajo */
        <div className="mt-4 max-h-[70vh] overflow-auto rounded-[var(--radius)] border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[11px] tabular-nums" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 top-0 z-30 border-b border-r px-3 py-2 text-left font-semibold uppercase tracking-wider"
                  style={{ background: stickyHeadBg, borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Territorio
                </th>
                {MONTHS_SHORT.map((m, i) => (
                  <th
                    key={m}
                    className="sticky top-0 z-20 border-b px-1 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: isCurrent(i + 1) ? "var(--accent-soft)" : stickyHeadBg,
                      borderColor: "var(--border)",
                      color: isCurrent(i + 1) ? "var(--accent)" : "var(--text-secondary)",
                      borderBottom: isCurrent(i + 1) ? "2px solid var(--accent)" : undefined,
                    }}
                  >
                    {m}
                  </th>
                ))}
                <th
                  className="sticky top-0 z-20 border-b border-l px-3 py-2 text-right font-semibold uppercase tracking-wider"
                  style={{ background: stickyHeadBg, borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Total año
                </th>
              </tr>
            </thead>
            <tbody>
              {territories.map((t, idx) => {
                const rowBg = idx % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-muted)";
                const rTotal = realRowTotals.get(t) ?? 0;
                const mTotal = rowTotals.get(t) ?? 0;
                return (
                  <RowGroup key={t}>
                    <tr style={{ background: rowBg }}>
                      <td
                        className="sticky left-0 z-10 border-b border-r px-2 py-1.5 font-medium"
                        style={{ background: rowBg, borderColor: "var(--border)", color: "var(--text-primary)" }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="whitespace-nowrap">{t}</span>
                          <div className="relative" data-rowmenu>
                            <button
                              type="button"
                              onClick={() => setMenuFor(menuFor === t ? null : t)}
                              className="rounded p-0.5 transition-colors hover:bg-[var(--accent-soft)]"
                              style={{ color: menuFor === t ? "var(--accent)" : "var(--text-muted)" }}
                              title="Acciones rápidas"
                              aria-label={`Acciones para ${t}`}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                            {menuFor === t && (
                              <div
                                className="absolute left-0 top-full z-40 mt-1 w-64 rounded-[var(--radius)] border py-1 text-left text-xs shadow-lg"
                                style={{ background: "var(--bg-surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
                              >
                                <MenuItem icon={<Copy size={12} />} onClick={() => copyFrom(t, "meta")} disabled={!MESES.some((m) => (prevBudgetMap.get(key(t, m)) ?? 0) > 0)}>
                                  Copiar meta {prevYear} +X %
                                </MenuItem>
                                <MenuItem icon={<Copy size={12} />} onClick={() => copyFrom(t, "real")} disabled={rTotal <= 0}>
                                  Copiar real {prevYear} +X %
                                </MenuItem>
                                <MenuItem icon={<Divide size={12} />} onClick={() => distribute(t, "parejo")}>
                                  Repartir total anual · parejo
                                </MenuItem>
                                <MenuItem icon={<Divide size={12} />} onClick={() => distribute(t, "estacional")} disabled={rTotal <= 0}>
                                  Repartir total anual · estacionalidad {prevYear}
                                </MenuItem>
                                <MenuItem icon={<Eraser size={12} />} onClick={() => clearRow(t)} disabled={mTotal <= 0} danger>
                                  Limpiar fila
                                </MenuItem>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {MESES.map((mes) => (
                        <td
                          key={mes}
                          className="border-b px-0.5 py-0.5"
                          style={{
                            borderColor: "var(--border)",
                            background: isCurrent(mes) ? "var(--accent-soft)" : undefined,
                          }}
                        >
                          <BudgetCellInput
                            value={getCell(t, mes)}
                            dirty={dirty.has(key(t, mes))}
                            onChange={(v) => setCell(t, mes, v)}
                          />
                        </td>
                      ))}
                      <td
                        className="border-b border-l px-3 py-1.5 text-right font-semibold"
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                      >
                        {formatMoneyExact(mTotal)}
                      </td>
                    </tr>
                    {showReal && hasReal && (
                      <tr style={{ background: rowBg }}>
                        <td
                          className="sticky left-0 z-10 border-b border-r px-3 py-1 text-[10px] uppercase tracking-wider"
                          style={{ background: rowBg, borderColor: "var(--border)", color: "var(--text-muted)" }}
                        >
                          Real {prevYear}
                        </td>
                        {MESES.map((mes) => {
                          const rv = getReal(t, mes);
                          const mv = getCell(t, mes);
                          const p = rv > 0 && mv > 0 ? mv / rv - 1 : null;
                          return (
                            <td
                              key={mes}
                              className="border-b px-1 py-0.5 text-right text-[10px]"
                              style={{
                                borderColor: "var(--border)",
                                background: isCurrent(mes) ? "var(--accent-soft)" : undefined,
                              }}
                            >
                              <div style={{ color: rv > 0 ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                {rv > 0 ? formatMoneyExact(rv) : "—"}
                              </div>
                              <PctBadge p={p} />
                            </td>
                          );
                        })}
                        <td
                          className="border-b border-l px-3 py-1 text-right"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          <div>{rTotal > 0 ? formatMoneyExact(rTotal) : "—"}</div>
                          <PctBadge p={rTotal > 0 && mTotal > 0 ? mTotal / rTotal - 1 : null} />
                        </td>
                      </tr>
                    )}
                  </RowGroup>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td
                  className="sticky bottom-0 left-0 z-30 border-t border-r px-3 py-2 font-semibold uppercase tracking-wider"
                  style={{ background: stickyHeadBg, borderColor: "var(--border)", color: "var(--text-secondary)", fontSize: "10px" }}
                >
                  Total {year}
                  {showReal && hasReal && (
                    <div className="mt-0.5 font-normal normal-case" style={{ color: "var(--text-muted)" }}>
                      vs real {prevYear}
                    </div>
                  )}
                </td>
                {colTotals.map((v, i) => (
                  <td
                    key={i}
                    className="sticky bottom-0 z-20 border-t px-1 py-1.5 text-right font-semibold"
                    style={{
                      background: isCurrent(i + 1) ? "var(--accent-soft)" : stickyHeadBg,
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                      fontSize: "10px",
                    }}
                  >
                    {v > 0 ? formatMoneyExact(v) : "—"}
                    {showReal && hasReal && (
                      <div className="font-normal" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                        {realColTotals[i] > 0 ? formatMoneyExact(realColTotals[i]) : "—"}{" "}
                        <PctBadge p={realColTotals[i] > 0 && v > 0 ? v / realColTotals[i] - 1 : null} inline />
                      </div>
                    )}
                  </td>
                ))}
                <td
                  className="sticky bottom-0 z-20 border-l border-t px-3 py-2 text-right font-bold"
                  style={{ background: "var(--accent-soft)", borderColor: "var(--border)", color: "var(--accent)", fontSize: "11px" }}
                >
                  {formatMoneyExact(grandTotal)}
                  {showReal && hasReal && (
                    <div className="font-normal" style={{ color: "var(--text-secondary)", fontSize: "10px" }}>
                      {realGrandTotal > 0 ? formatMoneyExact(realGrandTotal) : "—"}{" "}
                      <PctBadge p={realGrandTotal > 0 && grandTotal > 0 ? grandTotal / realGrandTotal - 1 : null} inline />
                    </div>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/** Agrupa la fila del territorio + su fila "Real" (fragment con key). */
function RowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function MenuItem({
  icon,
  onClick,
  disabled,
  danger,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--bg-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ color: danger ? "var(--danger)" : "var(--text-primary)" }}
    >
      <span style={{ color: danger ? "var(--danger)" : "var(--text-muted)" }}>{icon}</span>
      {children}
    </button>
  );
}

/** % meta vs real: verde ≥ 0, rojo < 0, "—" si no aplica. */
function PctBadge({ p, inline = false }: { p: number | null; inline?: boolean }) {
  if (p === null) {
    return <span className={inline ? "" : "block"} style={{ color: "var(--text-muted)", fontSize: "10px" }}>—</span>;
  }
  const txt = `${p >= 0 ? "+" : ""}${(p * 100).toFixed(1)}%`;
  return (
    <span
      className={inline ? "font-semibold" : "block font-semibold"}
      style={{ color: p >= 0 ? "var(--success)" : "var(--danger)", fontSize: "10px" }}
    >
      {txt}
    </span>
  );
}

function BudgetCellInput({
  value,
  dirty,
  onChange,
}: {
  value: number;
  dirty: boolean;
  onChange: (v: number) => void;
}) {
  // Muestra "1,250,000" cuando no está enfocado; al editar, solo dígitos.
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const display = focused
    ? draft
    : value === 0
      ? ""
      : Math.round(value).toLocaleString("es-MX", { maximumFractionDigits: 0 });
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={(e) => {
        setDraft(value === 0 ? "" : String(Math.round(value)));
        setFocused(true);
        const el = e.currentTarget;
        setTimeout(() => el.select(), 0);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        setDraft(raw);
        onChange(raw === "" ? 0 : parseInt(raw, 10));
      }}
      onBlur={() => setFocused(false)}
      placeholder="—"
      className="w-full min-w-[70px] rounded-[var(--radius-sm)] border bg-transparent px-1.5 py-0.5 text-right text-[11px] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
      style={{
        borderColor: dirty ? "var(--accent)" : "var(--border)",
        background: dirty ? "var(--accent-soft)" : "transparent",
        color: "var(--text-primary)",
      }}
    />
  );
}
