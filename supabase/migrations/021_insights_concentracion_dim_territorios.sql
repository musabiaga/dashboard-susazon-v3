-- 021_insights_concentracion_dim_territorios.sql
-- Agrega 'territorios' como DIMENSIÓN de agrupación al análisis de
-- Concentración del tab Insights.
--
-- Contexto: la migración 020 agregó `territorio` solo como FILTRO opcional
-- del universo (p_territorios). Esta migración lo agrega además como una
-- dimensión por la que se puede AGRUPAR (p_dimension = 'territorios'),
-- para medir qué tan concentrado está el negocio entre territorios.
--
-- Notas:
--   · Si el sidebar tiene un solo territorio seleccionado (p_territorios =
--     ARRAY['Cancún']) y p_dimension = 'territorios', el resultado será ese
--     único territorio — comportamiento esperado. Para comparar entre
--     territorios, el sidebar debe estar en "Todos" (p_territorios = NULL).
--   · La RLS sigue activa por encima: el usuario solo ve sus allowed_territories.

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
      WHEN 'territorios' THEN COALESCE(territorio, '(sin territorio)')
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
  'Tab Insights · Concentración. p_dimension: clientes|grupos|productos|territorios. p_territorios opcional filtra el universo a un subset (refleja sidebar). NULL = todos los visibles. RLS activa por encima.';

GRANT EXECUTE ON FUNCTION public.insights_concentracion(date, date, text, text[]) TO authenticated;
