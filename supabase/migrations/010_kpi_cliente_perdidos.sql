-- ============================================================================
-- Migration 010: kpi_cliente_perdidos
--
-- Pre-agregacion por cliente x territorio x anio con dos dimensiones:
--   - Mes actual: SUM(venta/kg) WHERE mes = EXTRACT(MONTH FROM CURRENT_DATE)
--   - YTD: SUM(venta/kg) WHERE mes <= EXTRACT(MONTH FROM CURRENT_DATE)
--
-- Permite tab Perdidos comparar (2025 vs 2026) en ambas dimensiones para
-- ver: clientes que perdimos este mes y clientes que perdimos en lo que
-- llevamos del año.
--
-- security_invoker = true: respeta RLS del usuario.
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
  COALESCE(SUM(s.venta) FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_venta,
  COALESCE(SUM(s.kg)    FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_kg,
  COALESCE(SUM(s.venta) FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_venta,
  COALESCE(SUM(s.kg)    FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_kg
FROM public.sales_rows s
WHERE s.no_cliente IS NOT NULL
GROUP BY s.anio, s.no_cliente, s.cliente, s.vendedor, s.territorio;

COMMENT ON VIEW public.kpi_cliente_perdidos IS
  'Pre-agregacion cliente x territorio x anio con mes actual y YTD (venta+kg). Tab Perdidos.';
