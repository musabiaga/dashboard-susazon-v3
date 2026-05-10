-- ============================================================================
-- Migration 012: extender kpi_cliente_perdidos con MARGEN
--
-- La vista kpi_cliente_perdidos ya pre-agregaba (anio, no_cliente, cliente,
-- vendedor, territorio) con mes_venta, mes_kg, ytd_venta, ytd_kg. Faltaba
-- margen para poder calcular "venta perdida" en margen $ y % en la dona
-- de status del tab Perdidos.
--
-- Agrega: mes_margen, ytd_margen al FINAL (CREATE OR REPLACE VIEW no permite
-- reordenar columnas de vistas existentes, solo agregar al final).
-- ============================================================================

CREATE OR REPLACE VIEW public.kpi_cliente_perdidos
WITH (security_invoker = true)
AS
WITH curr AS (
  SELECT EXTRACT(MONTH FROM CURRENT_DATE)::int AS m
)
SELECT
  s.anio,
  s.no_cliente,
  s.cliente,
  s.vendedor,
  s.territorio,
  COALESCE(SUM(s.venta)  FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_venta,
  COALESCE(SUM(s.kg)     FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_kg,
  COALESCE(SUM(s.venta)  FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_venta,
  COALESCE(SUM(s.kg)     FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_kg,
  -- Nuevas columnas margen (al final por restricción de CREATE OR REPLACE VIEW)
  COALESCE(SUM(s.margen) FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_margen,
  COALESCE(SUM(s.margen) FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_margen
FROM public.sales_rows s
WHERE s.no_cliente IS NOT NULL
GROUP BY s.anio, s.no_cliente, s.cliente, s.vendedor, s.territorio;

COMMENT ON VIEW public.kpi_cliente_perdidos IS
  'Pre-agregacion cliente x territorio x anio con mes actual y YTD (venta+kg+margen). Tab Perdidos.';
