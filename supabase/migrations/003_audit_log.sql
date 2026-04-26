-- ============================================================================
-- Tabla: audit_log
-- Registro inmutable de eventos de seguridad y cambios sensibles.
-- ============================================================================

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

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer el audit log
CREATE POLICY "admins_read_audit"
  ON public.audit_log
  FOR SELECT
  USING (public.current_user_is_admin());

-- Inserción: cualquier user autenticado puede insertar SU PROPIO evento
-- (login/logout). Otros eventos los inserta el backend con service_role.
CREATE POLICY "users_insert_own_audit"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Sin policies de UPDATE/DELETE → audit_log es inmutable.
