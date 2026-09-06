/**
 * lib/data-refresh.ts — núcleo compartido del refresh de datos.
 *
 * Trae datos desde la API REST de Susazón y/o Suve mes a mes y los guarda en
 * `sales_rows` de forma idempotente (borra el (empresa, año, mes) SOLO cuando
 * la API devolvió filas válidas, luego inserta). Registra el corrida en
 * `sync_history` y deja rastro en `audit_log`.
 *
 * Lo usan dos rutas:
 *   - POST /api/data/refresh  → disparo MANUAL desde "Cargar Datos" (sesión).
 *   - GET  /api/cron/sync     → disparo AUTOMÁTICO diario de Vercel Cron
 *                               (CRON_SECRET, sin usuario). V4.4.
 *
 * Server-only: usa el cliente admin (service role).
 */

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchMonth,
  filterValidRows,
  monthsBetween,
  type ApiSource,
} from "@/lib/susazon-api";

export type RefreshTrigger = "manual" | "cron";

export interface RunRefreshParams {
  /** Mes inicial "YYYY-MM" (inclusive) */
  dateFrom: string;
  /** Mes final "YYYY-MM" (inclusive) */
  dateTo: string;
  sources: ApiSource[];
  trigger: RefreshTrigger;
  /** Quién lo disparó. `null` cuando lo dispara el cron. */
  user: { id: string; email: string | null } | null;
}

export interface RefreshResult {
  sync_id: string;
  status: "success" | "partial" | "failed";
  sources_processed: ApiSource[];
  months_processed: number;
  rows_imported: number;
  errors: Array<{ source: ApiSource; month: string; error: string }>;
}

function monthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Ejecuta el refresh completo. Lanza Error solo si no pudo ni siquiera
 * registrar la corrida en sync_history; todo lo demás se reporta en
 * `errors` del resultado.
 */
export async function runDataRefresh(
  params: RunRefreshParams
): Promise<RefreshResult> {
  const { dateFrom, dateTo, sources, trigger, user } = params;
  const [fromYear, fromMonth] = dateFrom.split("-").map(Number);
  const [toYear, toMonth] = dateTo.split("-").map(Number);

  const admin = createSupabaseAdminClient();
  const batchId = randomUUID();

  // 1. sync_history (status=running)
  const { data: syncRecord, error: syncErr } = await admin
    .from("sync_history")
    .insert({
      status: "running",
      source: sources.join("+"),
      date_from: `${dateFrom}-01`,
      date_to: `${dateTo}-01`,
      triggered_by: user?.id ?? null,
      details: { batch_id: batchId, sources, trigger },
    })
    .select("id")
    .single();

  if (syncErr || !syncRecord) {
    throw new Error(
      `Error iniciando sync: ${syncErr?.message ?? "unknown"}`
    );
  }

  // 2. Iterar sources × meses
  const months = monthsBetween(fromYear, fromMonth, toYear, toMonth);
  let totalImported = 0;
  const errors: RefreshResult["errors"] = [];

  for (const source of sources) {
    for (const { year, month } of months) {
      let result;
      try {
        result = await fetchMonth(source, year, month);
      } catch (err) {
        errors.push({
          source,
          month: monthLabel(year, month),
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      if (result.error) {
        errors.push({ source, month: monthLabel(year, month), error: result.error });
        // 401 (auth) → no tiene sentido seguir con esta source
        if (result.error.includes("HTTP 401")) break;
        continue;
      }

      const validRows = filterValidRows(result.rows);
      if (validRows.length === 0) continue;

      // Idempotencia: borrar lo previo de (empresa, año, mes) SOLO después de
      // confirmar que hay data nueva válida.
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
          month: monthLabel(year, month),
          error: `Delete previo: ${delErr.message}`,
        });
        continue;
      }
      console.log(
        `[refresh:${trigger}] ${source} ${year}-${month}: borradas ${deletedCount ?? 0} filas previas, insertando ${validRows.length} nuevas`
      );

      // Insert en chunks de 5000
      const chunkSize = 5000;
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows
          .slice(i, i + chunkSize)
          .map((r) => ({ ...r, batch_id: batchId }));
        const { error: insErr } = await admin.from("sales_rows").insert(chunk);
        if (insErr) {
          errors.push({
            source,
            month: monthLabel(year, month),
            error: `Insert: ${insErr.message}`,
          });
          break;
        }
        totalImported += chunk.length;
      }
    }
  }

  // 3. Cerrar sync_history
  const finalStatus: RefreshResult["status"] =
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

  // 4. Audit log (user_id/user_email nulos cuando es cron)
  await admin.from("audit_log").insert({
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    action: "data_refresh",
    details: {
      sync_id: syncRecord.id,
      trigger,
      sources,
      date_from: dateFrom,
      date_to: dateTo,
      rows_imported: totalImported,
      errors_count: errors.length,
    },
  });

  return {
    sync_id: syncRecord.id,
    status: finalStatus,
    sources_processed: sources,
    months_processed: months.length,
    rows_imported: totalImported,
    errors,
  };
}
