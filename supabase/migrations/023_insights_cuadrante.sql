-- 023_insights_cuadrante.sql
-- Datos para el sub-análisis "Cuadrante de cartera (BCG)" del tab Insights.
--
-- Para cada item de la dimensión (clientes|grupos|productos|territorios),
-- devuelve venta/kg/margen del periodo ACTUAL [p_from, p_to] y la venta del
-- MISMO rango calendario del año anterior [p_from_prev, p_to_prev]. Con eso el
-- frontend calcula:
--   · tamaño   = venta_actual (eje X, log)
--   · crecim.  = (venta_actual − venta_prev) / venta_prev   (eje Y, %)
--   · margen   = margen_actual (burbuja)
--   · "Nuevos" = items con venta_actual > 0 y venta_prev = 0 (sin base)
--
-- Solo devuelve items con venta_actual > 0 (la cartera viva del periodo).
-- La RLS de territorio sigue activa por encima.

CREATE OR REPLACE FUNCTION public.insights_cuadrante(
  p_from date,
  p_to date,
  p_from_prev date,
  p_to_prev date,
  p_dimension text,
  p_territorios text[] DEFAULT NULL
)
RETURNS TABLE (
  name text,
  venta_actual numeric,
  kg_actual numeric,
  margen_actual numeric,
  venta_prev numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT
    CASE p_dimension
      WHEN 'clientes' THEN COALESCE(cliente, '(sin nombre)')
      WHEN 'grupos' THEN COALESCE(grupo, '(sin grupo)')
      WHEN 'productos' THEN COALESCE(sku, '(sin sku)')
      WHEN 'territorios' THEN COALESCE(territorio, '(sin territorio)')
      ELSE COALESCE(cliente, '(sin nombre)')
    END AS name,
    COALESCE(SUM(venta) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS venta_actual,
    COALESCE(SUM(kg) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS kg_actual,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS margen_actual,
    COALESCE(SUM(venta) FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS venta_prev
  FROM public.sales_rows
  WHERE (
      fecha BETWEEN p_from AND p_to
      OR fecha BETWEEN p_from_prev AND p_to_prev
    )
    AND (
      p_territorios IS NULL
      OR territorio = ANY(p_territorios)
    )
  GROUP BY 1
  HAVING COALESCE(SUM(venta) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0) > 0;
$$;

COMMENT ON FUNCTION public.insights_cuadrante(date, date, date, date, text, text[]) IS
  'Tab Insights · Cuadrante BCG. venta/kg/margen actual + venta del mismo rango año anterior, por dimensión. Solo items con venta_actual>0. RLS activa.';

GRANT EXECUTE ON FUNCTION public.insights_cuadrante(date, date, date, date, text, text[]) TO authenticated;
