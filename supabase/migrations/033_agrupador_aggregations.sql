-- 033_agrupador_aggregations.sql
-- Fase 2 (vista enfocada de agrupador): funciones de agregación que espejan las
-- vistas kpi_* CORE, pero calculadas sobre los MIEMBROS del agrupador (la unión)
-- y devolviendo `territorio` = nombre del agrupador (un solo bucket sintético).
-- Así el dashboard reutiliza todo su render client-side (cree que es 1 territorio).
--
-- Seguridad: las funciones de datos son SECURITY INVOKER → la RLS de sales_rows
-- aplica (el usuario solo agrega filas que puede ver). El helper de miembros es
-- SECURITY DEFINER (las tablas de agrupadores son admin-only) y está GATEADO a
-- agrupadores asignados al usuario (o admin).
--
-- Un row que casa con varios criterios del agrupador se cuenta UNA vez (es una
-- sola fila; el OR no duplica).

-- ============================================================
-- Helper: miembros (arrays por dimensión) + nombre de UN agrupador.
-- Gateado: solo agrupadores asignados al usuario actual (o admin).
-- ============================================================
CREATE OR REPLACE FUNCTION public.agrupador_member_arrays(p_id uuid)
RETURNS TABLE(nombre text, territorios text[], grupos text[], familias text[], skus text[], clientes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.nombre,
    array_agg(m.member_value) FILTER (WHERE m.member_type = 'territorio'),
    array_agg(m.member_value) FILTER (WHERE m.member_type = 'grupo'),
    array_agg(m.member_value) FILTER (WHERE m.member_type = 'familia'),
    array_agg(m.member_value) FILTER (WHERE m.member_type = 'sku'),
    array_agg(m.member_value) FILTER (WHERE m.member_type = 'cliente')
  FROM public.agrupadores a
  LEFT JOIN public.agrupador_members m ON m.agrupador_id = a.id
  WHERE a.id = p_id
    AND a.is_active
    AND (
      public.current_user_is_admin()
      OR p_id = ANY(COALESCE(
        (SELECT allowed_agrupadores FROM public.users_permissions WHERE user_id = auth.uid()),
        ARRAY[]::uuid[]
      ))
    )
  GROUP BY a.nombre;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_member_arrays(uuid) TO authenticated;

-- ============================================================
-- 1) Mensual (espejo kpi_monthly_summary) — header + Ventas (tendencia anual)
-- ============================================================
CREATE OR REPLACE FUNCTION public.agrupador_monthly(p_id uuid)
RETURNS TABLE(anio int, mes int, territorio text, total_venta numeric, total_margen numeric, total_kg numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, m.nombre,
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.margen),0)::numeric, COALESCE(SUM(s.kg),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, m.nombre;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_monthly(uuid) TO authenticated;

-- ============================================================
-- 2) Diario global (espejo kpi_daily_summary) — header día + Tracking + Ventas
-- ============================================================
CREATE OR REPLACE FUNCTION public.agrupador_daily(p_id uuid)
RETURNS TABLE(fecha date, anio int, mes int, dia int, territorio text, total_venta numeric, total_margen numeric, total_kg numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.fecha::date, s.anio, s.mes, EXTRACT(DAY FROM s.fecha)::int, m.nombre,
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.margen),0)::numeric, COALESCE(SUM(s.kg),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.fecha, s.anio, s.mes, m.nombre;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_daily(uuid) TO authenticated;

-- ============================================================
-- 3) Grupo — summary (anio,mes) y diario (anio,mes,dia)
-- ============================================================
CREATE OR REPLACE FUNCTION public.agrupador_grupo_summary(p_id uuid)
RETURNS TABLE(anio int, mes int, territorio text, grupo text, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, m.nombre, COALESCE(s.grupo,'(sin grupo)'),
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, m.nombre, s.grupo;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_grupo_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agrupador_grupo_diario(p_id uuid)
RETURNS TABLE(anio int, mes int, dia int, territorio text, grupo text, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, EXTRACT(DAY FROM s.fecha)::int, m.nombre, COALESCE(s.grupo,'(sin grupo)'),
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, EXTRACT(DAY FROM s.fecha), m.nombre, s.grupo;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_grupo_diario(uuid) TO authenticated;

-- ============================================================
-- 4) SKU — summary y diario
-- ============================================================
CREATE OR REPLACE FUNCTION public.agrupador_sku_summary(p_id uuid)
RETURNS TABLE(anio int, mes int, territorio text, sku text, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, m.nombre, COALESCE(s.sku,'(sin sku)'),
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, m.nombre, s.sku;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_sku_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agrupador_sku_diario(p_id uuid)
RETURNS TABLE(anio int, mes int, dia int, territorio text, sku text, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, EXTRACT(DAY FROM s.fecha)::int, m.nombre, COALESCE(s.sku,'(sin sku)'),
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, EXTRACT(DAY FROM s.fecha), m.nombre, s.sku;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_sku_diario(uuid) TO authenticated;

-- ============================================================
-- 5) Cliente — summary y diario (incluye no_cliente como en las vistas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.agrupador_cliente_summary(p_id uuid)
RETURNS TABLE(anio int, mes int, territorio text, no_cliente text, cliente text, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, m.nombre, MIN(UPPER(s.no_cliente)), COALESCE(s.cliente,'(sin nombre)'),
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, m.nombre, s.cliente;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_cliente_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agrupador_cliente_diario(p_id uuid)
RETURNS TABLE(anio int, mes int, dia int, territorio text, no_cliente text, cliente text, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, EXTRACT(DAY FROM s.fecha)::int, m.nombre, MIN(UPPER(s.no_cliente)), COALESCE(s.cliente,'(sin nombre)'),
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (
    s.territorio = ANY(COALESCE(m.territorios, ARRAY[]::text[]))
    OR s.grupo  = ANY(COALESCE(m.grupos,  ARRAY[]::text[]))
    OR s.familia= ANY(COALESCE(m.familias,ARRAY[]::text[]))
    OR s.sku    = ANY(COALESCE(m.skus,    ARRAY[]::text[]))
    OR s.cliente= ANY(COALESCE(m.clientes,ARRAY[]::text[]))
  )
  GROUP BY s.anio, s.mes, EXTRACT(DAY FROM s.fecha), m.nombre, s.cliente;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_cliente_diario(uuid) TO authenticated;
