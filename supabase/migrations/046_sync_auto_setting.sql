-- 046_sync_auto_setting.sql
-- =====================================================================
-- V4.4 — Sincronización automática diaria (Idea 1, retomada).
--
-- Motor elegido: Vercel Cron (vercel.json → GET /api/cron/sync a las
-- 12:00 UTC = 06:00 CDMX). NO usa pg_cron ni Vault: el único requisito
-- externo es la variable de entorno CRON_SECRET en Vercel (la define el
-- humano; nunca pasa por el asistente).
--
-- Esta migración solo siembra el setting que enciende/apaga el modo
-- automático. Default = apagado (manual), igual que antes.
-- =====================================================================

INSERT INTO public.app_settings (key, value)
VALUES ('sync_auto', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_settings IS
  'Configuración global de la aplicación, ajustable por admin sin redeploy. '
  'Keys: instructivo_visible {enabled}, session_idle_timeout_minutes {minutes}, '
  'sync_auto {enabled} (V4.4: sync automática diaria vía Vercel Cron).';
