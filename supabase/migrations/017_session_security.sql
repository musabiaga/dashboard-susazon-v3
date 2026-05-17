-- 017_session_security.sql
-- Seguridad de sesión: timeout de inactividad configurable globalmente
-- + exenciones por usuario + logout remoto desde admin.
--
-- 3 piezas:
--   1. app_settings.session_idle_timeout_minutes (global, null = sin límite)
--   2. users_permissions.session_timeout_exempt (usuario no aplica timeout)
--   3. audit_log entries para 'session_timeout_changed', 'force_signout',
--      'force_signout_all' (ya soportadas por la enum de audit; aquí solo
--      documentamos el uso).

-- Setting global: minutos de inactividad antes del auto-logout.
-- Default = null (sin timeout) para NO romper comportamiento existente.
-- Valores válidos UI: 35, 45, 60, 90, 120 (admin lo configura desde panel).
INSERT INTO public.app_settings (key, value)
VALUES ('session_idle_timeout_minutes', '{"minutes": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Exención por usuario. Si true, el timeout global NO aplica a este usuario
-- (sesión indefinida hasta logout manual o por admin).
ALTER TABLE public.users_permissions
  ADD COLUMN IF NOT EXISTS session_timeout_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users_permissions.session_timeout_exempt IS
  'Si true, este usuario NO está sujeto al timeout global de inactividad. Su sesión persiste indefinidamente (hasta logout manual o por admin). Default false.';
