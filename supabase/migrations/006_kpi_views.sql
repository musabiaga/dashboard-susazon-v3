-- ============================================================================
-- Migration 006: vistas KPI agregadas
--
-- Una vista mensual pre-agregada que evita el limite default de 1000 filas
-- que Supabase aplica a queries directas sobre sales_rows. Un mes completo
-- puede tener 8K+ rows; sin agregar en DB, el dashboard mostraria totales
-- truncados.
--
-- security_invoker = true → la vista respeta el RLS del usuario que consulta
-- (no del owner de la vista). Esto es esencial: vendedores deben ver solo
-- sus territorios via las policies de sales_rows.
-- ============================================================================

CREATE OR REPLACE VIEW public.kpi_monthly_summary
WITH (security_invoker = true)
AS
SELECT
  anio,
  mes,
  territorio,
  SUM(venta)  AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg)     AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, territorio;

COMMENT ON VIEW public.kpi_monthly_summary IS
  'Pre-agregacion mensual por territorio. Usado por dashboard KPIs (mes actual, prev year same month, acum yearly).';
