-- 034_agrupador_vendedor.sql
-- Fase 2b: tab Vendedores en la vista enfocada de agrupador.
-- Espeja kpi_vendedor_summary / kpi_vendedor_diario, agregando sobre la unión
-- de miembros del agrupador, con territorio = nombre del agrupador. Incluye
-- empresa (0=Sus, 1=Suve) para soportar el toggle Separar/Unir Sus+Suve.
-- Grano: (anio, mes[, dia], vendedor, empresa). SECURITY INVOKER → RLS aplica.

CREATE OR REPLACE FUNCTION public.agrupador_vendedor_summary(p_id uuid)
RETURNS TABLE(anio int, mes int, territorio text, vendedor text, empresa int, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, m.nombre, COALESCE(s.vendedor,'(sin vendedor)'), s.empresa,
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (s.territorio=ANY(COALESCE(m.territorios,ARRAY[]::text[])) OR s.grupo=ANY(COALESCE(m.grupos,ARRAY[]::text[])) OR s.familia=ANY(COALESCE(m.familias,ARRAY[]::text[])) OR s.sku=ANY(COALESCE(m.skus,ARRAY[]::text[])) OR s.cliente=ANY(COALESCE(m.clientes,ARRAY[]::text[])))
  GROUP BY s.anio, s.mes, m.nombre, s.vendedor, s.empresa;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_vendedor_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agrupador_vendedor_diario(p_id uuid)
RETURNS TABLE(anio int, mes int, dia int, territorio text, vendedor text, empresa int, total_venta numeric, total_kg numeric, total_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.anio, s.mes, EXTRACT(DAY FROM s.fecha)::int, m.nombre, COALESCE(s.vendedor,'(sin vendedor)'), s.empresa,
    COALESCE(SUM(s.venta),0)::numeric, COALESCE(SUM(s.kg),0)::numeric, COALESCE(SUM(s.margen),0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE (s.territorio=ANY(COALESCE(m.territorios,ARRAY[]::text[])) OR s.grupo=ANY(COALESCE(m.grupos,ARRAY[]::text[])) OR s.familia=ANY(COALESCE(m.familias,ARRAY[]::text[])) OR s.sku=ANY(COALESCE(m.skus,ARRAY[]::text[])) OR s.cliente=ANY(COALESCE(m.clientes,ARRAY[]::text[])))
  GROUP BY s.anio, s.mes, EXTRACT(DAY FROM s.fecha), m.nombre, s.vendedor, s.empresa;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_vendedor_diario(uuid) TO authenticated;
