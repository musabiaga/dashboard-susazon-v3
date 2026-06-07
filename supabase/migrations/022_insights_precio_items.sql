-- 022_insights_precio_items.sql
-- Lista de items por NIVEL (sku | grupo | familia) para el sub-análisis
-- "Dispersión de precio ($/kg)" del tab Insights.
--
-- Devuelve, para el rango y territorios dados, cada item con su volumen (kg)
-- y venta acumulados — ordenado por volumen desc. Alimenta el selector de
-- item (default = el de mayor volumen) y permite calcular el precio/kg
-- promedio ponderado (venta ÷ kg) en el cliente.
--
-- El desglose por cliente de un item se resuelve en el endpoint con una
-- query directa a sales_rows (filas acotadas al item), no aquí.

CREATE OR REPLACE FUNCTION public.insights_precio_items(
  p_from date,
  p_to date,
  p_level text,
  p_territorios text[] DEFAULT NULL
)
RETURNS TABLE (
  name text,
  kg numeric,
  venta numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT
    CASE p_level
      WHEN 'sku' THEN COALESCE(sku, '(sin sku)')
      WHEN 'grupo' THEN COALESCE(grupo, '(sin grupo)')
      WHEN 'familia' THEN COALESCE(familia, '(sin familia)')
      ELSE COALESCE(sku, '(sin sku)')
    END AS name,
    SUM(kg)::numeric AS kg,
    SUM(venta)::numeric AS venta
  FROM public.sales_rows
  WHERE fecha BETWEEN p_from AND p_to
    AND (
      p_territorios IS NULL
      OR territorio = ANY(p_territorios)
    )
    AND kg > 0
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.insights_precio_items(date, date, text, text[]) IS
  'Tab Insights · Dispersión de precio. Lista items por nivel (sku|grupo|familia) con kg+venta acumulados en el rango, ordenados por volumen. RLS activa por encima.';

GRANT EXECUTE ON FUNCTION public.insights_precio_items(date, date, text, text[]) TO authenticated;
