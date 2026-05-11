-- 014_app_settings.sql
-- Tabla key-value para configuración global de la app que el admin puede
-- ajustar sin redeploy. RLS: lectura pública (todos los usuarios autenticados
-- pueden leer), escritura solo admin.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.app_settings IS
  'Configuración global de la aplicación, ajustable por admin sin redeploy.';
COMMENT ON COLUMN public.app_settings.key IS
  'Clave del setting (ej. "instructivo_visible").';
COMMENT ON COLUMN public.app_settings.value IS
  'Valor del setting en JSON (ej. {"enabled": true}).';

-- Trigger para auto-update de updated_at
CREATE OR REPLACE FUNCTION public.app_settings_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS app_settings_touch_trigger ON public.app_settings;
CREATE TRIGGER app_settings_touch_trigger
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.app_settings_touch();

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede LEER (para que vean el setting de instructivo)
DROP POLICY IF EXISTS app_settings_read_authenticated ON public.app_settings;
CREATE POLICY app_settings_read_authenticated
  ON public.app_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admin puede INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS app_settings_write_admin ON public.app_settings;
CREATE POLICY app_settings_write_admin
  ON public.app_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users_permissions
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users_permissions
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Row inicial: instructivo visible por default
INSERT INTO public.app_settings (key, value)
VALUES ('instructivo_visible', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
