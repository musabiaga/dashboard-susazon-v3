-- 045_dim_mensual_multianio.sql
-- =====================================================================
-- Mejora 3 (V4.3): vista "Meses Hist." — matriz Años × Meses para el tab
-- Clientes/Productos. Devuelve venta/kg por (entidad, año, mes) para un
-- conjunto de entidades (los nombres del top de la tabla), TODOS los años en
-- registro, respetando el mismo scoping que el resto del tab: territorio del
-- sidebar + rama de agrupador (idéntica a insights_concentracion_cruzada /
-- dim_universe_year) + RLS (SECURITY INVOKER).
--
-- El componente arma la matriz (una fila por año bajo cada entidad) y el total
-- de los 3 años por mes.
-- =====================================================================

create or replace function public.dim_mensual_multianio(
  p_dimension    text,                 -- 'cliente' | 'sku'
  p_names        text[],               -- entidades (nombres) a traer
  p_territorios  text[] default null,  -- selección del sidebar
  p_agrupador_id uuid   default null   -- modo vista enfocada de agrupador
)
returns table(name text, anio smallint, mes smallint, venta numeric, kg numeric)
language sql stable security invoker set search_path = public
as $$
  select
    case p_dimension
      when 'cliente' then coalesce(cliente, '(sin nombre)')
      else coalesce(sku, '(sin sku)')
    end as name,
    anio, mes,
    sum(venta)::numeric as venta,
    sum(kg)::numeric    as kg
  from public.sales_rows
  where (case p_dimension
           when 'cliente' then coalesce(cliente, '(sin nombre)') = any(p_names)
           else coalesce(sku, '(sin sku)') = any(p_names)
         end)
    and (case when p_agrupador_id is null
      then (p_territorios is null or territorio = any(p_territorios))
      else (territorio = any(coalesce((select territorios from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or grupo   = any(coalesce((select grupos     from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or familia = any(coalesce((select familias   from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or sku     = any(coalesce((select skus       from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or cliente = any(coalesce((select clientes   from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[])))
      end)
  group by 1, anio, mes;
$$;

grant execute on function public.dim_mensual_multianio(text, text[], text[], uuid) to authenticated;
