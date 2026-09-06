# Idea 1 — Sync automática (artefacto pg_cron) · SUPERADO

Este SQL (`043_sync_auto_cron.sql.parked`) fue el motor **A** (pg_cron + pg_net + CRON_SECRET en Vault),
diseñado en V4.3 y parqueado el 2026-08-25.

**El 2026-09-06 (V4.4) Mauricio eligió otro motor: Vercel Cron** (`vercel.json` + `GET /api/cron/sync`,
`CRON_SECRET` solo en Vercel, sin extensiones en Supabase). Ver D045 en `docs/SESSION_LOG.md`.

Se conserva solo como referencia histórica. **No aplicar.**
