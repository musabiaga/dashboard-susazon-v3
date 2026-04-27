-- ============================================================================
-- Migration 009: kpi_vendedor_summary con empresa
--
-- V2.2 mostraba vendedores con sufijo (Sus)/(Suve) cuando una persona
-- vendía en ambas empresas. La vista original kpi_vendedor_summary (de
-- migración 008) aggregaba por (anio, mes, territorio, vendedor) y mezclaba
-- automaticamente las ventas de ambas empresas en una sola fila.
--
-- Esta migración recrea la vista incluyendo `empresa` en el GROUP BY para
-- que el código pueda:
--   1) Mostrar separados (con sufijo): "ANGEL (Sus)" y "ANGEL (Suve)"
--      como dos filas distintas (replica V2.2).
--   2) Toggle "Unir Sus+Suve": agregar en JS para mostrarlos consolidados.
-- ============================================================================

DROP VIEW IF EXISTS public.kpi_vendedor_summary;

CREATE VIEW public.kpi_vendedor_summary
WITH (security_invoker = true)
AS
SELECT
  anio, mes, territorio, empresa,
  COALESCE(vendedor, '(sin vendedor)') AS vendedor,
  SUM(venta)  AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg)     AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, territorio, empresa, vendedor;

COMMENT ON VIEW public.kpi_vendedor_summary IS
  'Pre-agregacion por vendedor x empresa. Tab Vendedores: separados con sufijo (Sus)/(Suve) por defecto, toggle para unir.';
