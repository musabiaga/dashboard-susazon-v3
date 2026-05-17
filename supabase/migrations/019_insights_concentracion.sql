-- 019_insights_concentracion.sql
-- Función RPC para el tab Insights · Análisis de Concentración.
--
-- Recibe un rango de fechas + dimensión y agrega sales_rows respetando
-- la RLS de territorio del usuario (SECURITY INVOKER).
--
-- Devuelve TODAS las métricas (venta, kg, margen) para que el cliente
-- pueda cambiar entre Pesos/Kilos/Margen$/Margen% sin re-fetch.

CREATE OR REPLACE FUNCTION public.insights_concentracion(
  p_from date,
  p_to date,
  p_dimension text
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
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.insights_concentracion(date, date, text) IS
  'Tab Insights · Concentración. Agrega sales_rows por dimensión (clientes/grupos/productos) en un rango de fechas. Devuelve venta, kg, margen para que el cliente calcule margen % y filtre por métrica. Respeta RLS de territorio del caller.';

GRANT EXECUTE ON FUNCTION public.insights_concentracion(date, date, text) TO authenticated;
