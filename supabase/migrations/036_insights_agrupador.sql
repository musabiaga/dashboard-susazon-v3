-- 036_insights_agrupador.sql
-- Fase 2b: Insights en la vista enfocada de agrupador.
-- Cada función insights_* recibe un nuevo param p_agrupador_id uuid (DEFAULT
-- NULL). El filtro de scope se "branchea":
--   · p_agrupador_id IS NULL → comportamiento IDÉNTICO (filtro por territorios).
--   · p_agrupador_id presente → filtra por la UNIÓN de miembros del agrupador.
-- El CASE en el WHERE cortocircuita: en modo normal NO evalúa las subconsultas
-- del agrupador → cero overhead. agrupador_member_arrays está gateado al
-- usuario, así que solo puede usar agrupadores asignados.
--
-- Se hace DROP + CREATE porque agregar un parámetro cambia la firma.

-- ============================================================
-- 1) Concentración
-- ============================================================
DROP FUNCTION IF EXISTS public.insights_concentracion(date, date, text, text[]);
CREATE FUNCTION public.insights_concentracion(p_from date, p_to date, p_dimension text, p_territorios text[] DEFAULT NULL::text[], p_agrupador_id uuid DEFAULT NULL)
 RETURNS TABLE(name text, venta numeric, kg numeric, margen numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
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
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
      ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.insights_concentracion(date, date, text, text[], uuid) TO authenticated;

-- ============================================================
-- 2) Cuadrante (BCG)
-- ============================================================
DROP FUNCTION IF EXISTS public.insights_cuadrante(date, date, date, date, text, text[]);
CREATE FUNCTION public.insights_cuadrante(p_from date, p_to date, p_from_prev date, p_to_prev date, p_dimension text, p_territorios text[] DEFAULT NULL::text[], p_agrupador_id uuid DEFAULT NULL)
 RETURNS TABLE(name text, venta_actual numeric, kg_actual numeric, margen_actual numeric, venta_prev numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
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
  WHERE (fecha BETWEEN p_from AND p_to OR fecha BETWEEN p_from_prev AND p_to_prev)
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
      ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
  GROUP BY 1
  HAVING COALESCE(SUM(venta) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0) > 0;
$function$;
GRANT EXECUTE ON FUNCTION public.insights_cuadrante(date, date, date, date, text, text[], uuid) TO authenticated;

-- ============================================================
-- 3) Estacionalidad
-- ============================================================
DROP FUNCTION IF EXISTS public.insights_estacionalidad(integer, text, text, text[], integer);
CREATE FUNCTION public.insights_estacionalidad(p_year integer, p_dimension text, p_metric text, p_territorios text[] DEFAULT NULL::text[], p_topn integer DEFAULT 15, p_agrupador_id uuid DEFAULT NULL)
 RETURNS TABLE(name text, mes smallint, kg numeric, venta numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      CASE p_dimension
        WHEN 'clientes' THEN COALESCE(cliente, '(sin nombre)')
        WHEN 'grupos' THEN COALESCE(grupo, '(sin grupo)')
        WHEN 'productos' THEN COALESCE(sku, '(sin sku)')
        WHEN 'territorios' THEN COALESCE(territorio, '(sin territorio)')
        ELSE COALESCE(grupo, '(sin grupo)')
      END AS name,
      mes, kg, venta
    FROM public.sales_rows
    WHERE anio = p_year
      AND (CASE WHEN p_agrupador_id IS NULL
        THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
        ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
           OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
           OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
           OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
           OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
        END)
  ),
  agg AS (SELECT name, mes, SUM(kg)::numeric AS kg, SUM(venta)::numeric AS venta FROM base GROUP BY name, mes),
  top AS (SELECT name FROM agg GROUP BY name ORDER BY SUM(CASE WHEN p_metric = 'kg' THEN kg ELSE venta END) DESC LIMIT GREATEST(1, p_topn))
  SELECT a.name, a.mes::smallint, a.kg, a.venta FROM agg a JOIN top t ON a.name = t.name;
$function$;
GRANT EXECUTE ON FUNCTION public.insights_estacionalidad(integer, text, text, text[], integer, uuid) TO authenticated;

