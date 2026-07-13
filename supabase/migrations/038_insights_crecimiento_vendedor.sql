-- 038_insights_crecimiento_vendedor.sql
-- 6º sub-análisis de Insights: "Crecimiento por Vendedor".
-- Tabla comparativa Año Anterior vs Año Actual, por cliente o producto,
-- filtrable por vendedor (+ territorio/agrupador del sidebar).
--
-- COMPARACIÓN JUSTA: la ventana se define por la ÚLTIMA fecha con datos
-- (ref = max(fecha) visible por RLS). Ambos años se capan al MISMO día:
--   · Mes   = [día 1 del mes de ref .. ref]         (año actual) y su espejo -1 año.
--   · Acum  = [1-ene .. ref]                         (año actual) y su espejo -1 año.
-- Devuelve venta/kg/margen crudos de las 4 celdas → el frontend deriva la
-- medición activa (Kg | $ | Margen% | Margen$) y el crecimiento sin recargar.
-- SECURITY INVOKER → hereda la RLS de territorio del usuario.

CREATE OR REPLACE FUNCTION public.insights_crecimiento_vendedor(
  p_dimension text,                         -- 'clientes' | 'productos'
  p_vendedor text DEFAULT NULL,             -- NULL = todos
  p_territorios text[] DEFAULT NULL,        -- selección del sidebar
  p_agrupador_id uuid DEFAULT NULL          -- modo agrupador
)
RETURNS TABLE(
  name text,
  aa_mes_venta numeric, aa_mes_kg numeric, aa_mes_margen numeric,
  aa_ytd_venta numeric, aa_ytd_kg numeric, aa_ytd_margen numeric,
  act_mes_venta numeric, act_mes_kg numeric, act_mes_margen numeric,
  act_ytd_venta numeric, act_ytd_kg numeric, act_ytd_margen numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ref AS (SELECT MAX(fecha) AS d FROM public.sales_rows),
  bounds AS (
    SELECT
      d::date                                                        AS act_hi,
      date_trunc('month', d)::date                                   AS act_mes_lo,
      date_trunc('year',  d)::date                                   AS act_ytd_lo,
      (d - INTERVAL '1 year')::date                                  AS aa_hi,
      date_trunc('month', d - INTERVAL '1 year')::date               AS aa_mes_lo,
      date_trunc('year',  d - INTERVAL '1 year')::date               AS aa_ytd_lo
    FROM ref
  )
  SELECT
    CASE p_dimension WHEN 'productos' THEN COALESCE(s.sku, '(sin sku)')
                     ELSE COALESCE(s.cliente, '(sin nombre)') END AS name,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.aa_mes_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.aa_ytd_lo  AND b.aa_hi), 0)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.act_mes_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.fecha BETWEEN b.act_ytd_lo AND b.act_hi), 0)::numeric
  FROM public.sales_rows s CROSS JOIN bounds b
  WHERE s.fecha BETWEEN b.aa_ytd_lo AND b.act_hi         -- solo los 2 años relevantes
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

-- Metadata: fecha de corte (para etiquetas "Jul 2026 · al día 6") + lista de
-- vendedores en el scope (para el dropdown; NO filtra por vendedor).
CREATE OR REPLACE FUNCTION public.insights_crecimiento_meta(
  p_territorios text[] DEFAULT NULL,
  p_agrupador_id uuid DEFAULT NULL
)
RETURNS TABLE(ref_date date, vendedores text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    (SELECT MAX(fecha)::date FROM public.sales_rows) AS ref_date,
    COALESCE((
      SELECT array_agg(v ORDER BY v) FROM (
        SELECT DISTINCT s.vendedor AS v
        FROM public.sales_rows s
        WHERE s.vendedor IS NOT NULL AND s.vendedor <> ''
          AND (CASE WHEN p_agrupador_id IS NULL
            THEN (p_territorios IS NULL OR s.territorio = ANY(p_territorios))
            ELSE (s.territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
               OR s.grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
               OR s.familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
               OR s.sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
               OR s.cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
            END)
      ) t
    ), ARRAY[]::text[]) AS vendedores;
$$;
GRANT EXECUTE ON FUNCTION public.insights_crecimiento_meta(text[], uuid) TO authenticated;
