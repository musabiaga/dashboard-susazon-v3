/**
 * Tipos de la base de datos Supabase.
 * Generados manualmente para empezar — luego se regeneran con:
 *   npx supabase gen types typescript --project-id <ID> > types/database.ts
 */

export type UserRole = "admin" | "director" | "gerente_regional" | "vendedor";

export type ThemePreference = "clean" | "editorial" | "warm-neo";

export interface UserPermissions {
  user_id: string; // uuid (FK a auth.users)
  email: string;
  full_name: string;
  role: UserRole;
  /** Array de territorios permitidos. NULL = todos */
  allowed_territories: string[] | null;
  can_edit_ptto: boolean;
  theme_preference: ThemePreference;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface TerritoryState {
  territory_name: string;
  is_active: boolean;
  disabled_by: string | null; // uuid
  disabled_at: string | null;
  reason: string | null;
  updated_at: string;
}

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "territory_toggle"
  | "ptto_change"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "data_refresh";

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
