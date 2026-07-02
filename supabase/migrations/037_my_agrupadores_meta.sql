-- 037_my_agrupadores_meta.sql
-- Fase 3 (meta manual): my_agrupadores() devuelve también meta_mensual.
-- La captura en admin ya existía (agrupadores.meta_mensual + AgrupadoresManager
-- + /api/admin/agrupadores). Esto expone la meta al dashboard para alimentar el
-- PTTO/cumplimiento del header en la vista enfocada de agrupador (page.tsx la
-- inyecta como ventaBudget del territorio sintético). meta_mensual = venta
-- mensual (mismo grano que territory_budgets del mes actual).
-- DROP+CREATE porque cambia el RETURNS TABLE.
DROP FUNCTION IF EXISTS public.my_agrupadores();
CREATE FUNCTION public.my_agrupadores()
 RETURNS TABLE(id uuid, nombre text, icono text, meta_mensual numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT a.id, a.nombre, a.icono, a.meta_mensual
  FROM public.users_permissions up
  CROSS JOIN LATERAL unnest(COALESCE(up.allowed_agrupadores, ARRAY[]::uuid[])) AS ua(agrupador_id)
  JOIN public.agrupadores a ON a.id = ua.agrupador_id AND a.is_active
  WHERE up.user_id = auth.uid()
  ORDER BY a.nombre;
$function$;
GRANT EXECUTE ON FUNCTION public.my_agrupadores() TO authenticated;
