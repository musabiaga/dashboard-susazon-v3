import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuditClient, type AuditEvent } from "./AuditClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditAdminPage() {
  const supabase = await createSupabaseServerClient();

  // Primera página — RLS permite admins leer todos
  const { data: events, count } = await supabase
    .from("audit_log")
    .select("id, user_id, user_email, action, details, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const initial: AuditEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    user_id: e.user_id,
    user_email: e.user_email,
    action: e.action,
    details: e.details,
    created_at: e.created_at,
  }));

  return (
    <AuditClient
      initial={initial}
      totalCount={count ?? initial.length}
      pageSize={PAGE_SIZE}
    />
  );
}
