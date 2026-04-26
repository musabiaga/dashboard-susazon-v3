import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) {
    await supabase.from("audit_log").insert({
      user_id: userData.user.id,
      user_email: userData.user.email ?? null,
      action: "logout",
      details: {},
    });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
