<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dashboard Comercial Susazón V4.3 — Project Context

**Owner:** Mauricio Usabiaga (Director de Operaciones, Grupo Susazón). Habla español. **Regla absoluta: NUNCA alucinar. Ante cualquier duda, preguntar antes de implementar (AskUserQuestion).**

## Estado actual

**EN PRODUCCIÓN — versión 4.3.0** — deployado desde 2026-04-28. Última versión: 2026-09-03.

- **URL canonical:** `https://www.dashboardcomercialsusazon.com` (custom domain en GoDaddy)
- **URL fallback:** `https://dashboard-susazon-v3-44sp.vercel.app`
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)

- ✅ **Fases 0-16 completas.** Dashboard con **7 tabs** y **Insights con 6 sub-análisis** (Tracking, Ventas, Grupo Producto, Clientes y Productos, Vendedores, Perdidos, Insights), admin panel (territorios + usuarios + audit + config de sesión), auth + RLS por territorio, 6 themes, PDF Avance Comercial, seguridad de sesión.
- ✅ **V4.0 (Fases 10-12, Jun 2026):** Tracking +2 cards (Variedad SKUs, Clientes Activos); tabs Productos+Clientes fusionados en "Clientes y Productos"; **Insights ampliado a 4 sub-análisis** (Concentración con Pareto+Territorios, Precio $/kg, Cuadrante BCG, Estacionalidad).
- ✅ **V4.1 (Fases 13-15, Jun–Jul 2026):** 5º Insight **Penetración/Canasta** (migr 028); módulo **Agrupadores** — territorios virtuales (Fase 1→3: seguridad KAM por RLS, vista enfocada en los 7 tabs, meta manual + export; migr 029-037); **histograma mensual** interactivo en las pastillas de Tracking (Venta/Margen/KG).
- ✅ **V4.2 (Fase 16, Jul 2026):** 6º Insight **Crecimiento x Vendedor** (migr 038-040) — comparativa Año Anterior vs Actual (Mes + Acumulado) por cliente/producto, filtrable por vendedor y capada al mismo día; 6 mediciones (Kg · $ · Margen % · Margen $ · Variedad · Ticket Promedio); **fila TOTAL con totalizador REAL** (Σ pura en aditivas, COUNT DISTINCT en variedad/tickets, Margen % = Σmargen÷Σventa).
- ✅ **V4.3 (Fase 17, Jul 30 – Sep 3 2026):** profundización del tab **Clientes y Productos** — gráfica **Meses (3 años)** (12 meses × 2024/25/26), **expand mensual bidireccional** "campo minado" con "sin comprar desde" / **territorio(s)** en "Todos" (migr 041+044), **orden por columna** en las 3 vistas, **buscador con universo de AÑO COMPLETO** (migr 043; antes solo listaba items con venta en el mes), **desglose Año-vs-Año de 3 años** al expandir producto o cliente (`DesgloseYoYTable`), y **4ª vista de tabla "Meses Hist."** (matriz Años×Meses expandible con heatmap, migr 045). **Tracking Diario**: modo **Comparar vs año anterior (al día)** + fix Ptto Linear cierra en su total. **KPI header**: 4º KPI **Prom. Venta Diario** + ACUM consolidada en una pastilla. **Insights · Concentración**: **cruzar dimensiones** ("Filtrar por" + dimensión Familias, migr 042). **Parqueado**: sync automática de datos (diseñada, revertida; `docs/parked/`). El refresh sigue MANUAL.
- 🔧 **V4.4 (en curso, desde 2026-09-06):** Cargar Datos — **sincronización automática diaria vía Vercel Cron** (`vercel.json` → `GET /api/cron/sync` 01:30 UTC = 19:30 CDMX; solo mes en curso Susazón+Suve; toggle `app_settings.sync_auto` Manual/Automático; requiere env var **`CRON_SECRET`** en Vercel — la crea Mauricio, nunca pasa por el asistente; lógica compartida en `lib/data-refresh.ts`; migr 046) + **editor de metas PTTO robusto** (fila Real año-1 + % meta/real, menú ⋯ por territorio, paneles fijos, mes en curso, Descartar, última edición, Excel 3 hojas). Ver D045. El artefacto pg_cron de `docs/parked/` quedó superado.
- ✅ **46 migraciones SQL**, ~384K filas (Ene 2024 – Sep 2026; 2024 y 2025 completos, 2026 Ene–Sep), 15/15 usuarios en prod.
- 📌 **Lee `docs/LO_NUEVO.md` + `docs/CONTINUACION_NUEVA_CONVERSACION.md` primero** para retomar.

