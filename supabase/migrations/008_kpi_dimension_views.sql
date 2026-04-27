-- ============================================================================
-- Migration 008: vistas KPI por dimension (familia, grupo, sku, vendedor, cliente)
--
-- Pre-agregaciones por (anio, mes, territorio, dimension) para los tabs de
-- Fase 3. security_invoker = true respeta RLS del usuario consultando.
--
-- Plus: vista anual por cliente para tab Perdidos (analisis 2025 vs 2026).
-- ============================================================================

-- Familia (deprecado en V3 a favor de Grupo, pero mantenido por compatibilidad)
CREATE OR REPLACE VIEW public.kpi_familia_summary
WITH (security_invoker = true)
AS
SELECT
  anio, mes, territorio,
  COALESCE(familia, '(sin familia)') AS familia,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, territorio, familia;

-- Grupo (campo nuevo del API — para tab Grupo Producto)
CREATE OR REPLACE VIEW public.kpi_grupo_summary
WITH (security_invoker = true)
AS
SELECT
  anio, mes, territorio,
  COALESCE(grupo, '(sin grupo)') AS grupo,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, territorio, grupo;

-- SKU (para tab Productos)
CREATE OR REPLACE VIEW public.kpi_sku_summary
WITH (security_invoker = true)
AS
SELECT
  anio, mes, territorio,
  COALESCE(sku, '(sin sku)') AS sku,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, territorio, sku;

-- Vendedor (para tab Vendedores)
CREATE OR REPLACE VIEW public.kpi_vendedor_summary
WITH (security_invoker = true)
AS
SELECT
  anio, mes, territorio,
  COALESCE(vendedor, '(sin vendedor)') AS vendedor,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, territorio, vendedor;

-- Cliente (granularidad fina — incluye no_cliente + nombre + vendedor)
CREATE OR REPLACE VIEW public.kpi_cliente_summary
WITH (security_invoker = true)
AS
SELECT
  anio, mes, territorio,
  no_cliente,
  cliente,
  vendedor,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
WHERE no_cliente IS NOT NULL
GROUP BY anio, mes, territorio, no_cliente, cliente, vendedor;

-- Cliente anual (para tab Perdidos — analisis 2025 vs 2026)
CREATE OR REPLACE VIEW public.kpi_cliente_yearly
WITH (security_invoker = true)
AS
SELECT
  anio,
  no_cliente,
  cliente,
  vendedor,
  territorio,
  SUM(venta) AS total_venta
FROM public.sales_rows
WHERE no_cliente IS NOT NULL
GROUP BY anio, no_cliente, cliente, vendedor, territorio;

COMMENT ON VIEW public.kpi_familia_summary IS 'Pre-agregacion por familia. Tab Familia (deprecado en V3).';
COMMENT ON VIEW public.kpi_grupo_summary IS 'Pre-agregacion por grupo (campo nuevo). Tab Grupo Producto.';
COMMENT ON VIEW public.kpi_sku_summary IS 'Pre-agregacion por SKU. Tab Productos.';
COMMENT ON VIEW public.kpi_vendedor_summary IS 'Pre-agregacion por vendedor. Tab Vendedores.';
COMMENT ON VIEW public.kpi_cliente_summary IS 'Pre-agregacion por cliente. Tab Clientes.';
COMMENT ON VIEW public.kpi_cliente_yearly IS 'Suma anual por cliente. Tab Perdidos.';
