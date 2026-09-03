-- 043_dim_universe_year.sql
-- =====================================================================
-- Universo de búsqueda por AÑO COMPLETO para la tab Clientes/Productos.
--
-- Problema: el buscador de Productos/Clientes solo listaba items con venta
-- en el MES seleccionado (los datasets kpi_*_summary se filtran por mes). Un
-- SKU vendido en otro mes del año (ej. Ago) pero con 0 en el mes en curso no
-- aparecía en el buscador, aunque sí en el desglose por cliente (año completo).
--
-- Esta función devuelve los NOMBRES DISTINTOS (SKU o cliente) con venta en
-- CUALQUIER mes del año p_year, respetando el mismo scoping que el resto del
-- tab: RLS de territorio (SECURITY INVOKER), filtro de territorios del sidebar,
-- y rama de agrupador (idéntica a insights_concentracion_cruzada, migr 042).
--
-- Se consulta sales_rows directo (no las vistas kpi_*, que están pre-agregadas
-- por mes) para obtener el universo anual sin el tope de 1000 filas de PostgREST
-- (la función devuelve el set completo).
-- =====================================================================

create or replace function public.dim_universe_year(
  p_dimension    text,                 -- 'productos' (SKU) | 'clientes'
  p_year         int,
  p_territorios  text[] default null,  -- selección del sidebar
  p_agrupador_id uuid   default null   -- modo vista enfocada de agrupador
)
returns table(name text)
language sql stable security invoker set search_path = public
as $$
  select distinct
    case p_dimension
      when 'clientes'  then coalesce(cliente, '(sin nombre)')
      when 'productos' then coalesce(sku, '(sin sku)')
      else coalesce(sku, '(sin sku)')
    end as name
  from public.sales_rows
  where anio = p_year
    and (case when p_agrupador_id is null
      then (p_territorios is null or territorio = any(p_territorios))
      else (territorio = any(coalesce((select territorios from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or grupo   = any(coalesce((select grupos     from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or familia = any(coalesce((select familias   from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or sku     = any(coalesce((select skus       from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[]))
         or cliente = any(coalesce((select clientes   from public.agrupador_member_arrays(p_agrupador_id)), array[]::text[])))
      end)
  order by 1;
$$;

grant execute on function public.dim_universe_year(text, int, text[], uuid) to authenticated;