-- ============================================================
-- 4) Penetración (resumen)
-- ============================================================
DROP FUNCTION IF EXISTS public.insights_penetracion(date, date, date, date, text, text[]);
CREATE FUNCTION public.insights_penetracion(p_from date, p_to date, p_from_prev date, p_to_prev date, p_dimension text, p_territorios text[] DEFAULT NULL::text[], p_agrupador_id uuid DEFAULT NULL)
 RETURNS TABLE(name text, n_actual bigint, n_prev bigint, venta_actual numeric, venta_prev numeric, margen_actual numeric, margen_prev numeric, kg_actual numeric, kg_prev numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT
    CASE p_dimension WHEN 'productos' THEN COALESCE(sku, '(sin sku)') ELSE COALESCE(cliente, '(sin nombre)') END AS name,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN cliente ELSE sku END)) FILTER (WHERE fecha BETWEEN p_from AND p_to) AS n_actual,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN cliente ELSE sku END)) FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev) AS n_prev,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS venta_actual,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS venta_prev,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS margen_actual,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS margen_prev,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS kg_actual,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS kg_prev
  FROM public.sales_rows
  WHERE (fecha BETWEEN p_from AND p_to OR fecha BETWEEN p_from_prev AND p_to_prev)
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
      ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
  GROUP BY 1;
$function$;
GRANT EXECUTE ON FUNCTION public.insights_penetracion(date, date, date, date, text, text[], uuid) TO authenticated;

-- ============================================================
-- 5) Penetración (detalle / drill-down)
-- ============================================================
DROP FUNCTION IF EXISTS public.insights_penetracion_detalle(date, date, date, date, text, text, text[]);
CREATE FUNCTION public.insights_penetracion_detalle(p_from date, p_to date, p_from_prev date, p_to_prev date, p_dimension text, p_key text, p_territorios text[] DEFAULT NULL::text[], p_agrupador_id uuid DEFAULT NULL)
 RETURNS TABLE(name text, venta_actual numeric, venta_prev numeric, margen_actual numeric, margen_prev numeric, kg_actual numeric, kg_prev numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT
    CASE p_dimension WHEN 'productos' THEN COALESCE(cliente, '(sin nombre)') ELSE COALESCE(sku, '(sin sku)') END AS name,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS venta_actual,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS venta_prev,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS margen_actual,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS margen_prev,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS kg_actual,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS kg_prev
  FROM public.sales_rows
  WHERE (fecha BETWEEN p_from AND p_to OR fecha BETWEEN p_from_prev AND p_to_prev)
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
      ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
    AND (CASE p_dimension WHEN 'productos' THEN sku ELSE cliente END) = p_key
  GROUP BY 1;
$function$;
GRANT EXECUTE ON FUNCTION public.insights_penetracion_detalle(date, date, date, date, text, text, text[], uuid) TO authenticated;

-- ============================================================
-- 6) Precio (items)
-- ============================================================
DROP FUNCTION IF EXISTS public.insights_precio_items(date, date, text, text[]);
CREATE FUNCTION public.insights_precio_items(p_from date, p_to date, p_level text, p_territorios text[] DEFAULT NULL::text[], p_agrupador_id uuid DEFAULT NULL)
 RETURNS TABLE(name text, kg numeric, venta numeric)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
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
    AND (CASE WHEN p_agrupador_id IS NULL
      THEN (p_territorios IS NULL OR territorio = ANY(p_territorios))
      ELSE (territorio = ANY(COALESCE((SELECT territorios FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR grupo   = ANY(COALESCE((SELECT grupos     FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR familia = ANY(COALESCE((SELECT familias   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR sku     = ANY(COALESCE((SELECT skus       FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[]))
         OR cliente = ANY(COALESCE((SELECT clientes   FROM public.agrupador_member_arrays(p_agrupador_id)), ARRAY[]::text[])))
      END)
    AND kg > 0
  GROUP BY 1
  ORDER BY 2 DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.insights_precio_items(date, date, text, text[], uuid) TO authenticated;
