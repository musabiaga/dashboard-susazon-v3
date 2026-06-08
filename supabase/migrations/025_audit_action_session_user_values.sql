-- 025_audit_action_session_user_values.sql
-- Agrega al enum audit_action los valores que el código YA inserta pero que
-- nunca se agregaron al enum → cada uno de esos eventos fallaba con
-- "invalid input value for enum audit_action" (visto en los logs de Postgres).
--
-- Origen de cada valor (Fase 7 seguridad de sesión + alta/reset de usuarios):
--   force_signout                      → app/api/admin/users/force-signout
--   force_signout_all                  → app/api/admin/users/force-signout-all
--   session_timeout_changed            → app/api/admin/settings/session-timeout
--   session_timeout_exemption_changed  → exención de timeout por usuario
--   invite                             → invitación de usuario
--   reset                              → reset de contraseña
--
-- ADD VALUE IF NOT EXISTS es idempotente (mismo patrón que la migración 015).

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'force_signout';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'force_signout_all';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'invite';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'reset';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'session_timeout_changed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'session_timeout_exemption_changed';
