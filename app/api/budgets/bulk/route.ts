import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface BudgetRowInput {
  territorio: string;
  anio: number;
  mes: number;
  venta_budget: number;
}

/**
 * POST /api/budgets/bulk
 * Upsert masivo de presupuestos (PTTO). Usado por el editor de PTTO en
 * /cargar-datos. Solo admin/director pueden editar.
 *
 * Body: { rows: Array<{ territorio, anio, mes, venta_budget }> }
 *
 * RLS también filtra a nivel DB — esto es defensa en profundidad.
 */
export async function POST(request: NextRequest) {
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
      { error: "Solo admin/director pueden editar PTTO" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "Body inválido: requiere `rows: []` no vacío" },
      { status: 400 }
    );
  }

  // Validar y normalizar cada fila. Falla rápido si alguna está mal.
  const cleanRows: Array<BudgetRowInput & { updated_by: string }> = [];
  for (const row of body.rows as unknown[]) {
    const r = row as Partial<BudgetRowInput>;
    if (
      typeof r.territorio !== "string" ||
      r.territorio.trim() === "" ||
      typeof r.anio !== "number" ||
      r.anio < 2024 ||
      r.anio > 2030 ||
      typeof r.mes !== "number" ||
      r.mes < 1 ||
      r.mes > 12 ||
      typeof r.venta_budget !== "number" ||
      isNaN(r.venta_budget)
    ) {
      return NextResponse.json(
        {
          error: `Fila inválida: ${JSON.stringify(row)}. Requiere territorio (string), anio (2024-2030), mes (1-12), venta_budget (number).`,
        },
        { status: 400 }
      );
    }
    cleanRows.push({
      territorio: r.territorio.trim(),
      anio: r.anio,
      mes: r.mes,
      venta_budget: Math.max(0, r.venta_budget),
      updated_by: user.id,
    });
  }

  // Upsert por PK (territorio, anio, mes). Si existe → actualiza, si no → inserta.
  const { error } = await supabase
    .from("territory_budgets")
    .upsert(cleanRows, {
      onConflict: "territorio,anio,mes",
    });

  if (error) {
    return NextResponse.json(
      { error: `Error guardando: ${error.message}` },
      { status: 500 }
    );
  }

  // Audit log — registrar el cambio (no fatal si falla)
  await supabase.from("audit_log").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    action: "ptto_change",
    details: {
      rows_count: cleanRows.length,
      anio: cleanRows[0]?.anio,
      territorios: Array.from(new Set(cleanRows.map((r) => r.territorio))),
    },
  });

  return NextResponse.json({
    saved: cleanRows.length,
    timestamp: new Date().toISOString(),
  });
}
