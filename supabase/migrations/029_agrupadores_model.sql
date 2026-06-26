-- 029_agrupadores_model.sql
-- Modelo de datos de "Agrupadores": territorios virtuales configurables que
-- agrupan cualquier combinación de territorio/grupo/familia/SKU/cliente y se
-- comportan como un territorio (visualización + frontera de seguridad).
--
-- Fase 1 (este archivo): solo el MODELO (tablas + columna de asignación).
-- La RLS que los hace cumplir va en la migración 030.
--
-- Semántica: un agrupador = lista FIJA de miembros tipados; sus datos = la
-- UNIÓN de esos miembros (un row pertenece si casa con CUALQUIER miembro).
-- Un miembro tipo 'grupo'/'familia' incluye sus SKUs nuevos automáticamente.

-- Catálogo de agrupadores
CREATE TABLE IF NOT EXISTS public.agrupadores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  descripcion   text,
  meta_mensual  numeric,                 -- meta manual opcional (PTTO sintético, Fase 3)
  icono         text,                    -- ícono opcional para el sidebar
  color         text,                    -- color opcional
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,                    -- admin que lo creó (auth.uid)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agrupadores_nombre_uniq
  ON public.agrupadores (lower(nombre));

-- Miembros de cada agrupador (tipados)
CREATE TABLE IF NOT EXISTS public.agrupador_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agrupador_id  uuid NOT NULL REFERENCES public.agrupadores(id) ON DELETE CASCADE,
  member_type   text NOT NULL CHECK (member_type IN ('territorio','grupo','familia','sku','cliente')),
  member_value  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agrupador_id, member_type, member_value)
);
CREATE INDEX IF NOT EXISTS agrupador_members_agrupador_idx
  ON public.agrupador_members (agrupador_id);

-- Asignación a usuarios (paralelo a allowed_territories). NULL/[] = ninguno.
ALTER TABLE public.users_permissions
  ADD COLUMN IF NOT EXISTS allowed_agrupadores uuid[];

-- RLS: estas tablas las gestiona SOLO el admin (vía API con service_role, que
-- bypassa RLS). La función de scope (migración 030) es SECURITY DEFINER y las
-- lee por dentro, así que el usuario normal no necesita SELECT directo.
ALTER TABLE public.agrupadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agrupador_members ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agrupadores IS 'Agrupadores (territorios virtuales): unión configurable de territorio/grupo/familia/sku/cliente. Se asignan a usuarios y se comportan como un territorio.';
COMMENT ON TABLE public.agrupador_members IS 'Miembros tipados de cada agrupador. Un row de sales_rows pertenece al agrupador si casa con cualquiera de sus miembros.';
COMMENT ON COLUMN public.users_permissions.allowed_agrupadores IS 'IDs de agrupadores asignados al usuario (acceso aditivo a allowed_territories).';
