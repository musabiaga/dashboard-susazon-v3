"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, AlertCircle, Check, X, Loader2 } from "lucide-react";

export interface TerritoryState {
  territory_name: string;
  is_active: boolean;
  reason: string | null;
  disabled_at: string | null;
  disabled_by_label: string | null;
}

interface Props {
  initial: TerritoryState[];
}

export function TerritoriesClient({ initial }: Props) {
  const router = useRouter();
  const [territories, setTerritories] = useState(initial);
  const [editingReason, setEditingReason] = useState<{
    name: string;
    value: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = territories.filter((t) => t.is_active).length;
  const disabledCount = territories.length - activeCount;

  async function callToggle(
    name: string,
    nextActive: boolean,
    reason: string | null
  ) {
    setError(null);
    setPendingName(name);
    try {
      const res = await fetch("/api/admin/territories/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          territory_name: name,
          is_active: nextActive,
          reason: nextActive ? null : reason,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as TerritoryState;
      setTerritories((prev) =>
        prev.map((t) => (t.territory_name === name ? updated : t))
      );
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
    } finally {
      setPendingName(null);
      setEditingReason(null);
    }
  }

  function handleToggleClick(t: TerritoryState) {
    if (t.is_active) {
      // Apagar → pedir motivo
      setEditingReason({ name: t.territory_name, value: "" });
    } else {
      // Prender → directo
      callToggle(t.territory_name, true, null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats compactas */}
      <div className="flex items-center gap-3 text-sm">
        <StatPill
          label="Activos"
          count={activeCount}
          color="var(--success)"
        />
        <StatPill
          label="Apagados"
          count={disabledCount}
          color="var(--warning)"
        />
        <StatPill
          label="Total"
          count={territories.length}
          color="var(--text-muted)"
        />
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
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

      {/* Tabla */}
      <div
        className="rounded-[var(--radius-lg)] border"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-surface-muted)" }}>
              <Th>Territorio</Th>
              <Th align="center">Estado</Th>
              <Th>Motivo (si apagado)</Th>
              <Th>Apagado por</Th>
              <Th align="right">Acción</Th>
            </tr>
          </thead>
          <tbody>
            {territories.map((t, i) => {
              const isPending = pendingName === t.territory_name;
              const isEditing = editingReason?.name === t.territory_name;
              return (
                <tr
                  key={t.territory_name}
                  style={{
                    background:
                      i % 2 === 0
                        ? "var(--bg-surface)"
                        : "var(--bg-surface-muted)",
                  }}
                >
                  <Td>
                    <span
                      className="font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t.territory_name}
                    </span>
                  </Td>
                  <Td align="center">
                    <StatusBadge active={t.is_active} />
                  </Td>
                  <Td>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        placeholder="Motivo (opcional)"
                        value={editingReason.value}
                        onChange={(e) =>
                          setEditingReason({
                            name: t.territory_name,
                            value: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            callToggle(
                              t.territory_name,
                              false,
                              editingReason.value.trim() || null
                            );
                          } else if (e.key === "Escape") {
                            setEditingReason(null);
                          }
                        }}
                        className="w-full rounded-[var(--radius-sm)] border px-2 py-1 text-xs"
                        style={{
                          background: "var(--bg-surface)",
                          borderColor: "var(--accent)",
                          color: "var(--text-primary)",
                        }}
                      />
                    ) : (
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {t.reason ?? "—"}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {!t.is_active && t.disabled_by_label
                        ? t.disabled_by_label
                        : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            callToggle(
                              t.territory_name,
                              false,
                              editingReason.value.trim() || null
                            )
                          }
                          disabled={isPending}
                          className="rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium"
                          style={{
                            background: "var(--warning)",
                            borderColor: "var(--warning)",
                            color: "white",
                          }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingReason(null)}
                          className="rounded-[var(--radius-sm)] border px-2 py-1 text-[11px]"
                          style={{
                            borderColor: "var(--border)",
                            color: "var(--text-muted)",
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleClick(t)}
                        disabled={isPending || pending}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider disabled:opacity-50"
                        style={{
                          background: t.is_active
                            ? "var(--bg-surface)"
                            : "var(--success-soft)",
                          borderColor: t.is_active
                            ? "var(--border)"
                            : "var(--success)",
                          color: t.is_active
                            ? "var(--text-secondary)"
                            : "var(--success)",
                        }}
                      >
                        {isPending ? (
                          <Loader2
                            size={12}
                            className="animate-spin"
                          />
                        ) : (
                          <Power size={12} />
                        )}
                        {t.is_active ? "Apagar" : "Prender"}
                      </button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {territories.length === 0 && (
          <div
            className="px-4 py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin territorios registrados.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
function StatPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color }}
      >
        {count}
      </span>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        background: active ? "var(--success-soft)" : "var(--warning-soft)",
        color: active ? "var(--success)" : "var(--warning)",
      }}
    >
      {active ? "Activo" : "Apagado"}
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={`px-3 py-2 text-${align}`}
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </td>
  );
}
