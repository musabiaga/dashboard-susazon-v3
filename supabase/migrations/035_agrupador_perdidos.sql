-- 035_agrupador_perdidos.sql
-- Fase 2b: tab Perdidos en la vista enfocada de agrupador.
-- Espeja kpi_cliente_perdidos (026) y kpi_cliente_lifecycle (016), agregando
-- sobre la unión de miembros del agrupador, con territorio = nombre del
-- agrupador. SECURITY INVOKER → RLS aplica.

CREATE OR REPLACE FUNCTION public.agrupador_cliente_perdidos(p_id uuid)
RETURNS TABLE(anio int, no_cliente text, cliente text, vendedor text, territorio text,
              mes_venta numeric, mes_kg numeric, mes_margen numeric,
              ytd_venta numeric, ytd_kg numeric, ytd_margen numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id)),
       curr AS (SELECT EXTRACT(MONTH FROM CURRENT_DATE)::int AS mm)
  SELECT s.anio, MIN(UPPER(s.no_cliente)), COALESCE(s.cliente,'(sin nombre)'), s.vendedor, m.nombre,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.mes = (SELECT mm FROM curr)), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.mes = (SELECT mm FROM curr)), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.mes = (SELECT mm FROM curr)), 0)::numeric,
    COALESCE(SUM(s.venta)  FILTER (WHERE s.mes <= (SELECT mm FROM curr)), 0)::numeric,
    COALESCE(SUM(s.kg)     FILTER (WHERE s.mes <= (SELECT mm FROM curr)), 0)::numeric,
    COALESCE(SUM(s.margen) FILTER (WHERE s.mes <= (SELECT mm FROM curr)), 0)::numeric
  FROM public.sales_rows s CROSS JOIN m
  WHERE s.no_cliente IS NOT NULL
    AND (s.territorio=ANY(COALESCE(m.territorios,ARRAY[]::text[])) OR s.grupo=ANY(COALESCE(m.grupos,ARRAY[]::text[])) OR s.familia=ANY(COALESCE(m.familias,ARRAY[]::text[])) OR s.sku=ANY(COALESCE(m.skus,ARRAY[]::text[])) OR s.cliente=ANY(COALESCE(m.clientes,ARRAY[]::text[])))
  GROUP BY s.anio, s.cliente, s.vendedor, m.nombre;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_cliente_perdidos(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agrupador_cliente_lifecycle(p_id uuid)
RETURNS TABLE(no_cliente text, first_purchase_date date, last_purchase_date date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH m AS (SELECT * FROM public.agrupador_member_arrays(p_id))
  SELECT s.no_cliente, MIN(s.fecha)::date, MAX(s.fecha)::date
  FROM public.sales_rows s CROSS JOIN m
  WHERE s.no_cliente IS NOT NULL
    AND (s.territorio=ANY(COALESCE(m.territorios,ARRAY[]::text[])) OR s.grupo=ANY(COALESCE(m.grupos,ARRAY[]::text[])) OR s.familia=ANY(COALESCE(m.familias,ARRAY[]::text[])) OR s.sku=ANY(COALESCE(m.skus,ARRAY[]::text[])) OR s.cliente=ANY(COALESCE(m.clientes,ARRAY[]::text[])))
  GROUP BY s.no_cliente;
$$;
GRANT EXECUTE ON FUNCTION public.agrupador_cliente_lifecycle(uuid) TO authenticated;
