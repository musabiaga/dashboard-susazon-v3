-- 015_audit_action_settings_toggle.sql
-- Agrega 'settings_toggle' al enum audit_action para el toggle del instructivo
-- y otros app_settings futuros.

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'settings_toggle';