**Fase 2 (2026-04-29 / 2026-04-30):**
- ✅ **Custom domain** `dashboardcomercialsusazon.com` configurado (GoDaddy + Vercel + Supabase Site URL)
- ✅ **Custom SMTP Resend** — bypassea rate limit del email default de Supabase
- ✅ **3 templates HTML de email** (invite, recovery, magic link) con branding Editorial Susazón
- ✅ **Fix timezone CDMX** — bug "Día 26/26 desde 6pm" resuelto (helper `getMexicoCityDateParts()`)
- ✅ **Sidebar collapsible** con persistencia localStorage
- ✅ **Tooltip custom** Tracking Diario alineado al UI moderno del tab Ventas
- ✅ **Toggle Pesos/Kilos** en Tracking Diario — todo el tab cambia (8 stats + chart 4 series + progress bar + tabla con TOTAL)
- ✅ **KPI cards mejorados** — KG y Margen con delta absoluto + subInline
- ✅ **Fix bug "Ya superaste"** — lógica de 3 estados (ySuperaste, mesCerradoSinSuperar, en marcha)

**Fase 3 (2026-05-01):**
- ✅ **Run-Rate unificado a días hábiles** — eliminar inconsistencia entre header (calendario) y Tracking Diario (hábiles). Ahora ambos usan L-S menos LFT.
- ✅ **Selector de mes/año** — dropdown de 24 meses al lado del título del territorio. Banner amarillo cuando se ve un mes histórico. URL: `/dashboard?year=Y&month=M`.
- ✅ Documentación completa actualizada en `/docs/` (incluye Instructivo Usuario PDF estilo Liquid Glass) — leer ANTES de tocar nada

## ⚡ Pendientes inmediatos (Mauricio)

- [ ] Revocar GitHub PAT `github_pat_11CCZMIL...` en github.com/settings/tokens (ya no se usa)
- [ ] Mover `~/Downloads/SECRETS_DASHBOARD_V3.txt` a Apple Notes (privado, encriptado)
- [ ] Invitar los 14 usuarios prod restantes desde `/admin/usuarios` cuando esté la lista

## Dónde está cada cosa

| Necesidad | Archivo |
|---|---|
| **Empezar (cualquier rol)** | `docs/00_INDICE_MAESTRO.md` |
| **CONTINUAR EN OTRA SESIÓN CLAUDE — leer primero** | `docs/CONTINUACION_NUEVA_CONVERSACION.md` |
| **TOCAR AUTH / SMTP / templates email** | `docs/AUTH_FLOWS.md` (flows + config Resend + backup templates + troubleshooting) |
| **Decisiones tomadas + bugs resueltos** | `docs/SESSION_LOG.md` |
| **Contexto técnico estructurado para agentes** | `docs/INSTRUCTIVO_AGENTE.xml` |
| **Diseño del sistema** | `docs/01_Arquitectura_Tecnica.docx` |
| **Schemas DB + contratos APIs** | `docs/02_Diccionario_Datos.docx` |
| **Historial de cambios** | `docs/03_ChangeLog_Release_Notes.docx` |
| **Guía para usuarios finales (texto)** | `docs/04_Manual_Usuario.docx` |
| **Guía para usuarios finales (visual)** | `docs/Instructivo_Usuario_Visual.pdf` |
| **Guía para ingeniero TI** | `docs/05_Guia_TI_Despliegue.docx` |
| **Cómo rebuildear desde cero** | `docs/06_Guia_Reconstruccion.docx` |
| **Secretos (privado, NO en repo)** | `~/Downloads/SECRETS_DASHBOARD_V3.txt` → Apple Notes |

