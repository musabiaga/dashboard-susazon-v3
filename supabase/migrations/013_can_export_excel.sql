-- 013_can_export_excel.sql
-- Permiso por usuario para descargar Excel desde los tabs del dashboard.
-- Default: admin y director sí pueden, gerente y vendedor no.
-- El admin puede ajustar por usuario en /admin/usuarios.

ALTER TABLE public.users_permissions
  ADD COLUMN IF NOT EXISTS can_export_excel boolean NOT NULL DEFAULT false;

-- Backfill: admin y director ya creados → pueden descargar Excel
UPDATE public.users_permissions
SET can_export_excel = true
WHERE role IN ('admin', 'director');

COMMENT ON COLUMN public.users_permissions.can_export_excel IS
  'Si true, el usuario ve el botón "Exportar Excel" en los tabs del dashboard. Default false para nuevos usuarios; admin/director quedaron true por backfill.';
