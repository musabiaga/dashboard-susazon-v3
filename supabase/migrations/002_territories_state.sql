-- ============================================================================
-- Tabla: territories_state
-- Toggle global on/off por territorio. Cuando is_active=false, NADIE lo ve
-- (ni los admins del territorio asignados).
-- ============================================================================

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

-- ============================================================================
-- Helper: territorios visibles para el usuario actual
-- (intersección de sus permisos × territorios activos globalmente)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.visible_territories_for_current_user()
RETURNS text[] AS $$
DECLARE
  user_territories text[];
  active_territories text[];
BEGIN
  -- Obtener territorios permitidos del usuario (NULL = todos)
  SELECT allowed_territories INTO user_territories
  FROM public.users_permissions
  WHERE user_id = auth.uid();

  -- Obtener territorios activos globalmente
  SELECT array_agg(territory_name) INTO active_territories
  FROM public.territories_state
  WHERE is_active = true;

  -- Si el usuario tiene NULL en allowed_territories → ve todos los activos
  IF user_territories IS NULL THEN
    RETURN COALESCE(active_territories, ARRAY[]::text[]);
  END IF;

  -- Si no, intersección
  RETURN ARRAY(
    SELECT unnest(user_territories)
    INTERSECT
    SELECT unnest(COALESCE(active_territories, ARRAY[]::text[]))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.territories_state ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer (necesario para el banner de "X apagado")
CREATE POLICY "authenticated_read_territories"
  ON public.territories_state
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo admins pueden modificar
CREATE POLICY "admins_manage_territories"
  ON public.territories_state
  FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());
