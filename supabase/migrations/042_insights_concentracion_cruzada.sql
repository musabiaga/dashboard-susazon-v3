-- 042_insights_concentracion_cruzada.sql
-- =====================================================================
-- Concentración CRUZADA (Insights → Concentración): Pareto por una dimensión
-- ACOTADO por filtros de otras dimensiones. Ejemplos:
--   · Pareto de clientes filtrando por un SKU  → ¿quién compra más ese SKU?
--   · Pareto de territorios filtrando por un SKU → ¿qué territorio lo desplaza más?
--   · Pareto de SKUs filtrando por un cliente/grupo/familia, etc. (cualquier cruce)
--
-- Función NUEVA (no toca insights_concentracion, para no romper Agrupadores):
--   - Replica la lógica actual: filtro de territorios + rama de agrupador
--     (mismo comportamiento que insights_concentracion 5-arg, migr 036).
--   - Agrega 4 filtros cruzados opcionales: p_clientes / p_skus / p_grupos /
--     p_familias (cada uno NULL = sin filtrar por esa dimensión).
--   - Agrega 'familias' como dimensión del Pareto.
--
-- SECURITY INVOKER → hereda la RLS de territorio del usuario.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.insights_concentracion_cruzada(
  p_from        date,
  p_to          date,
  p_dimension   text,                 -- Pareto por: clientes|grupos|productos|territorios|familias
  p_territorios text[] DEFAULT NULL,  -- selección del sidebar
  p_agrupador_id uuid  DEFAULT NULL,  -- modo agrupador (si aplica)
  p_clientes    text[] DEFAULT NULL,  -- cruce: filtrar a estos clientes
  p_skus        text[] DEFAULT NULL,  -- cruce: filtrar a estos SKUs
  p_grupos      text[] DEFAULT NULL,  -- cruce: filtrar a estos grupos
  p_familias    text[] DEFAULT NULL   -- cruce: filtrar a estas familias
)
RETURNS TABLE(name text, venta numeric, kg numeric, margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    CASE p_dimension
      WHEN 'clientes'    THEN COALESCE(cliente, '(sin nombre)')
      WHEN 'grupos'      THEN COALESCE(grupo, '(sin grupo)')
      WHEN 'productos'   THEN COALESCE(sku, '(sin sku)')
      WHEN 'territorios' THEN COALESCE(territorio, '(sin territorio)')
      WHEN 'familias'    THEN COALESCE(familia, '(sin familia)')
      ELSE COALESCE(cliente, '(sin nombre)')
    END AS name,
    SUM(venta)::numeric AS venta, SUM(kg)::numeric AS kg, SUM(margen)::numeric AS margen
  FROM public.sales_rows
  WHERE fecha BETWEEN p_from AND p_to
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
      ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
    -- Filtros cruzados (cada uno opcional): acotan el universo antes del Pareto.
    AND (p_clientes IS NULL OR cliente = ANY(p_clientes))
    AND (p_skus     IS NULL OR sku     = ANY(p_skus))
    AND (p_grupos   IS NULL OR grupo   = ANY(p_grupos))
    AND (p_familias IS NULL OR familia = ANY(p_familias))
  GROUP BY 1
  ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.insights_concentracion_cruzada(date, date, text, text[], uuid, text[], text[], text[], text[]) TO authenticated;
