-- 020_insights_concentracion_territorios.sql
-- Agrega filtro opcional por territorios al endpoint Insights · Concentración.
--
-- Antes: la función agregaba TODAS las filas visibles para el usuario
-- (filtradas por RLS, que ya restringe a sus allowed_territories).
--
-- Ahora: acepta un parámetro p_territorios opcional para filtrar el
-- universo a un subset específico — refleja la selección del sidebar
-- del dashboard:
--   · single ("Cancún"): p_territorios = ARRAY['Cancún']
--   · aggregated-custom (subset): p_territorios = ARRAY[...los del subset]
--   · aggregated-all (todos): p_territorios = NULL (= RLS filtra todo lo visible)
--   · aggregated-none (vacío): p_territorios = ARRAY[]::text[] (= 0 resultados)
--
-- La RLS sigue activa: incluso si p_territorios incluye territorios fuera
-- de los allowed del usuario, NO los verá porque la policy ya filtra.

CREATE OR REPLACE FUNCTION public.insights_concentracion(
  p_from date,
  p_to date,
  p_dimension text,
  p_territorios text[] DEFAULT NULL
)
RETURNS TABLE (
  name text,
  venta numeric,
  kg numeric,
  margen numeric
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
      ELSE COALESCE(cliente, '(sin nombre)')
    END AS name,
    SUM(venta)::numeric AS venta,
    SUM(kg)::numeric AS kg,
    SUM(margen)::numeric AS margen
  FROM public.sales_rows
  WHERE fecha BETWEEN p_from AND p_to
    AND (
      p_territorios IS NULL
      OR territorio = ANY(p_territorios)
    )
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.insights_concentracion(date, date, text, text[]) IS
  'Tab Insights · Concentración. Acepta p_territorios opcional para filtrar el universo a un subset específico (refleja sidebar del dashboard). NULL = todos los visibles para el usuario. Empty array = ningún resultado. La RLS sigue activa por encima.';

GRANT EXECUTE ON FUNCTION public.insights_concentracion(date, date, text, text[]) TO authenticated;
