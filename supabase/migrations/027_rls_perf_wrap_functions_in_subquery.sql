-- 027_rls_perf_wrap_functions_in_subquery.sql
-- Fix de RENDIMIENTO RLS (NO cambia la seguridad, solo CÓMO se evalúa la política).
--
-- ============================================================================
-- SÍNTOMA (2026-06-16): los tabs Grupo Producto, Clientes y Productos,
-- Vendedores, Perdidos (e Insights) dejaron de mostrar datos — las gráficas
-- salían con los NOMBRES pero con venta/margen en 0.
--
-- CAUSA RAÍZ (confirmada con pg_stat_statements + EXPLAIN ANALYZE):
--   La política de sales_rows usaba:
--     territorio = ANY( visible_territories_for_current_user() )
--   y Postgres re-evaluaba esa función SECURITY DEFINER POR FILA (28,939×
--   por consulta). Las vistas _summary (Grupo/SKU/Cliente/Vendedor) y
--   kpi_cliente_perdidos promediaban 2.7–3.4s con PICOS de 7.9s, cruzando el
--   statement_timeout del rol 'authenticated' (8s). Al hacer timeout, la app
--   recibía null → los tabs se dibujaban vacíos / en 0. Intermitente (depende
--   de concurrencia + caché), por eso "a veces" servía. Los tabs ligeros
--   (Tracking Diario, Ventas, KPIs de Perdidos por lifecycle) no cruzaban 8s.
--   NO fue causado por cambios de código recientes — es un cuello de botella
--   preexistente que se agravó al crecer el dato (~10K filas/mes) hasta cruzar
--   el umbral de 8s.
--
-- FIX (patrón oficial Supabase: evaluar la función UNA sola vez):
--   Como la función devuelve text[], la forma correcta es
--     territorio IN (SELECT unnest(func()))
--   La función corre 1× en la subconsulta (nodo ProjectSet/Result hasheado,
--   loops=1) y se compara text=text. Mismo trato a current_user_is_admin()
--   (escalar → (SELECT ...)).
--
-- VERIFICADO:
--   * Perf: kpi_grupo_summary (jun, 3 años) pasó de 1,612ms a 29ms (56× más
--     rápido); plan usa Bitmap Index Scan + SubPlan hasheado (1 evaluación).
--   * Seguridad INTACTA: un usuario con 5 territorios permitidos sigue viendo
--     exactamente 5 (no los 16). Misma semántica, solo más rápido.
--   * Datos idénticos: perdidos 3,332 filas, grupo 490 filas.
-- ============================================================================

ALTER POLICY users_read_visible_territories ON public.sales_rows
  USING ( territorio IN (SELECT unnest(public.visible_territories_for_current_user())) );

ALTER POLICY territory_budgets_select ON public.territory_budgets
  USING (
    (SELECT public.current_user_is_admin())
    OR ( territorio IN (SELECT unnest(public.visible_territories_for_current_user())) )
  );
