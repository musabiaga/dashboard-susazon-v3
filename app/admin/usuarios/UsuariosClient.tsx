"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Edit2,
  KeyRound,
  Power,
  AlertCircle,
  Loader2,
  X,
  Check,
  CheckCircle2,
} from "lucide-react";

export type RoleKey = "admin" | "director" | "gerente_regional" | "vendedor";

const ROLE_LABEL: Record<RoleKey, string> = {
  admin: "Administrador",
  director: "Director",
  gerente_regional: "Gerente Regional",
  vendedor: "Vendedor",
};

const ROLE_ORDER: RoleKey[] = [
  "admin",
  "director",
  "gerente_regional",
  "vendedor",
];

export interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  role: RoleKey;
  // null = todos
  allowed_territories: string[] | null;
  can_edit_ptto: boolean;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface Props {
  initial: UserRow[];
  territories: string[];
}

export function UsuariosClient({ initial, territories }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Modal state
  const [modal, setModal] = useState<
    | { kind: "invite" }
    | { kind: "edit"; user: UserRow }
    | null
  >(null);

  const stats = {
    total: users.length,
    activos: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === "admin").length,
  };

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  }

  async function handleInvite(form: FormPayload) {
    setError(null);
    setPendingId("__invite__");
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setUsers((prev) => [...prev, j.user as UserRow]);
      setModal(null);
      flashSuccess(
        `Invitación enviada a ${form.email}. Revisará su correo para fijar contraseña.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setPendingId(null);
    }
  }

  async function handleUpdate(userId: string, form: FormPayload) {
    setError(null);
    setPendingId(userId);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...form }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? (j.user as UserRow) : u))
      );
      setModal(null);
      flashSuccess(`Usuario ${form.email} actualizado.`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setPendingId(null);
    }
  }

  async function handleToggleActive(u: UserRow) {
    if (
      u.is_active &&
      !confirm(
        `¿Desactivar a ${u.full_name}? No podrá iniciar sesión hasta reactivarlo.`
      )
    )
      return;
    setError(null);
    setPendingId(u.user_id);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: u.user_id,
          is_active: !u.is_active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setUsers((prev) =>
        prev.map((x) =>
          x.user_id === u.user_id ? (j.user as UserRow) : x
        )
      );
      flashSuccess(
        `${u.full_name} ${!u.is_active ? "reactivado" : "desactivado"}.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setPendingId(null);
    }
  }

  async function handleResetPassword(u: UserRow) {
    if (!confirm(`Enviar email de reset de contraseña a ${u.email}?`)) return;
    setError(null);
    setPendingId(u.user_id);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.user_id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      flashSuccess(`Email de reset enviado a ${u.email}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats + invite */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <StatPill label="Total" count={stats.total} color="var(--text-muted)" />
          <StatPill
            label="Activos"
            count={stats.activos}
            color="var(--success)"
          />
          <StatPill
            label="Admins"
            count={stats.admins}
            color="var(--accent)"
          />
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "invite" })}
          className="inline-flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm font-medium"
          style={{
            background: "var(--accent)",
            borderColor: "var(--accent)",
            color: "white",
          }}
        >
          <UserPlus size={14} />
          Invitar usuario
        </button>
      </div>

      {error && (
        <Banner kind="danger" onClose={() => setError(null)}>
          {error}
        </Banner>
      )}
      {success && (
        <Banner kind="success" onClose={() => setSuccess(null)}>
          {success}
        </Banner>
      )}

      {/* Tabla */}
      <div
        className="rounded-[var(--radius-lg)] border overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-surface-muted)" }}>
                <Th>Usuario</Th>
                <Th>Rol</Th>
                <Th>Territorios</Th>
                <Th align="center">PTTO</Th>
                <Th align="center">Estado</Th>
                <Th>Último login</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isPending = pendingId === u.user_id;
                const territoriesLabel =
                  u.allowed_territories === null
                    ? "Todos"
                    : u.allowed_territories.length === 0
                      ? "Ninguno"
                      : u.allowed_territories.length <= 2
                        ? u.allowed_territories.join(", ")
                        : `${u.allowed_territories.length} asignados`;
                return (
                  <tr
                    key={u.user_id}
                    style={{
                      background:
                        i % 2 === 0
                          ? "var(--bg-surface)"
                          : "var(--bg-surface-muted)",
                      opacity: u.is_active ? 1 : 0.55,
                    }}
                  >
                    <Td>
                      <div className="flex flex-col leading-tight">
                        <span
                          className="font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {u.full_name}
                        </span>
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {u.email}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <RoleBadge role={u.role} />
                    </Td>
                    <Td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                        title={
                          u.allowed_territories?.join(", ") ?? "Todos"
                        }
                      >
                        {territoriesLabel}
                      </span>
                    </Td>
                    <Td align="center">
                      {u.can_edit_ptto ? (
                        <CheckCircle2
                          size={14}
                          style={{ color: "var(--success)" }}
                          className="mx-auto"
                        />
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </Td>
                    <Td align="center">
                      <ActiveBadge active={u.is_active} />
                    </Td>
                    <Td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatDate(u.last_login)}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn
                          title="Editar"
                          onClick={() => setModal({ kind: "edit", user: u })}
                          disabled={isPending}
                        >
                          <Edit2 size={12} />
                        </IconBtn>
                        <IconBtn
                          title="Reset contraseña"
                          onClick={() => handleResetPassword(u)}
                          disabled={isPending}
                        >
                          <KeyRound size={12} />
                        </IconBtn>
                        <IconBtn
                          title={u.is_active ? "Desactivar" : "Activar"}
                          onClick={() => handleToggleActive(u)}
                          disabled={isPending}
                          danger={u.is_active}
                        >
                          {isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Power size={12} />
                          )}
                        </IconBtn>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div
            className="px-4 py-12 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sin usuarios registrados.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <UserFormModal
          kind={modal.kind}
          user={modal.kind === "edit" ? modal.user : null}
          territories={territories}
          submitting={pendingId !== null}
          onClose={() => setModal(null)}
          onSubmit={(form) => {
            if (modal.kind === "invite") {
              handleInvite(form);
            } else {
              handleUpdate(modal.user.user_id, form);
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================
interface FormPayload {
  email: string;
  full_name: string;
  role: RoleKey;
  allowed_territories: string[] | null; // null = todos
  can_edit_ptto: boolean;
}

function UserFormModal({
  kind,
  user,
  territories,
  submitting,
  onClose,
  onSubmit,
}: {
  kind: "invite" | "edit";
  user: UserRow | null;
  territories: string[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: FormPayload) => void;
}) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [role, setRole] = useState<RoleKey>(user?.role ?? "vendedor");
  const [allTerritories, setAllTerritories] = useState(
    user ? user.allowed_territories === null : true
  );
  const [selected, setSelected] = useState<string[]>(
    user?.allowed_territories ?? []
  );
  const [canEditPtto, setCanEditPtto] = useState(
    user?.can_edit_ptto ?? false
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function toggleTerritory(t: string) {
    setSelected((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function submit() {
    setLocalError(null);
    if (!email.trim() || !email.includes("@")) {
      setLocalError("Email inválido");
      return;
    }
    if (!fullName.trim()) {
      setLocalError("Nombre completo es requerido");
      return;
    }
    if (!allTerritories && selected.length === 0) {
      setLocalError(
        "Debe seleccionar al menos un territorio (o marcar 'Todos')"
      );
      return;
    }
    onSubmit({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role,
      allowed_territories: allTerritories ? null : selected,
      can_edit_ptto: canEditPtto,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[var(--radius-lg)] border shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {kind === "invite" ? "Invitar nuevo usuario" : "Editar usuario"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {kind === "invite" && (
            <p
              className="rounded-[var(--radius)] border px-3 py-2 text-xs"
              style={{
                background: "var(--bg-surface-muted)",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Se enviará un email con un enlace para que el usuario fije su
              propia contraseña la primera vez.
            </p>
          )}

          <Field label="Correo electrónico">
            <input
              type="email"
              value={email}
              disabled={kind === "edit"}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@susazon.com.mx"
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm disabled:opacity-60"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            {kind === "edit" && (
              <p
                className="mt-1 text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                El email no se puede editar. Para cambiarlo, desactiva este
                usuario y crea uno nuevo.
              </p>
            )}
          </Field>

          <Field label="Nombre completo">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Pérez González"
              className="w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <Field label="Rol">
            <div className="grid grid-cols-2 gap-2">
              {ROLE_ORDER.map((r) => {
                const active = r === role;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-medium"
                    style={{
                      background: active
                        ? "var(--accent-soft)"
                        : "var(--bg-surface)",
                      borderColor: active
                        ? "var(--accent)"
                        : "var(--border)",
                      color: active
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Territorios permitidos">
            <label
              className="mb-2 flex items-center gap-2 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <input
                type="checkbox"
                checked={allTerritories}
                onChange={(e) => setAllTerritories(e.target.checked)}
              />
              <span>Todos los territorios (sin restricción)</span>
            </label>
            {!allTerritories && (
              <div
                className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto rounded-[var(--radius-sm)] border p-2"
                style={{
                  background: "var(--bg-surface-muted)",
                  borderColor: "var(--border)",
                }}
              >
                {territories.map((t) => {
                  const checked = selected.includes(t);
                  return (
                    <label
                      key={t}
                      className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs"
                      style={{
                        background: checked
                          ? "var(--accent-soft)"
                          : "transparent",
                        color: checked
                          ? "var(--accent)"
                          : "var(--text-secondary)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTerritory(t)}
                      />
                      <span className="truncate">{t}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>

          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            <input
              type="checkbox"
              checked={canEditPtto}
              onChange={(e) => setCanEditPtto(e.target.checked)}
            />
            <span>Puede editar PTTO (presupuestos)</span>
          </label>

          {localError && (
            <div
              className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
              style={{
                background: "var(--danger-soft)",
                borderColor: "var(--danger)",
                color: "var(--danger)",
              }}
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{localError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{
              background: "var(--accent)",
              borderColor: "var(--accent)",
              color: "white",
            }}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {kind === "invite" ? "Enviar invitación" : "Guardar cambios"}
          </button>
        </div>
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

function RoleBadge({ role }: { role: RoleKey }) {
  const config: Record<
    RoleKey,
    { bg: string; color: string; label: string }
  > = {
    admin: {
      bg: "var(--accent-soft)",
      color: "var(--accent)",
      label: "Admin",
    },
    director: {
      bg: "var(--success-soft)",
      color: "var(--success)",
      label: "Director",
    },
    gerente_regional: {
      bg: "var(--warning-soft)",
      color: "var(--warning)",
      label: "Gerente",
    },
    vendedor: {
      bg: "var(--bg-surface-muted)",
      color: "var(--text-secondary)",
      label: "Vendedor",
    },
  };
  const c = config[role];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        background: active ? "var(--success-soft)" : "var(--warning-soft)",
        color: active ? "var(--success)" : "var(--warning)",
      }}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-[var(--radius-sm)] border p-1.5 transition-colors disabled:opacity-40"
      style={{
        borderColor: "var(--border)",
        color: danger ? "var(--danger)" : "var(--text-secondary)",
        background: "var(--bg-surface)",
      }}
    >
      {children}
    </button>
  );
}

function Field({
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

function Banner({
  kind,
  children,
  onClose,
}: {
  kind: "danger" | "success";
  children: React.ReactNode;
  onClose: () => void;
}) {
  const isErr = kind === "danger";
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-[var(--radius)] border px-3 py-2 text-sm"
      style={{
        background: isErr ? "var(--danger-soft)" : "var(--success-soft)",
        borderColor: isErr ? "var(--danger)" : "var(--success)",
        color: isErr ? "var(--danger)" : "var(--success)",
      }}
    >
      <div className="flex items-start gap-2">
        {isErr ? (
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        )}
        <span>{children}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
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
      className={`px-3 py-2 align-middle text-${align}`}
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </td>
  );
}
