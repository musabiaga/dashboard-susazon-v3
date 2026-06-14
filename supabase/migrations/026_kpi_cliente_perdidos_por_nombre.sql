-- 026_kpi_cliente_perdidos_por_nombre.sql
-- Arregla la duplicación de clientes en el tab Perdidos.
--
-- Causa: la vista agrupaba por `no_cliente` (case-sensitive), así que:
--   (1) el mismo número con distinta capitalización (CL-001087 / cl-001087 /
--       Cl-001087 — inconsistencia de datos viejos ≤ sep-2025) salía como
--       clientes distintos → variantes en minúscula sin venta 2026 = PERDIDO falso;
--   (2) el mismo cliente en cuentas Susazón + Suve (no_cliente distinto) salía 2 veces.
--
-- Fix: agrupar por NOMBRE de cliente — (anio, cliente, vendedor, territorio) —
-- en vez de por no_cliente. Esto mergea las variantes de casing (mismo nombre) Y
-- las cuentas Sus/Suve del mismo cliente+vendedor en una sola fila. El `no_cliente`
-- queda como representativo: MIN() devuelve la variante MAYÚSCULAS (en ASCII las
-- mayúsculas ordenan antes que las minúsculas), o sea el canónico.
--
-- Regla de negocio consistente con "Clientes Activos": un cliente = NOMBRE,
-- no no_cliente (cada ERP numera por separado).

CREATE OR REPLACE VIEW public.kpi_cliente_perdidos
WITH (security_invoker = true)
AS
WITH curr AS (
  SELECT EXTRACT(MONTH FROM CURRENT_DATE)::int AS m
)
SELECT
  s.anio,
  MIN(UPPER(s.no_cliente)) AS no_cliente,    -- representativo canónico (mayúsculas)
  s.cliente,
  s.vendedor,
  s.territorio,
  COALESCE(SUM(s.venta)  FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_venta,
  COALESCE(SUM(s.kg)     FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_kg,
  COALESCE(SUM(s.venta)  FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_venta,
  COALESCE(SUM(s.kg)     FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_kg,
  COALESCE(SUM(s.margen) FILTER (WHERE s.mes = (SELECT m FROM curr)), 0) AS mes_margen,
  COALESCE(SUM(s.margen) FILTER (WHERE s.mes <= (SELECT m FROM curr)), 0) AS ytd_margen
FROM public.sales_rows s
WHERE s.no_cliente IS NOT NULL
GROUP BY s.anio, s.cliente, s.vendedor, s.territorio;

COMMENT ON VIEW public.kpi_cliente_perdidos IS
  'Pre-agregacion por NOMBRE de cliente x vendedor x territorio x anio (mes + YTD, venta+kg+margen). Tab Perdidos. Agrupar por nombre (no no_cliente) mergea variantes de casing y cuentas Sus/Suve.';
