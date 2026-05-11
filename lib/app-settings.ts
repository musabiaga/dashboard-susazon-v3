/**
 * lib/app-settings.ts — helper server-side para leer settings globales
 * desde la tabla `app_settings`.
 *
 * Uso típico:
 *   const { instructivoVisible } = await getAppSettings();
 *
 * La tabla tiene RLS que permite lectura a usuarios autenticados.
 * Escritura solo admin (vía API /api/admin/settings/toggle).
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AppSettings {
  /** Si true, todos los usuarios ven el botón "Instructivo" en el header */
  instructivoVisible: boolean;
}

const DEFAULTS: AppSettings = {
  instructivoVisible: true,
};

/**
 * Lee el conjunto de settings globales. Si algún setting no existe o falla
 * el fetch, retorna defaults (fail-safe).
 */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("app_settings")
      .select("key, value");

    if (!data) return DEFAULTS;

    const byKey = new Map(data.map((r) => [r.key, r.value]));

    const instructivo = byKey.get("instructivo_visible") as
      | { enabled?: boolean }
      | undefined;

    return {
      instructivoVisible: instructivo?.enabled ?? DEFAULTS.instructivoVisible,
    };
  } catch {
    return DEFAULTS;
  }
}
