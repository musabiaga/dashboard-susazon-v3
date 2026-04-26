-- ============================================================================
-- Dashboard Comercial Susazón V3.0 — Migraciones combinadas
-- ============================================================================
-- Cómo correr esto:
-- 1. Ve a tu proyecto Supabase → SQL Editor → New query
-- 2. Pega TODO este archivo
-- 3. Click "Run" (botón verde abajo a la derecha)
-- 4. Espera ~2 segundos. Si todo OK, verás "Success. No rows returned."
-- ============================================================================

-- Migration 001: users_permissions ----------------------------------------

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

ALTER TABLE public.users_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_permissions"
  ON public.users_permissions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "admins_read_all_permissions"
  ON public.users_permissions FOR SELECT
  USING (public.current_user_is_admin());

CREATE POLICY "admins_manage_permissions"
  ON public.users_permissions FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "users_update_own_theme"
  ON public.users_permissions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Migration 002: territories_state ----------------------------------------

CREATE TABLE public.territories_state (
  territory_name text PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT true,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disabled_at timestamptz,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_territories_state_updated
  BEFORE UPDATE ON public.territories_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.visible_territories_for_current_user()
RETURNS text[] AS $$
DECLARE
  user_territories text[];
  active_territories text[];
BEGIN
  SELECT allowed_territories INTO user_territories
  FROM public.users_permissions
  WHERE user_id = auth.uid();

  SELECT array_agg(territory_name) INTO active_territories
  FROM public.territories_state
  WHERE is_active = true;

  IF user_territories IS NULL THEN
    RETURN COALESCE(active_territories, ARRAY[]::text[]);
  END IF;

  RETURN ARRAY(
    SELECT unnest(user_territories)
    INTERSECT
    SELECT unnest(COALESCE(active_territories, ARRAY[]::text[]))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER TABLE public.territories_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_territories"
  ON public.territories_state FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admins_manage_territories"
  ON public.territories_state FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- Migration 003: audit_log ------------------------------------------------

CREATE TYPE audit_action AS ENUM (
  'login',
  'login_failed',
  'logout',
  'territory_toggle',
  'ptto_change',
  'user_created',
  'user_updated',
  'user_deleted',
  'data_refresh'
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action audit_action NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit"
  ON public.audit_log FOR SELECT
  USING (public.current_user_is_admin());

CREATE POLICY "users_insert_own_audit"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- DONE. Si todo OK, verás "Success. No rows returned." abajo.
-- Tabla creadas:
--   - public.users_permissions
--   - public.territories_state
--   - public.audit_log
-- Helpers RLS:
--   - current_user_role(), current_user_is_admin(), current_user_territories()
--   - visible_territories_for_current_user()
-- ============================================================================
