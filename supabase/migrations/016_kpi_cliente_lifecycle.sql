-- 016_kpi_cliente_lifecycle.sql
-- Vista que devuelve la PRIMERA fecha de compra y ÚLTIMA fecha de compra
-- de cada cliente (across todas las empresas y territorios). Usada por el
-- tab Perdidos para distinguir:
--   - "Nuevo": first_purchase_date hace ≤ 90 días
--   - "Recuperado": cliente con historia (first ≥ 90 días) que paró
--     y volvió en los últimos 90 días

CREATE OR REPLACE VIEW public.kpi_cliente_lifecycle
WITH (security_invoker = true)
AS
SELECT
  no_cliente,
  MIN(fecha) AS first_purchase_date,
  MAX(fecha) AS last_purchase_date,
  COUNT(DISTINCT DATE_TRUNC('month', fecha)) AS active_months
FROM public.sales_rows
WHERE no_cliente IS NOT NULL
GROUP BY no_cliente;

COMMENT ON VIEW public.kpi_cliente_lifecycle IS
  'Lifecycle de cada cliente: primera y última fecha de compra + meses activos. Usada por tab Perdidos para distinguir clientes Nuevos (<90 días) vs Recuperados (compró antes, paró, volvió).';
