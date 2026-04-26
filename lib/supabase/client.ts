import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso en componentes "use client".
 * Solo usa la anon key — RLS protege los datos.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
