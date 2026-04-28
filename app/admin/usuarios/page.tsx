import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { UsuariosClient, type UserRow, type RoleKey } from "./UsuariosClient";

export const dynamic = "force-dynamic";

export default async function UsuariosAdminPage() {
  const supabase = await createSupabaseServerClient();

  // Lista de territorios activos (para el multi-select del modal)
  const { data: territoriesData } = await supabase
    .from("territories_state")
    .select("territory_name")
    .order("territory_name");
  const territories = (territoriesData ?? []).map((t) => t.territory_name);

  // Lista de usuarios — RLS deja a admin leer todos
  const { data: users } = await supabase
    .from("users_permissions")
    .select(
      "user_id, email, full_name, role, allowed_territories, can_edit_ptto, is_active, last_login, created_at"
    )
    .order("created_at", { ascending: true });

  // Resolver last_sign_in_at via admin client (auth.users no es accesible vía RLS)
  const admin = createSupabaseAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const lastSignInMap = new Map<string, string | null>();
  for (const u of authList?.users ?? []) {
    lastSignInMap.set(u.id, u.last_sign_in_at ?? null);
  }

  const rows: UserRow[] = (users ?? []).map((u) => ({
    user_id: u.user_id,
    email: u.email,
    full_name: u.full_name,
    role: u.role as RoleKey,
    allowed_territories: u.allowed_territories ?? null,
    can_edit_ptto: u.can_edit_ptto,
    is_active: u.is_active,
    last_login:
      lastSignInMap.get(u.user_id) ?? u.last_login ?? null,
    created_at: u.created_at,
  }));

  return <UsuariosClient initial={rows} territories={territories} />;
}
