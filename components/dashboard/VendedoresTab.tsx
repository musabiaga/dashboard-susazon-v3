"use client";

import { useState } from "react";
import {
  DimensionTab,
  type DimensionRow,
} from "@/components/dashboard/DimensionTab";

interface Props {
  rowsSeparados: DimensionRow[];
  rowsUnidos: DimensionRow[];
  monthLabel24: string;
  monthLabel25: string;
  monthLabel26: string;
}

/**
 * Tab Vendedores con toggle:
 *  - Default "Separados": cada vendedor con sufijo (Sus)/(Suve) — replica V2.2.
 *    Mauricio (Sus) y Mauricio (Suve) son filas distintas si vende en ambas.
 *  - Toggle "Unir Sus+Suve": agrega ambas empresas en una fila por persona.
 *
 * Internamente delega en DimensionTab pasando rows distintos según el modo.
 */
export function VendedoresTab({
  rowsSeparados,
  rowsUnidos,
  monthLabel24,
  monthLabel25,
  monthLabel26,
}: Props) {
  const [merged, setMerged] = useState(false);
  const rows = merged ? rowsUnidos : rowsSeparados;

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-end">
        <MergeToggle merged={merged} onChange={setMerged} />
      </div>

      <DimensionTab
        rows={rows}
        monthLabel24={monthLabel24}
        monthLabel25={monthLabel25}
        monthLabel26={monthLabel26}
        dimensionLabel="Vendedor"
        dimensionLabelPlural="Vendedores"
        topNChart={null}
      />
    </div>
  );
}

function MergeToggle({
  merged,
  onChange,
}: {
  merged: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--radius)] border p-0.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
      }}
    >
      {[
        { v: false, label: "Separar Sus / Suve" },
        { v: true, label: "Unir Sus + Suve" },
      ].map((opt) => {
        const active = opt.v === merged;
        return (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className="rounded-[var(--radius-sm)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
            style={{
              background: active ? "var(--bg-surface)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
