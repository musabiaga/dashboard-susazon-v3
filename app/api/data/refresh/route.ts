import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runDataRefresh } from "@/lib/data-refresh";
import type { ApiSource } from "@/lib/susazon-api";
import { getMexicoCityDateParts } from "@/lib/business-days";

// Vercel: extiende el límite de ejecución de la función serverless.
// Hobby plan: max 300s (5 min). Pro plan: max 900s (15 min).
export const maxDuration = 300;

/**
 * POST /api/data/refresh — disparo MANUAL desde "Cargar Datos".
 * Trae datos desde la API REST de Susazón y/o Suve → guarda en sales_rows.
 * La lógica vive en lib/data-refresh.ts (compartida con el cron diario).
 *
 * Body opcional:
 *   {
 *     dateFrom: "YYYY-MM",  // default: hace 2 meses
 *     dateTo:   "YYYY-MM",  // default: mes actual
 *     sources:  ["susazon"] | ["suve"] | ["susazon","suve"]  // default: ["susazon"]
 *   }
 *
 * Permisos: solo admin o director.
 */
export async function POST(request: NextRequest) {
  // 1. Verificar sesión y permisos
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: perms } = await supabase
    .from("users_permissions")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!perms || !["admin", "director"].includes(perms.role)) {
    return NextResponse.json(
      { error: "Solo admin/director pueden refrescar datos" },
      { status: 403 }
    );
  }

  // 2. Parsear body. Default: últimos 3 meses, solo Susazón
  const body = await request.json().catch(() => ({}));
  // "Hoy" en CDMX (UTC-6). Server corre en UTC, ver lib/business-days.ts.
  const today = getMexicoCityDateParts();
  let defaultFromMonth0 = today.month - 1 - 2; // 0-11
  let defaultFromYear = today.year;
  while (defaultFromMonth0 < 0) {
    defaultFromMonth0 += 12;
    defaultFromYear -= 1;
  }
  const dateFrom: string =
    body.dateFrom ??
    `${defaultFromYear}-${String(defaultFromMonth0 + 1).padStart(2, "0")}`;
  const dateTo: string =
    body.dateTo ?? `${today.year}-${String(today.month).padStart(2, "0")}`;
  const sources: ApiSource[] =
    Array.isArray(body.sources) && body.sources.length > 0
      ? (body.sources.filter(
          (s: unknown) => s === "susazon" || s === "suve"
        ) as ApiSource[])
      : ["susazon"];

  if (!/^\d{4}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}$/.test(dateTo)) {
    return NextResponse.json(
      { error: "dateFrom/dateTo deben ser YYYY-MM" },
      { status: 400 }
    );
  }

  // 3. Ejecutar
  try {
    const result = await runDataRefresh({
      dateFrom,
      dateTo,
      sources,
      trigger: "manual",
      user: { id: user.id, email: user.email ?? null },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
