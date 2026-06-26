-- 030_agrupadores_rls.sql
-- Hace cumplir los agrupadores a nivel RLS. Un usuario puede ver una fila de
-- sales_rows si:
--   (a) su territorio está en sus territorios visibles (comportamiento actual), O
--   (b) la fila casa con CUALQUIER miembro de CUALQUIER agrupador asignado a él.
--
-- Como las vistas kpi_* son security_invoker, esta RLS propaga sola a TODO el
-- dashboard: un KAM con solo un agrupador asignado (y allowed_territories=[])
-- ve el dashboard completo ya acotado a su scope.
--
-- Rendimiento: las funciones son STABLE → en la política se usan como
-- sub-consultas no correlacionadas (InitPlan), evaluadas UNA vez por query
-- (no por fila). Lección de la migración 027.

-- Scope del usuario actual: (tipo, valor) de los miembros de sus agrupadores activos.
CREATE OR REPLACE FUNCTION public.current_user_agrupador_scope()
RETURNS TABLE (member_type text, member_value text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT m.member_type, m.member_value
  FROM public.users_permissions up
  CROSS JOIN LATERAL unnest(COALESCE(up.allowed_agrupadores, ARRAY[]::uuid[])) AS ua(agrupador_id)
  JOIN public.agrupadores a ON a.id = ua.agrupador_id AND a.is_active
  JOIN public.agrupador_members m ON m.agrupador_id = a.id
  WHERE up.user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_agrupador_scope() TO authenticated;

-- Mismo scope pero pivoteado a arrays por dimensión (para usar en la política).
CREATE OR REPLACE FUNCTION public.current_user_scope_arrays()
RETURNS TABLE (territorios text[], grupos text[], familias text[], skus text[], clientes text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    array_agg(member_value) FILTER (WHERE member_type = 'territorio'),
    array_agg(member_value) FILTER (WHERE member_type = 'grupo'),
    array_agg(member_value) FILTER (WHERE member_type = 'familia'),
    array_agg(member_value) FILTER (WHERE member_type = 'sku'),
    array_agg(member_value) FILTER (WHERE member_type = 'cliente')
  FROM public.current_user_agrupador_scope();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_scope_arrays() TO authenticated;

-- Política extendida (reemplaza la anterior; agrega la rama de agrupadores).
DROP POLICY IF EXISTS users_read_visible_territories ON public.sales_rows;
CREATE POLICY users_read_visible_territories ON public.sales_rows
FOR SELECT
USING (
  territorio IN (SELECT unnest(visible_territories_for_current_user()))
  OR territorio = ANY (COALESCE((SELECT territorios FROM current_user_scope_arrays()), ARRAY[]::text[]))
  OR grupo     = ANY (COALESCE((SELECT grupos     FROM current_user_scope_arrays()), ARRAY[]::text[]))
  OR familia   = ANY (COALESCE((SELECT familias   FROM current_user_scope_arrays()), ARRAY[]::text[]))
  OR sku       = ANY (COALESCE((SELECT skus       FROM current_user_scope_arrays()), ARRAY[]::text[]))
  OR cliente   = ANY (COALESCE((SELECT clientes   FROM current_user_scope_arrays()), ARRAY[]::text[]))
);

COMMENT ON FUNCTION public.current_user_agrupador_scope() IS 'Miembros (tipo,valor) de los agrupadores activos asignados al usuario actual. Usado por la RLS de sales_rows.';
