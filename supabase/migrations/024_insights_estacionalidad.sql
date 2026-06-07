-- 024_insights_estacionalidad.sql
-- Datos para el sub-análisis "Estacionalidad (heatmap)" del tab Insights.
--
-- Para un año + dimensión, devuelve el valor mensual (kg y venta) de cada
-- item, limitado al Top N por la métrica elegida (para que dimensiones de
-- alta cardinalidad como clientes/SKUs no rompan el heatmap). Dimensiones
-- chicas (grupos/territorios) se piden con un Top N alto y salen completas.
--
-- El frontend pivotea a 12 meses y calcula el ÍNDICE de estacionalidad
-- (valor_mes ÷ promedio_mensual_del_item × 100). RLS de territorio activa.

CREATE OR REPLACE FUNCTION public.insights_estacionalidad(
  p_year int,
  p_dimension text,
  p_metric text,
  p_territorios text[] DEFAULT NULL,
  p_topn int DEFAULT 15
)
RETURNS TABLE (
  name text,
  mes smallint,
  kg numeric,
  venta numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  WITH base AS (
    SELECT
      CASE p_dimension
        WHEN 'clientes' THEN COALESCE(cliente, '(sin nombre)')
        WHEN 'grupos' THEN COALESCE(grupo, '(sin grupo)')
        WHEN 'productos' THEN COALESCE(sku, '(sin sku)')
        WHEN 'territorios' THEN COALESCE(territorio, '(sin territorio)')
        ELSE COALESCE(grupo, '(sin grupo)')
      END AS name,
      mes,
      kg,
      venta
    FROM public.sales_rows
    WHERE anio = p_year
      AND (
        p_territorios IS NULL
        OR territorio = ANY(p_territorios)
      )
  ),
  agg AS (
    SELECT name, mes, SUM(kg)::numeric AS kg, SUM(venta)::numeric AS venta
    FROM base
    GROUP BY name, mes
  ),
  top AS (
    SELECT name
    FROM agg
    GROUP BY name
    ORDER BY SUM(CASE WHEN p_metric = 'kg' THEN kg ELSE venta END) DESC
    LIMIT GREATEST(1, p_topn)
  )
  SELECT a.name, a.mes::smallint, a.kg, a.venta
  FROM agg a
  JOIN top t ON a.name = t.name;
$$;

COMMENT ON FUNCTION public.insights_estacionalidad(int, text, text, text[], int) IS
  'Tab Insights · Estacionalidad. Valor mensual (kg/venta) por item del Top N (por p_metric) de la dimensión, para un año. El frontend calcula el índice. RLS activa.';

GRANT EXECUTE ON FUNCTION public.insights_estacionalidad(int, text, text, text[], int) TO authenticated;
