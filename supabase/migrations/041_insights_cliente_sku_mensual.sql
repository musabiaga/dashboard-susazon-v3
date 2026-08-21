-- 041_insights_cliente_sku_mensual.sql
-- =====================================================================
-- Cruce cliente × SKU × mes para el tab "Clientes y Productos".
--
-- Habilita:
--   · Expand mensual BIDIRECCIONAL en la vista "Meses {año}":
--       - ancla = SKU     → devuelve los CLIENTES que lo compraron, por mes.
--       - ancla = cliente → devuelve los SKUs que compró, por mes.
--     (los meses vacíos son el "campo minado": desde cuándo dejaron de comprar.)
--   · El cross-search (Feature 2): buscar un cliente y ver su catálogo por mes,
--     y viceversa — reutiliza esta misma función.
--
-- No existía una vista cliente×sku×mes (las vistas kpi_* son por cliente O por
-- sku, nunca ambas). Esta función agrega directo de sales_rows.
--
-- SECURITY INVOKER → hereda la RLS de territorio del usuario (igual que el resto
-- de las funciones insights_*). p_territorios = selección del sidebar (NULL=todos
-- los visibles por RLS; [...] = subset).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.insights_cliente_sku_mensual(
  p_year        int,
  p_anchor_dim  text,                 -- 'sku' → devuelve clientes | 'cliente' → devuelve SKUs
  p_anchor_value text,                -- el SKU o el cliente ancla
  p_territorios text[] DEFAULT NULL   -- selección del sidebar (RLS adicional)
)
RETURNS TABLE(name text, mes smallint, venta numeric, kg numeric, margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    CASE WHEN p_anchor_dim = 'sku'
         THEN COALESCE(s.cliente, '(sin nombre)')
         ELSE COALESCE(s.sku, '(sin sku)') END AS name,
    s.mes,
    SUM(s.venta)::numeric  AS venta,
    SUM(s.kg)::numeric     AS kg,
    SUM(s.margen)::numeric AS margen
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