## Stack

- Next.js **16.2.4** (App Router + Turbopack) — NO 14, hay breakings
- React 19.2.4, TypeScript 5, Tailwind CSS 4 (CSS-first con `@theme`)
- Supabase JS v2.104 + `@supabase/ssr` v0.10
- Recharts 3.8 (NO Chart.js)
- Vercel Hobby plan (límite 300s/función)
- Supabase Free tier con max-rows bumpeado a 50000

## Gotchas críticos (no re-descubrir)

1. **`middleware.ts` → `proxy.ts`** en Next.js 16. Función `middleware()` → `proxy()`.
2. **`cookies()` es async** — siempre `await cookies()`.
3. **dotenv-expand interpola `$VAR` y `${VAR}`** — `API-DASH-CLAUDE-2026-$$1` debe ir como `API-DASH-CLAUDE-2026-\$\$1` en `.env.local`. En Vercel UI, va literal.
4. **Campo `empresa` de la API viene STRING** (`"SUSAZON"`/`"SUVE"`), NO int. `lib/susazon-api.ts → normalizeRow()` cae al fallback `cfg.empresaCode` basado en endpoint.
5. **Suve API es lenta** (~60s/mes). Vercel Hobby permite 300s → max ~5 meses con ambas APIs por refresh. Warning UI implementado.
6. **Refresh es idempotente** — DELETE before INSERT por (source, año, mes). Seguro re-correr.
7. **Supabase max-rows = 50000** (bumpeado). NO usar `distinct` sobre `sales_rows` para listas — usar `territories_state` (auto-poblado por trigger) o vistas KPI.
8. **Días hábiles = L-S** (no L-V). Solo Domingo es no-hábil + feriados LFT. Tabla en `lib/business-days.ts`.
9. **Recharts 3.x** cambió tipos a `readonly`. Si tocás tooltips, payload va con `readonly TooltipItem[]`.
10. **Safari + backdrop-filter:** requiere `isolation: isolate` + `transform: translateZ(0)` para que aplique. Aplicado en `[data-theme="liquid-glass"] [class*="rounded-"]` en `globals.css`.
11. **Turbopack cachea CSS** — si cambios en `globals.css` no aparecen, `rm -rf .next && npm run dev`.
12. **Vercel Hobby maxDuration ≤ 300s** — código tiene `export const maxDuration = 300` en `/api/data/refresh`.
13. **Carpetas con `_` prefix son PRIVADAS** y NO se rutean (App Router).
14. **Al replicar features del V2.2, NO eliminar elementos existentes** — Mauricio quiere TODO + las mejoras como agregados.
15. **TIMEZONE: Vercel Server Components corren en UTC.** Para "hoy" en CDMX (UTC-6) usar `getMexicoCityDateParts()` de `lib/business-days.ts`. NUNCA usar `new Date().getDate()` en server-side dependiendo de fecha local. Aplicado en `app/dashboard/page.tsx`, `app/api/data/refresh/route.ts`, `app/cargar-datos/page.tsx`.
16. **Server Components NO pueden mutar cookies.** Para flows de auth con `exchangeCodeForSession()` o `verifyOtp()`, usar Route Handlers (ej: `/api/auth/callback`). Si lo hacés en Server Component, server ve la sesión pero el browser cliente NO recibe las cookies → "Auth session missing!".
17. **Public routes en `proxy.ts`:** `/login`, `/set-password`, `/api/auth/*`, `_next/*`, archivos estáticos. Si agregás página pública, actualizá `isPublicRoute`.
18. **Custom SMTP de Supabase (Resend)** — el email service default tiene rate limit (3-4/hora) en TODOS los planes. Para los 15 usuarios prod, custom SMTP es obligatorio. Configurado en Supabase Dashboard → Auth → SMTP Settings.
19. **Custom domain canonical = `www.dashboardcomercialsusazon.com`** — apex hace 308 → www. Site URL de Supabase apunta al www. Si invitás usuarios o haces password reset, los emails llevan al www.
20. **Toggle Pesos/Kilos en Tracking Diario** — vista KG NO tiene `kgBudget` (no existe en DB). Toda comparación es vs cierre 2025 calculado del `kpi.daily.prevYear[].k`. Si en futuro se agrega `kgBudget` a `territory_budgets`, hay que actualizar las stats #2 (vs 2025) y #5/#7 (Pace 2025 / Falta para igualar).
21. **localStorage keys del dashboard:**
    - `dashboard-sidebar-collapsed` → "true"/"false" (sidebar abierto/cerrado)
    - `tracking-diario-mode` → "pesos"/"kg" (vista del tab Tracking Diario)
    - `dashboard-theme` → uno de los 6 themes
