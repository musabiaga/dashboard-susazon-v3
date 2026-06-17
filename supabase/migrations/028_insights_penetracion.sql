-- 028_insights_penetracion.sql
-- Datos para el nuevo sub-análisis "Penetración / Canasta" del tab Insights.
--
-- Bidireccional (p_dimension):
--   · 'clientes'  → una fila por CLIENTE; n = # de SKUs DISTINTOS que compra.
--   · 'productos' → una fila por SKU;     n = # de CLIENTES DISTINTOS que lo compran.
--
-- Para cada fila devuelve el conteo distinct + venta + margen + kg del periodo
-- ACTUAL [p_from, p_to] y del MISMO rango calendario del año anterior
-- [p_from_prev, p_to_prev]. El frontend calcula %margen y los deltas (Δ n,
-- Δ venta, Δ %margen) y marca "nuevos" (sin base año anterior) y "perdidos"
-- (sin actividad este año).
--
-- A diferencia del Cuadrante (que solo deja items con venta_actual>0), aquí
-- SÍ incluimos los que existen solo en un periodo (altas y bajas) — el WHERE
-- restringe a filas dentro de cualquiera de las dos ventanas, así que cada
-- grupo tiene actividad en al menos un periodo.
--
-- Rendimiento: el filtro de territorio del param (p_territorios) es un array
-- constante (evaluado una vez). La RLS de sales_rows ya evalúa su función una
-- sola vez (migración 027). SECURITY INVOKER → respeta permisos del usuario.

-- ============================================================================
-- 1) RESUMEN: una fila por cliente (o por sku)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.insights_penetracion(
  p_from date,
  p_to date,
  p_from_prev date,
  p_to_prev date,
  p_dimension text,                      -- 'clientes' | 'productos'
  p_territorios text[] DEFAULT NULL
)
RETURNS TABLE (
  name text,
  n_actual bigint,
  n_prev bigint,
  venta_actual numeric,
  venta_prev numeric,
  margen_actual numeric,
  margen_prev numeric,
  kg_actual numeric,
  kg_prev numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT
    CASE p_dimension
      WHEN 'productos' THEN COALESCE(sku, '(sin sku)')
      ELSE COALESCE(cliente, '(sin nombre)')
    END AS name,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN cliente ELSE sku END))
      FILTER (WHERE fecha BETWEEN p_from AND p_to) AS n_actual,
    COUNT(DISTINCT (CASE p_dimension WHEN 'productos' THEN cliente ELSE sku END))
      FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev) AS n_prev,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS venta_actual,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS venta_prev,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS margen_actual,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS margen_prev,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS kg_actual,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS kg_prev
  FROM public.sales_rows
  WHERE (
      fecha BETWEEN p_from AND p_to
      OR fecha BETWEEN p_from_prev AND p_to_prev
    )
    AND (p_territorios IS NULL OR territorio = ANY(p_territorios))
  GROUP BY 1;
$$;

COMMENT ON FUNCTION public.insights_penetracion(date, date, date, date, text, text[]) IS
  'Tab Insights · Penetración/Canasta (resumen). Por cliente: # SKUs distintos; por sku: # clientes distintos. Conteo+venta+margen+kg actual vs mismo rango año anterior. Incluye altas y bajas. RLS activa.';

GRANT EXECUTE ON FUNCTION public.insights_penetracion(date, date, date, date, text, text[]) TO authenticated;

-- ============================================================================
-- 2) DETALLE (drill-down): lista COMPLETA de la otra dimensión para 1 item
--    · p_dimension='clientes'  + p_key=<cliente> → lista de SUS SKUs
--    · p_dimension='productos' + p_key=<sku>     → lista de SUS clientes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.insights_penetracion_detalle(
  p_from date,
  p_to date,
  p_from_prev date,
  p_to_prev date,
  p_dimension text,
  p_key text,
  p_territorios text[] DEFAULT NULL
)
RETURNS TABLE (
  name text,
  venta_actual numeric,
  venta_prev numeric,
  margen_actual numeric,
  margen_prev numeric,
  kg_actual numeric,
  kg_prev numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT
    CASE p_dimension
      WHEN 'productos' THEN COALESCE(cliente, '(sin nombre)')
      ELSE COALESCE(sku, '(sin sku)')
    END AS name,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS venta_actual,
    COALESCE(SUM(venta)  FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS venta_prev,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS margen_actual,
    COALESCE(SUM(margen) FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS margen_prev,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from AND p_to), 0)::numeric AS kg_actual,
    COALESCE(SUM(kg)     FILTER (WHERE fecha BETWEEN p_from_prev AND p_to_prev), 0)::numeric AS kg_prev
  FROM public.sales_rows
  WHERE (
      fecha BETWEEN p_from AND p_to
      OR fecha BETWEEN p_from_prev AND p_to_prev
    )
    AND (p_territorios IS NULL OR territorio = ANY(p_territorios))
    AND (CASE p_dimension WHEN 'productos' THEN sku ELSE cliente END) = p_key
  GROUP BY 1;
$$;

COMMENT ON FUNCTION public.insights_penetracion_detalle(date, date, date, date, text, text, text[]) IS
  'Tab Insights · Penetración/Canasta (drill-down). Lista completa de la otra dimensión para 1 item (SKUs de un cliente / clientes de un sku), venta+margen+kg actual vs año anterior. RLS activa.';

GRANT EXECUTE ON FUNCTION public.insights_penetracion_detalle(date, date, date, date, text, text, text[]) TO authenticated;
