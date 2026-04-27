"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Target,
  Calendar,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export interface BudgetCell {
  territorio: string;
  mes: number; // 1-12
  venta_budget: number;
}

interface BudgetEditorClientProps {
  year: number;
  availableYears: number[];
  territories: string[];
  initialBudgets: BudgetCell[];
}

export function BudgetEditorClient({
  year,
  availableYears,
  territories,
  initialBudgets,
}: BudgetEditorClientProps) {
  const router = useRouter();

  // Map: "territorio|mes" → venta_budget
  const initialMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of initialBudgets) {
      m.set(`${b.territorio}|${b.mes}`, b.venta_budget);
    }
    return m;
  }, [initialBudgets]);

  const [budgets, setBudgets] = useState<Map<string, number>>(initialMap);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function key(t: string, m: number) {
    return `${t}|${m}`;
  }
  function getCell(t: string, m: number): number {
    return budgets.get(key(t, m)) ?? 0;
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

  // Totales por fila / columna / grand total — recomputan al cambiar budgets.
  const rowTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of territories) {
      let sum = 0;
      for (let mes = 1; mes <= 12; mes++) sum += getCell(t, mes);
      m.set(t, sum);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, territories]);

  const colTotals = useMemo(() => {
    const arr: number[] = new Array(12).fill(0);
    for (const t of territories) {
      for (let mes = 1; mes <= 12; mes++) {
        arr[mes - 1] += getCell(t, mes);
      }
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, territories]);

  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  function handleYearChange(newYear: number) {
    if (dirty.size > 0) {
      const ok = confirm(
        `Hay ${dirty.size} cambios sin guardar. Cambiar de año los descarta. ¿Continuar?`
      );
      if (!ok) return;
    }
    router.push(`/cargar-datos?year=${newYear}`);
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

  return (
    <div
      className="rounded-[var(--radius-lg)] border p-5"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Target size={20} style={{ color: "var(--accent)" }} />
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Editor de Presupuestos (PTTO)
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: "var(--text-muted)" }} />
            <select
              value={year}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              className="rounded-[var(--radius)] border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={dirty.size === 0 || saving}
            className="flex items-center gap-2 rounded-[var(--radius)] px-4 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{
              background:
                dirty.size === 0 ? "var(--text-muted)" : "var(--accent)",
            }}
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

      <p
        className="mt-2 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        Ingresa el objetivo de venta en pesos por mes y territorio. Los cambios
        se reflejan en el dashboard al guardar. Solo admin/director pueden
        editar.
      </p>

      {/* Status messages */}
      {savedAt && (
        <div
          className="mt-3 flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
          style={{
            background: "var(--success-soft)",
            borderColor: "var(--success)",
            color: "var(--success)",
          }}
        >
          <CheckCircle2 size={14} />
          Guardado{" "}
          {savedAt.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      )}
      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
          style={{
            background: "var(--danger-soft)",
            borderColor: "var(--danger)",
            color: "var(--danger)",
          }}
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {territories.length === 0 ? (
        <div
          className="mt-4 rounded-[var(--radius)] p-4 text-center text-sm"
          style={{
            background: "var(--bg-surface-muted)",
            color: "var(--text-muted)",
          }}
        >
          No hay territorios visibles. Carga datos primero o pide permisos al
          admin.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table
            className="w-full text-xs tabular-nums"
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 border-b border-r px-3 py-2 text-left font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--bg-surface-muted)",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Territorio
                </th>
                {MONTHS_SHORT.map((m) => (
                  <th
                    key={m}
                    className="border-b px-2 py-2 text-center font-semibold uppercase tracking-wider"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {m}
                  </th>
                ))}
                <th
                  className="border-b border-l px-3 py-2 text-right font-semibold uppercase tracking-wider"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Total año
                </th>
              </tr>
            </thead>
            <tbody>
              {territories.map((t) => (
                <tr key={t}>
                  <td
                    className="sticky left-0 z-10 border-b border-r px-3 py-1.5 font-medium"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {t}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                    <td
                      key={mes}
                      className="border-b px-1 py-1"
                      style={{ borderColor: "var(--border)" }}
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
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {formatMoney(rowTotals.get(t) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  className="sticky left-0 z-10 border-r px-3 py-2 font-semibold uppercase tracking-wider"
                  style={{
                    background: "var(--bg-surface-muted)",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    fontSize: "10px",
                  }}
                >
                  Total
                </td>
                {colTotals.map((v, i) => (
                  <td
                    key={i}
                    className="px-2 py-2 text-center font-semibold"
                    style={{
                      background: "var(--bg-surface-muted)",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                    }}
                  >
                    {v > 0 ? formatMoney(v) : "—"}
                  </td>
                ))}
                <td
                  className="border-l px-3 py-2 text-right font-bold"
                  style={{
                    background: "var(--accent-soft)",
                    borderColor: "var(--border)",
                    color: "var(--accent)",
                    fontSize: "12px",
                  }}
                >
                  {formatMoney(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
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
  return (
    <input
      type="number"
      min="0"
      step="1000"
      value={value === 0 ? "" : value}
      onChange={(e) => {
        const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
        onChange(isNaN(v) ? 0 : v);
      }}
      placeholder="—"
      className="w-full rounded-[var(--radius-sm)] border bg-transparent px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
      style={{
        borderColor: dirty ? "var(--accent)" : "var(--border)",
        background: dirty ? "var(--accent-soft)" : "transparent",
        color: "var(--text-primary)",
      }}
    />
  );
}
