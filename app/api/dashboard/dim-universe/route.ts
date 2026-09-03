import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/dim-universe
 *
 * Universo de búsqueda por AÑO COMPLETO para la tab Clientes/Productos.
 * Devuelve los nombres distintos (SKU o cliente) con venta en cualquier mes
 * del año, para que el buscador encuentre items que no vendieron en el mes
 * seleccionado (ver migración 043_dim_universe_year.sql).
 *
 * Query params:
 *   dimension: "productos" | "clientes"   (requerido)
 *   year:      YYYY                        (requerido)
 *   territorios: CSV opcional (null = todos los visibles por RLS)
 *   agrupador:   uuid opcional (modo vista enfocada de agrupador)
 *
 * Respeta la RLS de territorio del usuario (la función es SECURITY INVOKER).
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const dimension = (sp.get("dimension") ?? "").toLowerCase();
  if (dimension !== "productos" && dimension !== "clientes") {
    return NextResponse.json(
      { error: "dimension debe ser 'productos' o 'clientes'" },
      { status: 400 }
    );
  }

  const year = parseInt(sp.get("year") ?? "", 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "year inválido" },
      { status: 400 }
    );
  }

  // territorios: CSV. Ausente → null = todos los visibles por RLS.
  const territoriosRaw = sp.get("territorios");
  let territorios: string[] | null;
  if (territoriosRaw === null) {
    territorios = null;
  } else if (territoriosRaw === "") {
    territorios = [];
  } else {
    territorios = territoriosRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const { data, error } = await supabase.rpc("dim_universe_year", {
    p_dimension: dimension,
    p_year: year,
    p_territorios: territorios,
    p_agrupador_id: sp.get("agrupador") || null,
  });

  if (error) {
    return NextResponse.json(
      { error: `Error al consultar: ${error.message}` },
      { status: 500 }
    );
  }

  const names = ((data ?? []) as { name: string }[])
    .map((r) => r.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  return NextResponse.json({ names });
}
