// lib/insightsAgrupador.ts
// Fase 2b — Insights en modo agrupador.
//
// Las rutas de Insights que usan RPC (concentracion, cuadrante, estacionalidad,
// penetracion, precio-items LISTA) branchean el scope DENTRO de la función SQL
// vía el parámetro p_agrupador_id. Pero dos rutas leen sales_rows DIRECTO
// (precio-dispersion DETALLE e item-detail) y no pueden delegar ese branch a
// una función. Para ellas, este helper construye un filtro PostgREST `.or()`
// que acota sales_rows a la UNIÓN de miembros del agrupador.
//
// Se invoca SOLO cuando viene agrupador → el camino normal (territorios) queda
// intacto. agrupador_member_arrays está gateado al usuario (admin o agrupador
// asignado), así que un usuario no puede espiar agrupadores ajenos.

type RpcClient = {
  // El .rpc() de supabase-js devuelve un PostgrestFilterBuilder (thenable, no
  // Promise nativa) → PromiseLike basta y es lo que hace `await` funcionar.
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }>;
};

// Cita un valor para una in-list de PostgREST: lo envuelve en comillas dobles y
// escapa backslash y comillas (permite comas, espacios, paréntesis en nombres).
function quote(v: string): string {
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Devuelve el string para `query.or(...)` que acota a los miembros del
 * agrupador, o null si no hay agrupador (la ruta usa su filtro normal).
 * Si el agrupador no existe / sin acceso / sin miembros → filtro imposible
 * (`anio.eq.-1`) = universo vacío.
 */
export async function agrupadorOrFilter(
  supabase: RpcClient,
  agrupadorId: string | null
): Promise<string | null> {
  if (!agrupadorId) return null;
  const { data } = await supabase.rpc("agrupador_member_arrays", {
    p_id: agrupadorId,
  });
  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, string[] | null>
    | undefined;
  if (!row) return "anio.eq.-1";

  const parts: string[] = [];
  const add = (col: string, arr: string[] | null | undefined) => {
    if (Array.isArray(arr) && arr.length) {
      parts.push(`${col}.in.(${arr.map(quote).join(",")})`);
    }
  };
  add("territorio", row.territorios);
  add("grupo", row.grupos);
  add("familia", row.familias);
  add("sku", row.skus);
  add("cliente", row.clientes);

  return parts.length ? parts.join(",") : "anio.eq.-1";
}
