-- ============================================================================
-- Migration 011: vistas KPI diarias por dimension (grupo, sku, cliente, vendedor)
--
-- Mejora 2 (sombreado YoY dia-vs-dia): permite comparar acumulado al MISMO
-- dia laboral del año anterior, no solo cierre completo del mes. Útil porque
-- el cierre completo del año pasado vs el acumulado actual (mes en curso) es
-- una comparacion injusta — siempre saldria "declive" en los primeros días.
--
-- Cada vista pre-agrega `sales_rows` por (territorio, dimension, anio, mes,
-- dia). Después en frontend filtramos por dia <= cutoff para acumular hasta
-- el "mismo dia laboral" de cada año.
--
-- security_invoker = true → respeta RLS del usuario consultando.
-- ============================================================================

-- Grupo Producto diario
CREATE OR REPLACE VIEW public.kpi_grupo_diario
WITH (security_invoker = true)
AS
SELECT
  anio,
  mes,
  EXTRACT(DAY FROM fecha)::smallint AS dia,
  territorio,
  COALESCE(grupo, '(sin grupo)') AS grupo,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, dia, territorio, grupo;

-- SKU diario (Tab Productos)
CREATE OR REPLACE VIEW public.kpi_sku_diario
WITH (security_invoker = true)
AS
SELECT
  anio,
  mes,
  EXTRACT(DAY FROM fecha)::smallint AS dia,
  territorio,
  COALESCE(sku, '(sin sku)') AS sku,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, dia, territorio, sku;

-- Cliente diario (Tab Clientes + fix de tab Perdidos para comparar dia-vs-dia)
CREATE OR REPLACE VIEW public.kpi_cliente_diario
WITH (security_invoker = true)
AS
SELECT
  anio,
  mes,
  EXTRACT(DAY FROM fecha)::smallint AS dia,
  territorio,
  no_cliente,
  COALESCE(cliente, '(sin nombre)') AS cliente,
  COALESCE(vendedor, '(sin vendedor)') AS vendedor,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, dia, territorio, no_cliente, cliente, vendedor;

-- Vendedor diario (Tab Vendedores). Mantenemos `empresa` (0=Sus, 1=Suve)
-- para preservar el toggle Separar/Unir.
CREATE OR REPLACE VIEW public.kpi_vendedor_diario
WITH (security_invoker = true)
AS
SELECT
  anio,
  mes,
  EXTRACT(DAY FROM fecha)::smallint AS dia,
  territorio,
  empresa,
  COALESCE(vendedor, '(sin vendedor)') AS vendedor,
  SUM(venta) AS total_venta,
  SUM(margen) AS total_margen,
  SUM(kg) AS total_kg
FROM public.sales_rows
GROUP BY anio, mes, dia, territorio, empresa, vendedor;
