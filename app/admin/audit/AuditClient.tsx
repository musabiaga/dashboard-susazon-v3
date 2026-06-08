"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  AlertCircle,
  RotateCcw,
  LogIn,
  LogOut,
  XOctagon,
  Power,
  DollarSign,
  UserPlus,
  UserCog,
  UserX,
  RefreshCw,
  Settings,
  ShieldOff,
  ShieldAlert,
  ShieldCheck,
  Mail,
  KeyRound,
  Clock,
  type LucideIcon,
} from "lucide-react";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "territory_toggle"
  | "ptto_change"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "data_refresh"
  | "settings_toggle"
  | "force_signout"
  | "force_signout_all"
  | "invite"
  | "reset"
  | "session_timeout_changed"
  | "session_timeout_exemption_changed";

export interface AuditEvent {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  details: Record<string, unknown>;
  created_at: string;
}

interface Props {
  initial: AuditEvent[];
  totalCount: number;
  pageSize: number;
}

const ACTION_CONFIG: Record<
  AuditAction,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  login: {
    label: "Login",
    icon: LogIn,
    color: "var(--success)",
    bg: "var(--success-soft)",
  },
  login_failed: {
    label: "Login fallido",
    icon: XOctagon,
    color: "var(--danger)",
    bg: "var(--danger-soft)",
  },
  logout: {
    label: "Logout",
    icon: LogOut,
    color: "var(--text-secondary)",
    bg: "var(--bg-surface-muted)",
  },
  territory_toggle: {
    label: "Toggle territorio",
    icon: Power,
    color: "var(--warning)",
    bg: "var(--warning-soft)",
  },
  ptto_change: {
    label: "Cambio PTTO",
    icon: DollarSign,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
  },
  user_created: {
    label: "Usuario creado",
    icon: UserPlus,
    color: "var(--success)",
    bg: "var(--success-soft)",
  },
  user_updated: {
    label: "Usuario editado",
    icon: UserCog,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
  },
  user_deleted: {
    label: "Usuario eliminado",
    icon: UserX,
    color: "var(--danger)",
    bg: "var(--danger-soft)",
  },
  data_refresh: {
    label: "Refresh datos",
    icon: RefreshCw,
    color: "var(--text-secondary)",
    bg: "var(--bg-surface-muted)",
  },
  settings_toggle: {
    label: "Toggle ajuste",
    icon: Settings,
    color: "var(--warning)",
    bg: "var(--warning-soft)",
  },
  force_signout: {
    label: "Cierre de sesión remoto",
    icon: ShieldOff,
    color: "var(--danger)",
    bg: "var(--danger-soft)",
  },
  force_signout_all: {
    label: "Cierre de TODAS las sesiones",
    icon: ShieldAlert,
    color: "var(--danger)",
    bg: "var(--danger-soft)",
  },
  invite: {
    label: "Invitación de usuario",
    icon: Mail,
    color: "var(--success)",
    bg: "var(--success-soft)",
  },
  reset: {
    label: "Reset de contraseña",
    icon: KeyRound,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
  },
  session_timeout_changed: {
    label: "Cambio de timeout de sesión",
    icon: Clock,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
  },
  session_timeout_exemption_changed: {
    label: "Exención de timeout",
    icon: ShieldCheck,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
  },
};

const ACTION_ORDER: AuditAction[] = [
  "login",
  "login_failed",
  "logout",
  "territory_toggle",
  "ptto_change",
  "user_created",
  "user_updated",
  "user_deleted",
  "data_refresh",
  "settings_toggle",
  "invite",
  "reset",
  "force_signout",
  "force_signout_all",
  "session_timeout_changed",
  "session_timeout_exemption_changed",
];

