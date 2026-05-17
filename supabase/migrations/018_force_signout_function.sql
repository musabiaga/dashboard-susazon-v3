-- 018_force_signout_function.sql
-- Fix: el método auth.admin.signOut(jwt, scope) del SDK de Supabase requiere
-- el JWT del usuario, NO el user_id. Para invalidar sesiones de cualquier
-- usuario desde el admin, la forma correcta es borrar directamente las
-- filas de auth.sessions con el service_role.
--
-- Creamos una función SECURITY DEFINER que el admin puede invocar vía RPC.
-- Solo el service_role puede ejecutarla.

CREATE OR REPLACE FUNCTION public.force_signout_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- También invalidar refresh tokens (extra seguridad: aunque el access
  -- token expire en ~1h, sin refresh token el cliente no puede renovarlo).
  DELETE FROM auth.refresh_tokens WHERE user_id = target_user_id::text;

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.force_signout_user(uuid) IS
  'Invalida todas las sesiones activas de un usuario. Borra de auth.sessions y auth.refresh_tokens. Solo callable por service_role (vía endpoints admin /api/admin/users/force-signout*).';

-- Solo service_role puede ejecutar (los endpoints admin la llaman vía RPC
-- usando el client con service_role key). Usuarios autenticados normales
-- NO deben tener acceso.
REVOKE EXECUTE ON FUNCTION public.force_signout_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_signout_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.force_signout_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.force_signout_user(uuid) TO service_role;