22. **Selector de mes/año (D018)** — `app/dashboard/page.tsx` lee `searchParams.year` y `searchParams.month`. Si vienen, usa ese mes; si no, default = "hoy" CDMX. Validación: year >= 2024, month 1-12. Cuando es histórico, `daysCurrent = daysTotal` (mes cerrado) y `factor = 1` para Run-Rate. **Limitación:** PTTOs (`territory_budgets`) cargados solo para año en curso → meses históricos antes de 2026 no tienen "Alcance Ptto" calculable (esperado, no es bug).
23. **Run-Rate = HÁBILES siempre (D017)** — desde 2026-05-01, todos los Run-Rates del dashboard usan días hábiles (L-S menos LFT). Antes había inconsistencia: header calendario, Tracking Diario hábiles. Si ves cálculos divergentes, verificar que estés usando `elapsedBizDays` y `totalBizDays` (NO `daysCurrent`/`daysTotal` que son calendario y se mantienen para otros usos).

## Datos clave (no secretos)

- **Carpeta proyecto:** `~/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]/`
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)
- **URL prod canonical:** `https://www.dashboardcomercialsusazon.com` (GoDaddy → Vercel)
- **URL prod fallback:** `https://dashboard-susazon-v3-44sp.vercel.app`
- **Vercel project name:** `dashboard-susazon-v3-44sp` (sufijo `-44sp` auto-generado)
- **Supabase project ID:** `qfxyrpifntcixwpvnjpd` — region East US (N. Virginia), plan Pro
- **SMTP:** Resend (free tier 3,000 emails/mes), configurado en Supabase Dashboard
- **Admin user:** `musabiagaz@susazon.com.mx` · UID `c787cd72-200a-469e-84a1-c0d3253b0b20`
- **Predecesor V2.2** (vivo en paralelo, NO TOCAR): `~/Desktop/Downloads Seleccionados/DASHBOARD SEMANAL VTS. V2.2/index.html` → `https://dashboard-comercial-susazon.netlify.app/`

## Cómo retomar en una sesión nueva

1. **Leer este archivo** (auto-cargado al `cd` al proyecto).
2. **Leer `docs/CONTINUACION_NUEVA_CONVERSACION.md`** — el doc compacto pensado específicamente para retomar el proyecto.
3. **Leer `docs/SESSION_LOG.md`** — decisiones D001-D043 + bugs 1-50 resueltos.
4. **Leer `docs/INSTRUCTIVO_AGENTE.xml`** si vas a hacer cambios estructurales.
5. **`git log --oneline -20`** para ver últimos commits.
6. **`git status`** por si quedaron cambios sin commitear.
7. **Confirmar fase actual con Mauricio** ANTES de tocar nada.
8. **Si vas a editar docs**, regenerá los `.docx` con `python3 scripts/gen_docs.py`.

## Reglas absolutas

1. **NUNCA alucinar.** Si dudás → AskUserQuestion. Mauricio prefiere "no sé, pregunto" antes que datos inventados.
2. **NO eliminar elementos existentes.** Replicar V2.2 = agregar mejoras, nunca quitar.
3. **Validar end-to-end antes de "listo".** Build local + tipos + smoke test browser.
4. **Commits chunkeados.** Tareas largas se trocean.
5. **Idioma:** español mexicano. Los mensajes técnicos pueden ir en inglés (commits, code) pero la comunicación con Mauricio en español.
6. **Antes de declarar el deploy listo:** correr `npm run build` local. Vercel hace tsc strict — `npm run dev` no.
