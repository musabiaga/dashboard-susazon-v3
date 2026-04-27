-- ============================================================================
-- Migration 005: territory_budgets
-- Tabla de presupuestos (PTTO) por territorio × año × mes.
--
-- El usuario actual sólo edita VENTA pero el schema incluye margen y kg para
-- futuras expansiones — agregar campos al editor no requerirá nueva migración.
--
-- RLS:
--   SELECT: usuario ve presupuestos de territorios visibles para él (mismo
--           filtro que sales_rows — admin ve todo, vendedor solo asignados).
--   INSERT/UPDATE/DELETE: solo admin/director.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.territory_budgets (
  territorio    text     NOT NULL,
  anio          smallint NOT NULL CHECK (anio BETWEEN 2024 AND 2030),
  mes           smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  venta_budget  numeric  NOT NULL DEFAULT 0,
  margen_budget numeric  NOT NULL DEFAULT 0, -- preparado para futuro
  kg_budget     numeric  NOT NULL DEFAULT 0, -- preparado para futuro
  updated_by    uuid     REFERENCES auth.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (territorio, anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_territory_budgets_anio_mes
  ON public.territory_budgets(anio, mes);

-- Trigger: actualizar updated_at automáticamente en cada UPDATE
DROP TRIGGER IF EXISTS territory_budgets_updated_at ON public.territory_budgets;
CREATE TRIGGER territory_budgets_updated_at
  BEFORE UPDATE ON public.territory_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.territory_budgets ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario ve presupuestos de territorios que puede acceder.
DROP POLICY IF EXISTS "territory_budgets_select" ON public.territory_budgets;
CREATE POLICY "territory_budgets_select"
  ON public.territory_budgets
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR territorio = ANY(public.visible_territories_for_current_user())
  );

-- INSERT: solo admin/director.
DROP POLICY IF EXISTS "territory_budgets_insert" ON public.territory_budgets;
CREATE POLICY "territory_budgets_insert"
  ON public.territory_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'director'));

-- UPDATE: solo admin/director.
DROP POLICY IF EXISTS "territory_budgets_update" ON public.territory_budgets;
CREATE POLICY "territory_budgets_update"
  ON public.territory_budgets
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'director'))
  WITH CHECK (public.current_user_role() IN ('admin', 'director'));

-- DELETE: solo admin/director.
DROP POLICY IF EXISTS "territory_budgets_delete" ON public.territory_budgets;
CREATE POLICY "territory_budgets_delete"
  ON public.territory_budgets
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('admin', 'director'));

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON TABLE public.territory_budgets IS
  'PTTO mensual por territorio. Editable solo por admin/director.';
COMMENT ON COLUMN public.territory_budgets.venta_budget IS
  'Objetivo de venta en pesos. El único campo que el editor expone hoy.';
COMMENT ON COLUMN public.territory_budgets.margen_budget IS
  'Reservado para uso futuro. UI no lo expone aún.';
COMMENT ON COLUMN public.territory_budgets.kg_budget IS
  'Reservado para uso futuro. UI no lo expone aún.';
