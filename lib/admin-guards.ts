import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLES = ["admin", "director", "gerente_regional", "vendedor"] as const;
export type RoleKey = (typeof ROLES)[number];

/**
 * Verifica que el caller tiene sesión y rol = admin.
 * Devuelve { user, perms } si OK, o NextResponse de error si no.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  const { data: perms } = await supabase
    .from("users_permissions")
    .select("role, full_name, email")
    .eq("user_id", user.id)
    .single();

  if (!perms || perms.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Solo admins pueden ejecutar esta acción" },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, perms };
}

export function isValidRole(r: unknown): r is RoleKey {
  return typeof r === "string" && (ROLES as readonly string[]).includes(r);
}

export function isValidEmail(e: unknown): e is string {
  return (
    typeof e === "string" &&
    e.includes("@") &&
    e.includes(".") &&
    e.length <= 320
  );
}
