import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runDataRefresh } from "@/lib/data-refresh";

// Igual que el refresh manual: Hobby = 300 s máx.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync — sincronización AUTOMÁTICA diaria (V4.4, Idea 1).
 *
 * Lo invoca Vercel Cron (ver vercel.json: 12:00 UTC = 06:00 CDMX). Vercel
 * manda solo el header `Authorization: Bearer <CRON_SECRET>` cuando la
 * variable de entorno CRON_SECRET existe en el proyecto. El valor lo define
 * el humano en Vercel; este código solo lo compara.
 *
 * Reglas:
 *   1. Sin CRON_SECRET configurado → 503 (no hay forma de autenticar).
 *   2. Header inválido → 401.
 *   3. app_settings.sync_auto.enabled !== true → skip (modo manual).
 *   4. Ya corrió una sync automática hoy (CDMX) → skip (dedupe por si Vercel
 *      reintenta).
 *   5. Hay una sync manual "running" de hace < 10 min → skip.
 *   6. Refresca SOLO el mes en curso (CDMX), Susazón + Suve.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET no está configurado en Vercel" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authBuf = Buffer.from(auth);
  const expBuf = Buffer.from(expected);
  const ok =
    authBuf.length === expBuf.length && timingSafeEqual(authBuf, expBuf);
  if (!ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // 3. ¿Modo automático activado?
  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "sync_auto")
    .maybeSingle();
  const enabled =
    (setting?.value as { enabled?: boolean } | null)?.enabled === true;
  if (!enabled) {
    return NextResponse.json({ skipped: "sync_auto deshabilitado (modo manual)" });
  }

  // "Ahora" en CDMX (UTC-6 fijo; México no tiene horario de verano desde 2022).
  const nowMx = new Date(Date.now() - 6 * 3600 * 1000);
  const year = nowMx.getUTCFullYear();
  const month = nowMx.getUTCMonth() + 1;
  const day = nowMx.getUTCDate();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  // 00:00 CDMX de hoy = 06:00 UTC
  const dayStartIso = new Date(Date.UTC(year, month - 1, day, 6, 0, 0)).toISOString();

  // 4. Dedupe: ¿ya corrió el cron hoy?
  const { data: todayCron } = await admin
    .from("sync_history")
    .select("id, status")
    .gte("started_at", dayStartIso)
    .contains("details", { trigger: "cron" })
    .limit(1);
  if (todayCron && todayCron.length > 0) {
    return NextResponse.json({
      skipped: `ya corrió una sync automática hoy (${todayCron[0].status})`,
    });
  }

  // 5. ¿Hay una sync manual en curso?
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: running } = await admin
    .from("sync_history")
    .select("id")
    .eq("status", "running")
    .gte("started_at", tenMinAgo)
    .limit(1);
  if (running && running.length > 0) {
    return NextResponse.json({ skipped: "hay una sync en curso" });
  }

  // 6. Refresh del mes en curso
  try {
    const result = await runDataRefresh({
      dateFrom: monthKey,
      dateTo: monthKey,
      sources: ["susazon", "suve"],
      trigger: "cron",
      user: null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
