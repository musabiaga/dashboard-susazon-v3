import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin con service_role key — bypassa RLS.
 * SOLO usar en Route Handlers / Server Actions con guardas de rol verificadas.
 * NUNCA exponer al browser.
 */
export function createSupabaseAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no configurada — admin operations no disponibles"
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
