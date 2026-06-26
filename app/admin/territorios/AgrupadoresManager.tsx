"use client";

/**
 * AgrupadoresManager — administración de Agrupadores (territorios virtuales).
 *
 * Un agrupador = nombre + lista FIJA de miembros tipados (territorio/grupo/
 * familia/sku/cliente). Sus datos = la UNIÓN de esos miembros. Se asignan a
 * usuarios (en /admin/usuarios) como frontera de seguridad y se comportan como
 * un territorio en el sidebar.
 *
 * Vive en /admin/territorios, debajo de la tabla de territorios reales.
 * Consume /api/admin/agrupadores (CRUD) y /options (valores del picker).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  Search,
  Megaphone,
  UserRound,
  Target,
  Tag,
  Star,
  Boxes,
  Flame,
} from "lucide-react";

type MemberType = "territorio" | "grupo" | "familia" | "sku" | "cliente";
interface Member {
  member_type: MemberType;
  member_value: string;
}
interface Agrupador {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  color: string | null;
  meta_mensual: number | null;
  is_active: boolean;
  members: Member[];
  assigned_users: number;
}
type Options = Record<MemberType, string[]>;

const TYPES: { key: MemberType; label: string; labelPl: string }[] = [
  { key: "cliente", label: "Cliente", labelPl: "Clientes" },
  { key: "grupo", label: "Grupo", labelPl: "Grupos" },
  { key: "familia", label: "Familia", labelPl: "Familias" },
  { key: "sku", label: "SKU", labelPl: "SKUs" },
  { key: "territorio", label: "Territorio", labelPl: "Territorios" },
];

const ICONS: { key: string; Comp: typeof Megaphone }[] = [
  { key: "megaphone", Comp: Megaphone },
  { key: "user", Comp: UserRound },
  { key: "target", Comp: Target },
  { key: "tag", Comp: Tag },
  { key: "star", Comp: Star },
  { key: "boxes", Comp: Boxes },
  { key: "flame", Comp: Flame },
];
export function iconComp(key: string | null) {
  return ICONS.find((i) => i.key === key)?.Comp ?? Layers;
}

const emptyDraft = (): Draft => ({
  id: undefined,
  nombre: "",
  descripcion: "",
  icono: "megaphone",
  meta_mensual: "",
  is_active: true,
  members: [],
});
interface Draft {
  id?: string;
  nombre: string;
  descripcion: string;
  icono: string;
  meta_mensual: string;
  is_active: boolean;
  members: Member[];
}

export function AgrupadoresManager() {
  const [list, setList] = useState<Agrupador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [options, setOptions] = useState<Options | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/agrupadores");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setList(j.agrupadores ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando agrupadores");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function ensureOptions() {
    if (options || optionsLoading) return;
    setOptionsLoading(true);
    try {
      const r = await fetch("/api/admin/agrupadores/options");
      const j = await r.json();
      if (r.ok) setOptions(j as Options);
    } finally {
      setOptionsLoading(false);
    }
  }

  function openCreate() {
    setDraft(emptyDraft());
    ensureOptions();
  }
  function openEdit(a: Agrupador) {
    setDraft({
      id: a.id,
      nombre: a.nombre,
      descripcion: a.descripcion ?? "",
      icono: a.icono ?? "megaphone",
      meta_mensual: a.meta_mensual != null ? String(a.meta_mensual) : "",
      is_active: a.is_active,
      members: a.members.map((m) => ({ ...m })),
    });
    ensureOptions();
  }

  async function save() {
    if (!draft) return;
    if (draft.nombre.trim() === "") {
      setError("Ponle un nombre al agrupador.");
      return;
    }
    if (draft.members.length === 0) {
      setError("Agrega al menos un miembro.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/agrupadores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          nombre: draft.nombre.trim(),
          descripcion: draft.descripcion.trim() || null,
          icono: draft.icono,
          meta_mensual: draft.meta_mensual.trim() === "" ? null : Number(draft.meta_mensual),
          is_active: draft.is_active,
          members: draft.members,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDraft(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Agrupador) {
    if (
      !confirm(
        `¿Borrar el agrupador "${a.nombre}"?${
          a.assigned_users > 0
            ? `\n\nEstá asignado a ${a.assigned_users} usuario(s); se les quitará.`
            : ""
        }`
      )
    )
      return;
    setDeletingId(a.id);
    setError(null);
    try {
      const r = await fetch("/api/admin/agrupadores/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error borrando");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section
      className="rounded-[var(--radius-lg)] border p-5"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Agrupadores
          </h2>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <Plus size={15} /> Crear agrupador
          </button>
        )}
      </div>
      <p className="mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        Territorios virtuales: agrupan clientes, productos, grupos o territorios y se
        asignan a usuarios (KAMs, campañas) en{" "}
        <span style={{ color: "var(--text-primary)" }}>Usuarios</span>. Sus datos son la{" "}
        <strong>unión</strong> de sus miembros.
      </p>

      {error && (
        <div
          className="mb-3 flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
          style={{ background: "var(--danger-soft)", borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          <X size={13} /> {error}
        </div>
      )}

      {draft ? (
        <DraftForm
          draft={draft}
          setDraft={setDraft}
          options={options}
          optionsLoading={optionsLoading}
          saving={saving}
          onSave={save}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
        />
      ) : loading ? (
        <div className="flex items-center gap-2 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={15} className="animate-spin" /> Cargando…
        </div>
      ) : list.length === 0 ? (
        <div className="py-6 text-sm" style={{ color: "var(--text-muted)" }}>
          Aún no hay agrupadores. Crea el primero (ej. una campaña por grupo de producto, o la
          cartera de un KAM).
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <AgrupadorRow
              key={a.id}
              a={a}
              onEdit={() => openEdit(a)}
              onDelete={() => remove(a)}
              deleting={deletingId === a.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AgrupadorRow({
  a,
  onEdit,
  onDelete,
  deleting,
}: {
  a: Agrupador;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const Icon = iconComp(a.icono);
  const counts = useMemo(() => {
    const c = new Map<MemberType, number>();
    for (const m of a.members) c.set(m.member_type, (c.get(m.member_type) ?? 0) + 1);
    return TYPES.filter((t) => c.get(t.key)).map((t) => `${c.get(t.key)} ${t.labelPl.toLowerCase()}`);
  }, [a.members]);
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border px-3 py-2.5"
      style={{
        background: "var(--bg-surface-muted)",
        borderColor: "var(--border)",
        opacity: a.is_active ? 1 : 0.6,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Icon size={16} />
        </span>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {a.nombre}
            {!a.is_active && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}>
                inactivo
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {counts.join(" · ") || "sin miembros"} · {a.assigned_users} usuario(s)
            {a.meta_mensual != null && ` · meta $${a.meta_mensual.toLocaleString("es-MX")}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Borrar"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]"
          style={{ color: "var(--danger)" }}
        >
          {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        </button>
      </div>
    </div>
  );
}

function DraftForm({
  draft,
  setDraft,
  options,
  optionsLoading,
  saving,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  options: Options | null;
  optionsLoading: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [activeType, setActiveType] = useState<MemberType>("cliente");
  const [query, setQuery] = useState("");
  const queryRef = useRef<HTMLInputElement>(null);

  const selectedKeys = useMemo(
    () => new Set(draft.members.map((m) => `${m.member_type}|${m.member_value}`)),
    [draft.members]
  );

  const filtered = useMemo(() => {
    const all = options?.[activeType] ?? [];
    const q = query.trim().toLowerCase();
    const base = q ? all.filter((v) => v.toLowerCase().includes(q)) : all;
    return base.slice(0, 150);
  }, [options, activeType, query]);

  function toggle(value: string) {
    const key = `${activeType}|${value}`;
    if (selectedKeys.has(key)) {
      setDraft({ ...draft, members: draft.members.filter((m) => `${m.member_type}|${m.member_value}` !== key) });
    } else {
      setDraft({ ...draft, members: [...draft.members, { member_type: activeType, member_value: value }] });
    }
  }
  function removeMember(m: Member) {
    setDraft({
      ...draft,
      members: draft.members.filter((x) => !(x.member_type === m.member_type && x.member_value === m.member_value)),
    });
  }

  const total = options?.[activeType]?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Datos básicos */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Nombre
          </span>
          <input
            value={draft.nombre}
            onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
            placeholder="Ej. Campaña Arracheras / KAM Juan Pérez"
            className="w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Meta mensual (opcional)
          </span>
          <input
            type="number"
            value={draft.meta_mensual}
            onChange={(e) => setDraft({ ...draft, meta_mensual: e.target.value })}
            placeholder="$ — déjalo vacío si no aplica"
            className="w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm tabular-nums"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </label>
      </div>

      {/* Ícono */}
      <div className="text-xs">
        <span className="mb-1 block font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Ícono
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map(({ key, Comp }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDraft({ ...draft, icono: key })}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border"
              style={{
                background: draft.icono === key ? "var(--accent-soft)" : "var(--bg-surface)",
                borderColor: draft.icono === key ? "var(--accent)" : "var(--border)",
                color: draft.icono === key ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <Comp size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Picker de miembros */}
      <div
        className="rounded-[var(--radius)] border p-3"
        style={{ background: "var(--bg-surface-muted)", borderColor: "var(--border)" }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActiveType(t.key);
                setQuery("");
                queryRef.current?.focus();
              }}
              className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: activeType === t.key ? "var(--bg-surface)" : "transparent",
                color: activeType === t.key ? "var(--accent)" : "var(--text-secondary)",
                boxShadow: activeType === t.key ? "var(--shadow-card)" : "none",
              }}
            >
              {t.labelPl}
            </button>
          ))}
        </div>

        <div
          className="mb-2 flex items-center gap-2 rounded-[var(--radius-sm)] border px-2"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            ref={queryRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={optionsLoading ? "Cargando valores…" : `Buscar ${activeType}…`}
            disabled={optionsLoading}
            className="flex-1 bg-transparent py-1.5 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        {optionsLoading ? (
          <div className="flex items-center gap-2 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={13} className="animate-spin" /> Cargando opciones…
          </div>
        ) : (
          <div
            className="max-h-48 overflow-y-auto rounded-[var(--radius-sm)] border"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Sin coincidencias.
              </div>
            ) : (
              filtered.map((v) => {
                const checked = selectedKeys.has(`${activeType}|${v}`);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggle(v)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
                    style={{ color: "var(--text-primary)", background: checked ? "var(--accent-soft)" : "transparent" }}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border"
                      style={{
                        borderColor: checked ? "var(--accent)" : "var(--border)",
                        background: checked ? "var(--accent)" : "transparent",
                        color: "#fff",
                      }}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    <span className="truncate">{v}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
        <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          {filtered.length} de {total} {activeType}(s){total > filtered.length ? " — afina la búsqueda" : ""}
        </div>
      </div>

      {/* Miembros seleccionados */}
      <div>
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Miembros ({draft.members.length})
        </span>
        {draft.members.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Aún sin miembros. Elige arriba (la unión de todos define el agrupador).
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {draft.members.map((m) => (
              <span
                key={`${m.member_type}|${m.member_value}`}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)" }}
              >
                <span style={{ color: "var(--text-muted)" }}>{m.member_type}:</span>
                <span style={{ color: "var(--text-primary)" }}>{m.member_value}</span>
                <button type="button" onClick={() => removeMember(m)} style={{ color: "var(--text-muted)" }}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Activo + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          />
          Activo (visible y aplicable)
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--radius)] border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-surface)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-4 py-1.5 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {draft.id ? "Guardar cambios" : "Crear agrupador"}
          </button>
        </div>
      </div>
    </div>
  );
}
