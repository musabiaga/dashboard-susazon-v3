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
  /** Minutos de inactividad antes del auto-logout. null = sin timeout.
   *  Valores válidos UI: 35, 45, 60, 90, 120. El timeout NO aplica a
   *  usuarios con session_timeout_exempt=true. */
  sessionIdleTimeoutMinutes: number | null;
}

const DEFAULTS: AppSettings = {
  instructivoVisible: true,
  sessionIdleTimeoutMinutes: null,
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

    const sessionTimeout = byKey.get("session_idle_timeout_minutes") as
      | { minutes?: number | null }
      | undefined;

    // Validar el rango: solo aceptamos null o 35-120 min.
    const rawMinutes = sessionTimeout?.minutes;
    const validMinutes =
      rawMinutes != null && typeof rawMinutes === "number" &&
      rawMinutes >= 35 && rawMinutes <= 120
        ? rawMinutes
        : null;

    return {
      instructivoVisible: instructivo?.enabled ?? DEFAULTS.instructivoVisible,
      sessionIdleTimeoutMinutes: validMinutes,
    };
  } catch {
    return DEFAULTS;
  }
}
