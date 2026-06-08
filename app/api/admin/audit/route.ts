import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guards";

const VALID_ACTIONS = new Set([
  "login",
  "login_failed",
  "logout",
  "territory_toggle",
  "ptto_change",
  "user_created",
  "user_updated",
  "user_deleted",
  "data_refresh",
  "settings_toggle",
  "force_signout",
  "force_signout_all",
  "invite",
  "reset",
  "session_timeout_changed",
  "session_timeout_exemption_changed",
]);

const MAX_LIMIT = 200;

/**
 * GET /api/admin/audit
 * Lista eventos de audit_log con filtros y paginación.
 *
 * Query params:
 *   - action: una de las 9 audit_action (opcional)
 *   - email: substring case-insensitive en user_email (opcional)
 *   - from: ISO date YYYY-MM-DD (opcional)
 *   - to: ISO date YYYY-MM-DD (opcional, inclusivo)
 *   - offset: numero (default 0)
 *   - limit: numero (default 50, max 200)
 *
 * Solo admins. RLS también lo filtra a nivel DB como defensa en profundidad.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard;

  const params = request.nextUrl.searchParams;
  const action = params.get("action");
  const email = params.get("email");
  const from = params.get("from");
  const to = params.get("to");
  const offset = Math.max(0, parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(params.get("limit") ?? "50", 10) || 50)
  );

  let query = supabase
    .from("audit_log")
    .select("id, user_id, user_email, action, details, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (action && VALID_ACTIONS.has(action)) {
    query = query.eq("action", action);
  }
  if (email && email.trim() !== "") {
    query = query.ilike("user_email", `%${email.trim()}%`);
  }
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) {
      query = query.gte("created_at", d.toISOString());
    }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      // inclusivo: hasta el final del día seleccionado
      d.setHours(23, 59, 59, 999);
      query = query.lte("created_at", d.toISOString());
    }
  }

  const { data, error, count } = await query.range(
    offset,
    offset + limit - 1
  );

  if (error) {
    return NextResponse.json(
      { error: `Error consultando audit_log: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    events: data ?? [],
    total: count ?? 0,
    offset,
    limit,
  });
}
