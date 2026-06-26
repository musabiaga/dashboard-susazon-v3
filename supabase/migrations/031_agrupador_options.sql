-- 031_agrupador_options.sql
-- Valores distintos por dimensión (territorio/grupo/familia/sku/cliente) para
-- el picker de miembros de agrupadores en el admin. SECURITY DEFINER para
-- devolver todos los valores del catálogo (el admin tiene acceso total igual).
-- Devuelve un solo row con 5 arrays.

CREATE OR REPLACE FUNCTION public.agrupador_all_options()
RETURNS TABLE(territorios text[], grupos text[], familias text[], skus text[], clientes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(DISTINCT territorio ORDER BY territorio) FROM public.sales_rows WHERE territorio IS NOT NULL AND territorio <> ''),
    (SELECT array_agg(DISTINCT grupo ORDER BY grupo) FROM public.sales_rows WHERE grupo IS NOT NULL AND grupo <> ''),
    (SELECT array_agg(DISTINCT familia ORDER BY familia) FROM public.sales_rows WHERE familia IS NOT NULL AND familia <> ''),
    (SELECT array_agg(DISTINCT sku ORDER BY sku) FROM public.sales_rows WHERE sku IS NOT NULL AND sku <> ''),
    (SELECT array_agg(DISTINCT cliente ORDER BY cliente) FROM public.sales_rows WHERE cliente IS NOT NULL AND cliente <> '');
$$;

GRANT EXECUTE ON FUNCTION public.agrupador_all_options() TO authenticated;
COMMENT ON FUNCTION public.agrupador_all_options() IS 'Valores distintos por dimension (territorio/grupo/familia/sku/cliente) para el picker de miembros de agrupadores. Admin.';
