-- 039_crecimiento_variedad.sql
-- Agrega "Variedad" (No. de SKUs / No. de clientes espejo) a
-- insights_crecimiento_vendedor. Por celda: COUNT(DISTINCT campo_espejo)
--   · Dimensión = clientes → variedad = # de SKUs distintos que compró.
--   · Dimensión = productos → variedad = # de clientes distintos que lo compraron.
-- DROP + CREATE porque cambia el RETURNS TABLE (4 columnas nuevas).

DROP FUNCTION IF EXISTS public.insights_crecimiento_vendedor(text, text, text[], uuid);
CREATE FUNCTION public.insights_crecimiento_vendedor(
  p_dimension text, p_vendedor text DEFAULT NULL,
  p_territorios text[] DEFAULT NULL, p_agrupador_id uuid DEFAULT NULL
)
RETURNS TABLE(
  name text,
  aa_mes_venta numeric, aa_mes_kg numeric, aa_mes_margen numeric, aa_mes_var numeric,
  aa_ytd_venta numeric, aa_ytd_kg numeric, aa_ytd_margen numeric, aa_ytd_var numeric,
  act_mes_venta numeric, act_mes_kg numeric, act_mes_margen numeric, act_mes_var numeric,
  act_ytd_venta numeric, act_ytd_kg numeric, act_ytd_margen numeric, act_ytd_var numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ref AS (SELECT MAX(fecha) AS d FROM public.sales_rows),
  bounds AS (
    SELECT d::date AS act_hi, date_trunc('month', d)::date AS act_mes_lo, date_trunc('year', d)::date AS act_ytd_lo,
           (d - INTERVAL '1 year')::date AS aa_hi, date_trunc('month', d - INTERVAL '1 year')::date AS aa_mes_lo,
           date_trunc('year', d - INTERVAL '1 year')::date AS aa_ytd_lo
    FROM ref
  )
  SELECT
    CASE p_dimension WHEN 'productos' THEN COALESCE(s.sku, '(sin sku)') ELSE COALESCE(s.cliente, '(sin nombre)') END AS name,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi), 0)::numeric,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN s.cliente ELSE s.sku END)) FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi), 0)::numeric,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN s.cliente ELSE s.sku END)) FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi), 0)::numeric,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN s.cliente ELSE s.sku END)) FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0)::numeric,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN s.cliente ELSE s.sku END)) FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi)::numeric
  FROM public.sales_rows s CROSS JOIN bounds b
  WHERE s.fecha BETWEEN b.aa_ytd_lo AND b.act_hi
    AND (p_vendedor IS NULL OR s.vendedor = p_vendedor)
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR s.territorio = ANY(p_territorios))
      ELSE (s.territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR s.grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR s.familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR s.sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR s.cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
  GROUP BY 1
  HAVING COALESCE(SUM(s.venta) FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo AND b.aa_hi), 0) <> 0
      OR COALESCE(SUM(s.venta) FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0) <> 0;
$$;
GRANT EXECUTE ON FUNCTION public.insights_crecimiento_vendedor(text, text, text[], uuid) TO authenticated;
