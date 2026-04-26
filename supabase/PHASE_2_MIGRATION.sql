-- ============================================================================
-- Dashboard Comercial Susazón V3.0 — Migración Fase 2 (data layer)
-- ============================================================================
-- Cómo correr:
-- 1. Ve a SQL Editor: https://supabase.com/dashboard/project/qfxyrpifntcixwpvnjpd/sql/new
-- 2. Pega TODO este archivo
-- 3. Click "Run"
-- 4. Espera "Success. No rows returned."
-- ============================================================================

-- Tabla sales_rows -------------------------------------------------------

CREATE TABLE public.sales_rows (
  id bigserial PRIMARY KEY,
  empresa smallint NOT NULL CHECK (empresa IN (0, 1)),
  no_cliente text NOT NULL,
  cliente text,
  territorio text NOT NULL,
  vendedor text,
  sku text,
  kg numeric,
  fecha date NOT NULL,
  anio smallint NOT NULL,
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  venta numeric,
  margen numeric,
  familia text,
  grupo text,
  batch_id uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_rows_territorio ON public.sales_rows(territorio);
CREATE INDEX idx_sales_rows_fecha ON public.sales_rows(fecha);
CREATE INDEX idx_sales_rows_anio_mes ON public.sales_rows(anio, mes);
CREATE INDEX idx_sales_rows_batch ON public.sales_rows(batch_id);

-- Tabla sync_history -----------------------------------------------------

CREATE TABLE public.sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  source text NOT NULL,
  date_from date,
  date_to date,
  rows_imported bigint DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sync_history_started ON public.sync_history(started_at DESC);
CREATE INDEX idx_sync_history_status ON public.sync_history(status);

-- Trigger auto-poblar territories_state ----------------------------------

CREATE OR REPLACE FUNCTION public.upsert_territory_on_sales_insert()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.territories_state (territory_name, is_active)
  VALUES (NEW.territorio, true)
  ON CONFLICT (territory_name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sales_rows_register_territory
  AFTER INSERT ON public.sales_rows
  FOR EACH ROW EXECUTE FUNCTION public.upsert_territory_on_sales_insert();

-- Row-Level Security -----------------------------------------------------

ALTER TABLE public.sales_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_visible_territories"
  ON public.sales_rows FOR SELECT
  USING (territorio = ANY(public.visible_territories_for_current_user()));

ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_sync_history"
  ON public.sync_history FOR SELECT
  USING (public.current_user_is_admin());

CREATE POLICY "users_read_own_syncs"
  ON public.sync_history FOR SELECT
  USING (triggered_by = auth.uid());

-- ============================================================================
-- DONE. Tablas creadas:
--   - public.sales_rows (con RLS por territorio)
--   - public.sync_history (con RLS de admin/owner)
-- Trigger: auto-registra territorios nuevos en territories_state
-- ============================================================================
