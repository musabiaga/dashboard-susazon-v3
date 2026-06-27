import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  UsuariosClient,
  type UserRow,
  type RoleKey,
  type AgrupadorLite,
} from "./UsuariosClient";

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
      "user_id, email, full_name, role, allowed_territories, allowed_agrupadores, can_edit_ptto, can_export_excel, session_timeout_exempt, is_active, last_login, created_at"
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

  // Catálogo de agrupadores (para el multi-select de asignación)
  const { data: agData } = await admin
    .from("agrupadores")
    .select("id, nombre, icono, is_active")
    .order("nombre");
  const agrupadores: AgrupadorLite[] = (agData ?? []).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    icono: a.icono ?? null,
    is_active: a.is_active,
  }));

  const rows: UserRow[] = (users ?? []).map((u) => ({
    user_id: u.user_id,
    email: u.email,
    full_name: u.full_name,
    role: u.role as RoleKey,
    allowed_territories: u.allowed_territories ?? null,
    allowed_agrupadores: u.allowed_agrupadores ?? null,
    can_edit_ptto: u.can_edit_ptto,
    can_export_excel: u.can_export_excel,
    session_timeout_exempt: u.session_timeout_exempt ?? false,
    is_active: u.is_active,
    last_login:
      lastSignInMap.get(u.user_id) ?? u.last_login ?? null,
    created_at: u.created_at,
  }));

  return (
    <UsuariosClient
      initial={rows}
      territories={territories}
      agrupadores={agrupadores}
    />
  );
}
