-- ============================================================================
-- Tabla: users_permissions
-- Extiende auth.users con rol, territorios permitidos y preferencias.
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'director',
  'gerente_regional',
  'vendedor'
);

CREATE TYPE theme_preference AS ENUM (
  'clean',
  'editorial',
  'warm-neo'
);

CREATE TABLE public.users_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'vendedor',
  -- NULL = todos los territorios permitidos. Array vacío = ninguno.
  allowed_territories text[],
  can_edit_ptto boolean NOT NULL DEFAULT false,
  theme_preference theme_preference NOT NULL DEFAULT 'clean',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login timestamptz
);

CREATE INDEX idx_users_permissions_email ON public.users_permissions(email);
CREATE INDEX idx_users_permissions_role ON public.users_permissions(role);

-- Trigger para mantener updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_permissions_updated
  BEFORE UPDATE ON public.users_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Helpers para RLS — funciones de rol del usuario actual
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users_permissions WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_permissions
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_territories()
RETURNS text[] AS $$
  SELECT COALESCE(allowed_territories, ARRAY[]::text[])
  FROM public.users_permissions
  WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.users_permissions ENABLE ROW LEVEL SECURITY;

-- Cada usuario puede leer su propio registro
CREATE POLICY "users_read_own_permissions"
  ON public.users_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins pueden leer todos
CREATE POLICY "admins_read_all_permissions"
  ON public.users_permissions
  FOR SELECT
  USING (public.current_user_is_admin());

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "admins_manage_permissions"
  ON public.users_permissions
  FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- Cada usuario puede actualizar su propia theme_preference (y solo eso)
CREATE POLICY "users_update_own_theme"
  ON public.users_permissions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
