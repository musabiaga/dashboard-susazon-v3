-- 032_my_agrupadores.sql
-- Agrupadores activos asignados al usuario actual (id, nombre, icono) para
-- mostrarlos en el sidebar como sección de contexto. SECURITY DEFINER porque
-- las tablas de agrupadores tienen RLS admin-only; aquí el usuario lee solo
-- los suyos (filtrado por auth.uid() + allowed_agrupadores).

CREATE OR REPLACE FUNCTION public.my_agrupadores()
RETURNS TABLE(id uuid, nombre text, icono text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.nombre, a.icono
  FROM public.users_permissions up
  CROSS JOIN LATERAL unnest(COALESCE(up.allowed_agrupadores, ARRAY[]::uuid[])) AS ua(agrupador_id)
  JOIN public.agrupadores a ON a.id = ua.agrupador_id AND a.is_active
  WHERE up.user_id = auth.uid()
  ORDER BY a.nombre;
$$;

GRANT EXECUTE ON FUNCTION public.my_agrupadores() TO authenticated;
COMMENT ON FUNCTION public.my_agrupadores() IS 'Agrupadores activos asignados al usuario actual (id, nombre, icono) para el sidebar.';
