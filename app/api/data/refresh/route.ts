import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchMonth,
  filterValidRows,
  monthsBetween,
  type ApiSource,
} from "@/lib/susazon-api";

// Vercel: extiende el límite de ejecución de la función serverless.
// Hobby plan: max 300s (5 min). Pro plan: max 900s (15 min).
// Para Susazon+Suve completos puede tardar más — si timeout en Hobby:
// (a) upgrade a Pro y subir a 900, o (b) partir refresh por meses/source.
export const maxDuration = 300;

/**
 * POST /api/data/refresh
 * Trae datos desde la API REST de Susazón y/o Suve → guarda en sales_rows.
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
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const dateFrom: string =
    body.dateFrom ??
    `${defaultFrom.getFullYear()}-${String(defaultFrom.getMonth() + 1).padStart(2, "0")}`;
  const dateTo: string =
    body.dateTo ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sources: ApiSource[] = Array.isArray(body.sources) && body.sources.length > 0
    ? (body.sources.filter((s: unknown) => s === "susazon" || s === "suve") as ApiSource[])
    : ["susazon"];

  const [fromYear, fromMonth] = dateFrom.split("-").map(Number);
  const [toYear, toMonth] = dateTo.split("-").map(Number);

  // 3. Crear sync_history (status=running) con admin client (bypassa RLS)
  const admin = createSupabaseAdminClient();
  const batchId = randomUUID();

  const { data: syncRecord, error: syncErr } = await admin
    .from("sync_history")
    .insert({
      status: "running",
      source: sources.join("+"),
      date_from: `${dateFrom}-01`,
      date_to: `${dateTo}-01`,
      triggered_by: user.id,
      details: { batch_id: batchId, sources },
    })
    .select("id")
    .single();

  if (syncErr || !syncRecord) {
    return NextResponse.json(
      { error: `Error iniciando sync: ${syncErr?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // 4. Iterar sources × meses
  const months = monthsBetween(fromYear, fromMonth, toYear, toMonth);
  let totalImported = 0;
  const errors: Array<{ source: ApiSource; month: string; error: string }> = [];

  for (const source of sources) {
    for (const { year, month } of months) {
      let result;
      try {
        result = await fetchMonth(source, year, month);
      } catch (err) {
        errors.push({
          source,
          month: `${year}-${String(month).padStart(2, "0")}`,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      if (result.error) {
        errors.push({
          source,
          month: `${year}-${String(month).padStart(2, "0")}`,
          error: result.error,
        });
        // Si el error es 401 (auth), abortamos esta source — no tiene sentido seguir
        if (result.error.includes("HTTP 401")) break;
        continue;
      }

      const validRows = filterValidRows(result.rows);
      if (validRows.length === 0) continue;

      // Idempotencia: antes de insertar lo nuevo, borrar lo que ya esté para
      // este (empresa, año, mes). Hacemos esto SOLO después de confirmar que
      // tenemos data nueva válida — si la API falló o devolvió 0 rows, NO
      // borramos para no perder lo que ya estaba.
      const empresaCode = source === "susazon" ? 0 : 1;
      const { error: delErr, count: deletedCount } = await admin
        .from("sales_rows")
        .delete({ count: "exact" })
        .eq("empresa", empresaCode)
        .eq("anio", year)
        .eq("mes", month);
      if (delErr) {
        errors.push({
          source,
          month: `${year}-${String(month).padStart(2, "0")}`,
          error: `Delete previo: ${delErr.message}`,
        });
        continue;
      }
      console.log(
        `[refresh] ${source} ${year}-${month}: borradas ${deletedCount ?? 0} filas previas, insertando ${validRows.length} nuevas`
      );

      // Insert en chunks de 5000
      const chunkSize = 5000;
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize).map((r) => ({
          ...r,
          batch_id: batchId,
        }));
        const { error: insErr } = await admin.from("sales_rows").insert(chunk);
        if (insErr) {
          errors.push({
            source,
            month: `${year}-${String(month).padStart(2, "0")}`,
            error: `Insert: ${insErr.message}`,
          });
          break;
        }
        totalImported += chunk.length;
      }
    }
  }

  // 5. Actualizar sync_history
  const finalStatus =
    errors.length === 0 ? "success" : totalImported > 0 ? "partial" : "failed";

  await admin
    .from("sync_history")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      rows_imported: totalImported,
      errors,
    })
    .eq("id", syncRecord.id);

  // 6. Audit log
  await admin.from("audit_log").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    action: "data_refresh",
    details: {
      sync_id: syncRecord.id,
      sources,
      date_from: dateFrom,
      date_to: dateTo,
      rows_imported: totalImported,
      errors_count: errors.length,
    },
  });

  return NextResponse.json({
    sync_id: syncRecord.id,
    status: finalStatus,
    sources_processed: sources,
    months_processed: months.length,
    rows_imported: totalImported,
    errors,
  });
}
