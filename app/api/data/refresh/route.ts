import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchSusazonMonth,
  filterValidRows,
  monthsBetween,
  type SusazonRow,
} from "@/lib/susazon-api";

/**
 * POST /api/data/refresh
 * Fetch desde la API REST de Susazón → guarda en sales_rows.
 *
 * Body opcional:
 *   { dateFrom: "YYYY-MM", dateTo: "YYYY-MM" }
 * Default: últimos 3 meses (incluye mes actual).
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
    .select("role, can_edit_ptto")
    .eq("user_id", user.id)
    .single();

  if (!perms || !["admin", "director"].includes(perms.role)) {
    return NextResponse.json(
      { error: "Solo admin/director pueden refrescar datos" },
      { status: 403 }
    );
  }

  // 2. Parsear rango. Default: últimos 3 meses
  let dateFrom: string;
  let dateTo: string;
  try {
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    dateFrom = body.dateFrom ?? `${defaultFrom.getFullYear()}-${String(defaultFrom.getMonth() + 1).padStart(2, "0")}`;
    dateTo = body.dateTo ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const [fromYear, fromMonth] = dateFrom.split("-").map(Number);
  const [toYear, toMonth] = dateTo.split("-").map(Number);

  // 3. Crear sync_history record (status=running). Usar admin para bypass RLS.
  const admin = createSupabaseAdminClient();
  const batchId = randomUUID();

  const { data: syncRecord, error: syncErr } = await admin
    .from("sync_history")
    .insert({
      status: "running",
      source: "susazon_api",
      date_from: `${dateFrom}-01`,
      date_to: `${dateTo}-01`,
      triggered_by: user.id,
      details: { batch_id: batchId },
    })
    .select("id")
    .single();

  if (syncErr || !syncRecord) {
    return NextResponse.json(
      { error: `Error iniciando sync: ${syncErr?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // 4. Iterar meses
  const months = monthsBetween(fromYear, fromMonth, toYear, toMonth);
  let totalImported = 0;
  const errors: Array<{ month: string; error: string }> = [];

  for (const { year, month } of months) {
    const result = await fetchSusazonMonth(year, month);
    if (result.error) {
      errors.push({
        month: `${year}-${String(month).padStart(2, "0")}`,
        error: result.error,
      });
      continue;
    }

    const validRows = filterValidRows(result.rows);
    if (validRows.length === 0) continue;

    // Insert en chunks de 5000 para evitar payloads enormes
    const chunkSize = 5000;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);
      const { error: insErr } = await admin.from("sales_rows").insert(
        chunk.map((r: SusazonRow) => ({
          empresa: Number(r.empresa) ?? 0,
          no_cliente: String(r.no_cliente ?? ""),
          cliente: r.cliente ?? null,
          territorio: String(r.territorio ?? "Sin territorio"),
          vendedor: r.vendedor ?? null,
          sku: r.sku ?? null,
          kg: Number(r.kg) || 0,
          fecha: r.fecha,
          anio: Number(r.anio),
          mes: Number(r.mes),
          venta: Number(r.venta) || 0,
          margen: Number(r.margen) || 0,
          familia: r.familia ?? null,
          grupo: r.grupo ?? null,
          batch_id: batchId,
        }))
      );

      if (insErr) {
        errors.push({
          month: `${year}-${String(month).padStart(2, "0")}`,
          error: `Insert: ${insErr.message}`,
        });
        break;
      }
      totalImported += chunk.length;
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
      date_from: dateFrom,
      date_to: dateTo,
      rows_imported: totalImported,
      errors_count: errors.length,
    },
  });

  return NextResponse.json({
    sync_id: syncRecord.id,
    status: finalStatus,
    months_processed: months.length,
    rows_imported: totalImported,
    errors,
  });
}
