-- ============================================================================
-- Migration 007: vista kpi_daily_summary
--
-- Pre-agregacion diaria por (fecha, anio, mes, territorio). Usada por el tab
-- Tracking Diario para mostrar venta/margen/kg dia por dia.
--
-- Necesaria por la misma razon que kpi_monthly_summary (migracion 006):
-- un mes completo en sales_rows tiene 8K+ rows que exceden el limite default
-- de 1000 que aplica Supabase a queries directas.
--
-- Para un mes (ej. abril): ~30 dias × 16 territorios = 480 rows. Bajo limite.
-- ============================================================================

CREATE OR REPLACE VIEW public.kpi_daily_summary
WITH (security_invoker = true)
AS
SELECT
  fecha,
  anio,
  mes,
  territorio,
  SUM(venta)  AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg)     AS total_kg
FROM public.sales_rows
GROUP BY fecha, anio, mes, territorio;

COMMENT ON VIEW public.kpi_daily_summary IS
  'Pre-agregacion diaria por territorio. Usado por tab Tracking Diario (chart + tabla).';
