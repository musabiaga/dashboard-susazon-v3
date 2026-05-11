import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConfiguracionClient } from "./ConfiguracionClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const supabase = await createSupabaseServerClient();

  // Leer todos los settings actuales
  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value, updated_at");

  const byKey = new Map((settings ?? []).map((s) => [s.key, s]));
  const instructivo = byKey.get("instructivo_visible");
  const instructivoEnabled =
    (instructivo?.value as { enabled?: boolean } | undefined)?.enabled ?? true;

  return (
    <ConfiguracionClient
      initialInstructivoEnabled={instructivoEnabled}
      instructivoUpdatedAt={instructivo?.updated_at ?? null}
    />
  );
}