export function AuditClient({ initial, totalCount: initialCount, pageSize }: Props) {
  const [events, setEvents] = useState(initial);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filtros
  const [filterAction, setFilterAction] = useState<AuditAction | "">("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const hasFilters =
    filterAction !== "" ||
    filterEmail.trim() !== "" ||
    filterFrom !== "" ||
    filterTo !== "";

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function buildQuery(offset: number) {
    const params = new URLSearchParams();
    if (filterAction) params.set("action", filterAction);
    if (filterEmail.trim()) params.set("email", filterEmail.trim());
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    params.set("offset", String(offset));
    params.set("limit", String(pageSize));
    return params.toString();
  }

  async function applyFilters() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?${buildQuery(0)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setEvents(j.events as AuditEvent[]);
      setTotalCount(j.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?${buildQuery(events.length)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setEvents((prev) => [...prev, ...(j.events as AuditEvent[])]);
      setTotalCount(j.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setFilterAction("");
    setFilterEmail("");
    setFilterFrom("");
    setFilterTo("");
    // Después de limpiar, refrescar — usar setTimeout para que el state actualice
    setTimeout(() => applyFilters(), 0);
  }

  const showingCount = events.length;
  const hasMore = showingCount < totalCount;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div
        className="rounded-[var(--radius-lg)] border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <FilterField label="Acción">
            <select
              value={filterAction}
              onChange={(e) =>
                setFilterAction(e.target.value as AuditAction | "")
              }
              className="w-full rounded-[var(--radius-sm)] border px-2 py-1.5 text-sm"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">— Todas —</option>
              {ACTION_ORDER.map((a) => (
                <option key={a} value={a}>
                  {ACTION_CONFIG[a].label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Email (contiene)">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="text"
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                placeholder="usuario@..."
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-full rounded-[var(--radius-sm)] border py-1.5 pl-7 pr-2 text-sm"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </FilterField>
          <FilterField label="Desde">
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border px-2 py-1.5 text-sm"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </FilterField>
          <FilterField label="Hasta">
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border px-2 py-1.5 text-sm"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </FilterField>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <RotateCcw size={12} />
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{
              background: "var(--accent)",
              borderColor: "var(--accent)",
              color: "white",
            }}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Search size={12} />
            )}
            Aplicar filtros
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-muted)" }}>
          Mostrando <strong>{showingCount.toLocaleString("es-MX")}</strong>{" "}
          de <strong>{totalCount.toLocaleString("es-MX")}</strong> eventos
          {hasFilters && " (filtrados)"}
        </span>
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
        className="rounded-[var(--radius-lg)] border overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-surface-muted)" }}>
              <Th width="180px">Fecha / Hora</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Resumen</Th>
              <Th align="center" width="40px"></Th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => {
              const isOpen = expanded.has(ev.id);
              // Fallback defensivo: si llega una acción sin mapeo (ej. un valor
              // nuevo del enum aún no agregado aquí), mostramos el string crudo
              // en vez de reventar el render (causa del bug "te saca de la página").
              const config = ACTION_CONFIG[ev.action] ?? {
                label: ev.action,
                icon: AlertCircle,
                color: "var(--text-muted)",
                bg: "var(--bg-surface-muted)",
              };
              const Icon = config.icon;
              return (
                <RowFragment
                  key={ev.id}
                  ev={ev}
                  i={i}
                  isOpen={isOpen}
                  config={config}
                  Icon={Icon}
                  onToggle={() => toggleExpand(ev.id)}
                />
              );
            })}
          </tbody>
        </table>
        {events.length === 0 && (
          <div
            className="px-4 py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin eventos que coincidan con los filtros.
          </div>
        )}
      </div>

      {/* Cargar más */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : null}
            Cargar más ({(totalCount - showingCount).toLocaleString("es-MX")}{" "}
            restantes)
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
function RowFragment({
  ev,
  i,
  isOpen,
  config,
  Icon,
  onToggle,
}: {
  ev: AuditEvent;
  i: number;
  isOpen: boolean;
  config: (typeof ACTION_CONFIG)[AuditAction];
  Icon: LucideIcon;
  onToggle: () => void;
}) {
  const summary = useMemo(() => buildSummary(ev), [ev]);
  const bg =
    i % 2 === 0 ? "var(--bg-surface)" : "var(--bg-surface-muted)";
  return (
    <>
      <tr style={{ background: bg }}>
        <Td>
          <div className="flex flex-col leading-tight">
            <span
              className="text-xs"
              style={{ color: "var(--text-primary)" }}
            >
              {formatDateTime(ev.created_at)}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {relativeTime(ev.created_at)}
            </span>
          </div>
        </Td>
        <Td>
          <span
            className="text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {ev.user_email ?? "—"}
          </span>
        </Td>
        <Td>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: config.bg, color: config.color }}
          >
            <Icon size={11} />
            {config.label}
          </span>
        </Td>
        <Td>
          <span
            className="text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {summary}
          </span>
        </Td>
        <Td align="center">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-[var(--radius-sm)] p-1"
            style={{ color: "var(--text-muted)" }}
            title={isOpen ? "Ocultar detalles" : "Ver detalles"}
          >
            {isOpen ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        </Td>
      </tr>
      {isOpen && (
        <tr style={{ background: bg }}>
          <td colSpan={5} className="px-3 pb-3">
            <pre
              className="overflow-x-auto rounded-[var(--radius-sm)] border p-3 text-[11px] leading-relaxed"
              style={{
                background: "var(--bg-page)",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              }}
            >
              {JSON.stringify(ev.details, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Th({
  children,
  align = "left",
  width,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}) {
  return (
    <th
      className={`border-b px-3 py-2 font-semibold uppercase tracking-wider text-[10px] text-${align}`}
      style={{
        borderColor: "var(--border)",
        color: "var(--text-secondary)",
        width,
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
      className={`px-3 py-2 align-middle text-${align}`}
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </td>
  );
}

// ============================================================
// Helpers
// ============================================================
function buildSummary(ev: AuditEvent): string {
  const d = ev.details ?? {};
  switch (ev.action) {
    case "territory_toggle": {
      const t = d.territory_name as string | undefined;
      const newState = d.new_state as string | undefined;
      const reason = d.reason as string | null | undefined;
      const verb = newState === "disabled" ? "Apagó" : "Prendió";
      return `${verb} territorio "${t ?? "?"}"${reason ? ` — Motivo: ${reason}` : ""}`;
    }
    case "ptto_change": {
      const count = d.rows_count as number | undefined;
      const anio = d.anio as number | undefined;
      const terrs = (d.territorios as string[] | undefined) ?? [];
      return `${count ?? "?"} filas de PTTO ${anio ?? ""} actualizadas (${terrs.length} territorio${terrs.length === 1 ? "" : "s"})`;
    }
    case "user_created": {
      const email = d.target_email as string | undefined;
      const role = d.role as string | undefined;
      return `Invitó a ${email ?? "?"} como ${role ?? "?"}`;
    }
    case "user_updated": {
      const email = d.target_email as string | undefined;
      const fields = (d.changed_fields as string[] | undefined) ?? [];
      const action_type = d.action_type as string | undefined;
      if (action_type === "password_reset_sent") {
        return `Reset de password enviado a ${email ?? "?"}`;
      }
      return `Editó ${email ?? "?"} (${fields.join(", ") || "—"})`;
    }
    case "user_deleted": {
      const email = d.target_email as string | undefined;
      return `Desactivó a ${email ?? "?"}`;
    }
    case "data_refresh": {
      const count = d.rows_count as number | undefined;
      return count != null
        ? `${count.toLocaleString("es-MX")} filas refrescadas`
        : "Refresh ejecutado";
    }
    case "login":
    case "logout":
    case "login_failed":
      return "—";
    default:
      return "—";
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day}d`;
  return "hace tiempo";
}
