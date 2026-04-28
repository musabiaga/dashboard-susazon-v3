import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TerritoriesClient, type TerritoryState } from "./TerritoriesClient";

export const dynamic = "force-dynamic";

export default async function TerritoriosAdminPage() {
  const supabase = await createSupabaseServerClient();

  const { data: states } = await supabase
    .from("territories_state")
    .select("territory_name, is_active, reason, disabled_at, disabled_by")
    .order("territory_name");

  // Resolver email de quién apagó (via users_permissions)
  const disablerIds = Array.from(
    new Set(
      (states ?? [])
        .map((s) => s.disabled_by)
        .filter((id): id is string => !!id)
    )
  );
  const disablerMap = new Map<string, string>();
  if (disablerIds.length > 0) {
    const { data: users } = await supabase
      .from("users_permissions")
      .select("user_id, email, full_name")
      .in("user_id", disablerIds);
    for (const u of users ?? []) {
      disablerMap.set(u.user_id, u.full_name || u.email);
    }
  }

  const territories: TerritoryState[] = (states ?? []).map((s) => ({
    territory_name: s.territory_name,
    is_active: s.is_active,
    reason: s.reason ?? null,
    disabled_at: s.disabled_at ?? null,
    disabled_by_label: s.disabled_by
      ? disablerMap.get(s.disabled_by) ?? null
      : null,
  }));

  return <TerritoriesClient initial={territories} />;
}
