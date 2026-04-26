-- ============================================================================
-- Seed inicial — corre DESPUÉS de crear el primer usuario admin manualmente
-- en Supabase Auth (Dashboard → Authentication → Users → Add user).
--
-- Reemplaza 'mauricio@susazon.mx' con el email exacto del admin creado.
-- ============================================================================

-- Insertar el registro de permisos del admin Mauricio
-- (asume que ya existe en auth.users con ese email)
INSERT INTO public.users_permissions (
  user_id,
  email,
  full_name,
  role,
  allowed_territories,
  can_edit_ptto,
  theme_preference,
  is_active
)
SELECT
  id,
  email,
  'Mauricio Usabiaga',
  'admin'::user_role,
  NULL, -- NULL = todos los territorios
  true,
  'clean'::theme_preference,
  true
FROM auth.users
WHERE email = 'mauricio@susazon.mx'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- Territorios iniciales (cargados desde la API la primera vez se completan)
-- Por ahora insertar todos como activos. Cuando se carguen datos, los
-- territorios reales que aparezcan en la API se agregarán automáticamente
-- vía un trigger o el endpoint /api/data/refresh.
-- ============================================================================

-- Placeholder — se completa con datos reales cuando Mauricio cargue la API
-- INSERT INTO public.territories_state (territory_name, is_active) VALUES
--   ('Cedis Mexico', true),
--   ('Cedis Leon', true),
--   ('Cedis Morelia', true),
--   ('Cedis San Luis Potosi', true),
--   ('Distribuidores', true)
-- ON CONFLICT (territory_name) DO NOTHING;
