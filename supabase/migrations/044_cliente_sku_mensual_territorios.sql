-- 044_cliente_sku_mensual_territorios.sql
-- =====================================================================
-- Mejora 1 (V4.3): en el expand mensual del tab Clientes/Productos, cuando el
-- territorio activo es "Todos", mostrar el/los territorio(s) donde cada
-- sub-entidad hizo la venta (reemplaza el "sin comprar desde …").
--
-- Extiende insights_cliente_sku_mensual (migr 041) agregando la columna
-- `territorios text[]` = los territorios DISTINTOS donde esa entidad (name)
-- vendió en ese mes. El endpoint los une entre meses para tener el set por
-- entidad. Cambia la firma de retorno → DROP + CREATE.
--
-- SECURITY INVOKER → respeta la RLS de territorio del usuario (idéntico a 041).
-- =====================================================================

DROP FUNCTION IF EXISTS public.insights_cliente_sku_mensual(int, text, text, text[]);

CREATE FUNCTION public.insights_cliente_sku_mensual(
  p_year        int,
  p_anchor_dim  text,                 -- 'sku' → devuelve clientes | 'cliente' → devuelve SKUs
  p_anchor_value text,                -- el SKU o el cliente ancla
  p_territorios text[] DEFAULT NULL   -- selección del sidebar (RLS adicional)
)
RETURNS TABLE(
  name text, mes smallint, venta numeric, kg numeric, margen numeric,
  territorios text[]
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    CASE WHEN p_anchor_dim = 'sku'
         THEN COALESCE(s.cliente, '(sin nombre)')
         ELSE COALESCE(s.sku, '(sin sku)') END AS name,
    s.mes,
    SUM(s.venta)::numeric  AS venta,
    SUM(s.kg)::numeric     AS kg,
    SUM(s.margen)::numeric AS margen,
    array_agg(DISTINCT COALESCE(s.territorio, '(sin territorio)')) AS territorios
  FROM public.sales_rows s
  WHERE s.anio = p_year
    AND (p_territorios IS NULL OR s.territorio = ANY(p_territorios))
    AND (
      (p_anchor_dim = 'sku'     AND s.sku     = p_anchor_value)
      OR
      (p_anchor_dim = 'cliente' AND s.cliente = p_anchor_value)
    )
  GROUP BY 1, s.mes
  HAVING SUM(s.venta) <> 0;
$$;

GRANT EXECUTE ON FUNCTION public.insights_cliente_sku_mensual(int, text, text, text[]) TO authenticated;
