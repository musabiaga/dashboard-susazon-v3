# Session Log — Dashboard Comercial Susazón V4.0

## Metadata

- **Proyecto:** Dashboard Comercial Susazón V4.0 (Profesional) — **InCom** (Inteligencia Comercial Susazón®)
- **Empresa/Usuario:** Grupo Susazón (Susazón + Suve) — Mauricio Usabiaga, Director de Operaciones
- **Inicio:** 2026-04-26
- **Cierre fase 1:** 2026-04-28 (deploy a producción)
- **Cierre fase 2:** 2026-04-30 (custom domain + UI polish + feature toggle Pesos/KG)
- **Cierre fase 3:** 2026-05-01 (Run-Rate hábiles + selector de mes histórico)
- **Cierre fase 4:** 2026-05-09 (Mejoras 1-5: lazy clientes, día-vs-día, multi-select Productos/Clientes, KG en tablas)
- **Cierre fase 5:** 2026-05-10 (Mejora 6: export Excel + Mejora 7: multi-select global + Branding InCom + Login rediseño)
- **Cierre fase 6:** 2026-05-13 (UX comercial avanzada: Toggle Cierre/Hoy + Pesos/Kilos en 6 tabs + Comparativos al-día + PDF Avance Comercial)
- **Cierre fase 7:** 2026-05-15 (Seguridad de sesión: timeout configurable + logout remoto admin + smart polling)
- **Cierre fase 8:** 2026-05-17 (Tab Insights · Análisis de Concentración: Treemap squarify + Radar + Pareto expandible + Excluir del universo)
- **Cierre fase 9:** 2026-05-23 (Selector de día global + 4 mejoras al tab Clientes: toggle gráfica Mismo mes/Evolución, buscar por productos, tabla 3 vistas, desglose por línea de producto)
- **Cierre fase 10:** 2026-06-02 (Tracking Diario: cards Variedad de SKUs + Clientes Activos + fix conteo por nombre, no por no_cliente)
- **Cierre fase 11:** 2026-06-06 (Tab unificado "Clientes y Productos": fusión Productos+Clientes con toggles independientes gráfica/tabla, buscador en tabla, desglose simétrico SKU→clientes)
- **Cierre fase 12:** 2026-06-07 (Insights ampliado: Pareto reemplaza Radar + dimensión Territorios + 3 sub-análisis nuevos — Precio $/kg, Cuadrante BCG, Estacionalidad — + comparación YoY justa + popovers de ayuda)
- **Cierre fase 13:** 2026-06-07 (Documentación V4.0 completa: docs vivos + 6 .docx regenerados + manual HTML/PDF + sync a Plan Z + auditoría de reconstrucción desde cero)
- **Versión actual:** 4.0.0 (en producción)
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)
- **URL prod canonical:** `https://www.dashboardcomercialsusazon.com`
- **URL prod fallback:** `https://dashboard-susazon-v3.vercel.app`
- **Última actualización:** 2026-05-23

---

## Arquitectura Actual

### Archivos del sistema

| Carpeta / Archivo | Propósito |
|---|---|
| `app/` | App Router Next.js 16 (rutas, layouts, server components) |
| `app/dashboard/` | Dashboard principal con **7 tabs** (Tracking, Ventas, Grupo Producto, **Clientes y Productos**, Vendedores, Perdidos, **Insights**) — Productos+Clientes fusionados en V4.0 |
| `app/admin/` | Panel admin (territorios, usuarios, audit, **configuración de sesión**) |
| `app/cargar-datos/` | Refresh APIs + editor PTTO |
| `app/api/` | API routes server-side (**29 endpoints** totales) |
| `app/api/insights/` | Endpoints del tab Insights (`concentracion`, `item-detail`, **`precio-dispersion`**, **`cuadrante`**, **`estacionalidad`**) |
| `app/api/dashboard/` | Endpoints del dashboard (incluye **`tracking-variedad`**, **`tracking-clientes-activos`** nuevos en V4.0) |
| `components/dashboard/` | Componentes de los 7 tabs y charts (incl. `ClientesProductosTab`, `DimensionTab` generalizado, `ProductoDesglose`) |
| `components/dashboard/insights/` | Componentes del tab Insights (ConcentracionAnalysis, **PrecioAnalysis**, **CuadranteAnalysis**, **EstacionalidadAnalysis**, **ItemPicker**, ConcentracionGrid, DateRangePicker) |
| `components/dashboard/report-pdf/` | Generador PDF "Avance Comercial" con `@react-pdf/renderer` (3 páginas) |
| `components/session/` | Modal "¿Sigues ahí?" + hooks de seguridad de sesión |
| `components/theme/` | 6 themes + selector modal |
| `components/layout/` | Header, layout shells, MonthSelector, ToggleCierreHoy |
| `hooks/useIdleTimeout.ts` | Hook client-only para detectar inactividad y firing del modal |
| `hooks/useSessionPolling.ts` | Smart polling de 3 capas (middleware + visibilitychange + fallback) |
| `lib/supabase/` | Clientes Supabase (browser, server, admin) |
| `lib/susazon-api.ts` | Wrapper server-side de APIs Susazón/Suve |
| `lib/format.ts` | Formatters (money, kilos, dates) — portado del V2.2 |
| `lib/business-days.ts` | Cálculo de días hábiles L-S menos LFT + helpers `findCalendarDayForBizDays`, `computePrevYearAlDia` |
| `lib/admin-guards.ts` | Guards de rol admin para API routes |
| `supabase/migrations/` | **24 migraciones SQL aplicadas** (V4.0 agregó: 021_insights_concentracion_dim_territorios, 022_insights_precio_items, 023_insights_cuadrante, 024_insights_estacionalidad) |
| `docs/` | Esta documentación (+ `LO_NUEVO.md` con resumen ejecutivo) |
| `proxy.ts` | Middleware de Next.js 16 (renombrado de middleware.ts) — ahora valida sesión en cada request |
| `.env.local` | Secrets (NO commit) |
| `AGENTS.md` | Auto-cargado al hacer cd al proyecto — instrucciones para Claude |

### Stack Tecnológico

- **Framework:** Next.js 16.2.4 (App Router + Turbopack)
- **UI:** React 19.2.4 + TypeScript 5 + Tailwind CSS 4 (CSS-first con `@theme`)
- **Charts:** Recharts 3.8 (NO Chart.js)
- **DB:** Supabase Postgres + Auth + Storage
- **DB SDK:** `@supabase/supabase-js` v2.104 + `@supabase/ssr` v0.10
- **Hosting:** Vercel (Hobby plan)
- **Repo:** GitHub privado

---

## Registro de Decisiones

### D001 — 2026-04-26 | Reescritura completa Next.js + Supabase
**Contexto:** El V2.2 (single-page HTML 3,321 líneas) tenía 3 problemas críticos: (1) API Key Susazón hardcoded en HTML visible desde DevTools, (2) sin sistema de permisos por usuario, (3) bugs visuales pendientes.
**Decisión:** Reescribir como Next.js 16 + Supabase con backend que oculte credenciales, RLS por territorio, panel admin para 15 usuarios, themes propios.
**Razón:** El V2.2 no es aceptable para uso real con personas externas a TI por la fuga de credenciales. El V3.0 mete una capa de servidor que jamás expone keys al browser.
**Estado:** Vigente (implementada y validada en producción).

### D002 — 2026-04-26 | RLS a nivel DB, no solo UI
**Contexto:** Necesitamos garantizar que un vendedor jamás pueda ver datos de territorios fuera de los permitidos, ni vía UI ni vía API directa.
**Decisión:** Activar Row-Level Security en `sales_rows` y todas las tablas sensibles. Las vistas KPI con `WITH (security_invoker = true)` para heredar el filtro RLS al consultar.
**Razón:** Defensa en profundidad — aunque alguien intercepte el JWT y haga queries directas, Postgres rechaza filas no permitidas a nivel motor.
**Estado:** Vigente. Verificada con 3 escenarios de prueba (vendedor con 1 territorio, director con todos, vendedor con territorio apagado).

### D003 — 2026-04-26 | Mapeo PTTO Intercompañias y Zurt-t
**Contexto:** Algunos territorios tenían nombres distintos en la DB del API vs en los sheets de PTTO de Mauricio.
**Decisión:** Mantener los nombres tal como vienen del API (`Intercompañias`, `Zurt-t`, etc.) sin renombrar, y cargar PTTO bajo esos nombres exactos. PTTO de "Intercompañias" se aplica solo a la fila Susazón; "Intercompañias Suve" queda en $0 porque el dashboard suma ambas al agregar.
**Razón:** Cualquier renombre sería sobreescrito en el siguiente refresh del API. Robustez > consistencia visual.
**Estado:** Vigente.

### D004 — 2026-04-26 | Supabase max-rows bumpeado a 50000
**Contexto:** Default Supabase es 1000 filas por SELECT. Las queries de SKUs (~250) y clientes (~1000+) hit el límite.
**Decisión:** Bumpear el max-rows del proyecto a 50,000 desde Supabase Dashboard → Settings → API.
**Razón:** Solución más simple que crear vistas no-territoriadas. Costo nulo, beneficio inmediato.
**Estado:** Vigente.

### D005 — 2026-04-27 | 6 themes con selector modal
**Contexto:** Mauricio quería múltiples themes para flexibilidad visual, distintos casos de uso (presentaciones, análisis denso, etc).
**Decisión:** 6 themes (Clean, Editorial, Warm Neo, Susazón Moderno, Stock Market, Liquid Glass). Selector pasa de dropdown a modal con previews grandes.
**Razón:** Los 6 cubren un espectro amplio: corporate, editorial, warm, dark business, trader high-density, modern Apple-style. El modal es necesario UX-wise con 6 opciones.
**Estado:** Vigente. 4 commits (`9d2eb30`, `4d0700f`, `d46198a`, `1c711c3`).

### D006 — 2026-04-28 | Quedarse con un solo proyecto Supabase
**Contexto:** Mauricio preguntó si separar dev/staging/prod en 2 proyectos Supabase (best practice clásica).
**Decisión:** Quedarse con UN solo proyecto (`qfxyrpifntcixwpvnjpd`) para esta escala (15 usuarios, single-tenant, datos de un solo cliente).
**Razón:** Costo/beneficio de separar no compensa para este tamaño. Migrar 337K filas + recargar PTTO + recrear users = 2-3 hrs de trabajo + riesgo de drift. Si en futuro necesita sandbox, usar Supabase Branches (Pro plan) que aísla schema sin migrar data.
**Estado:** Vigente.

### D007 — 2026-04-28 | Vercel Hobby plan + maxDuration 300s
**Contexto:** El refresh de APIs originalmente tenía `maxDuration = 800s` esperando plan Pro. Vercel Hobby permite máximo 300s.
**Decisión:** Bajar `maxDuration` a 300s en `/api/data/refresh`. Agregar warning en UI cuando el usuario configure un rango que exceda los 300s estimados.
**Razón:** Hobby plan alcanza para el 95% del uso real (refresh mensual de 1-2 meses). Solo usuarios pidiendo rangos enormes (28 meses x ambas APIs) se ven afectados — para ellos warning UI o upgrade Pro.
**Estado:** Vigente. Warning UI implementado (commit `f9a3eb6`).

### D008 — 2026-04-28 | Safari fix en Liquid Glass theme
**Contexto:** Mauricio reportó que en Safari las cards del theme Liquid Glass se veían como bloques sólidos coloreados, sin el frosted glass blur. En Chrome funcionaba bien.
**Decisión:** Agregar `isolation: isolate` + `transform: translateZ(0)` a las cards del theme + simplificar selector a `[class*="rounded-"]`.
**Razón:** Safari requiere stacking context propio + GPU compositing forzado para que `backdrop-filter` aplique. Chrome no necesita estos hints (engine más permisivo).
**Estado:** Vigente. Commit `b81f182`.

### D009 — 2026-04-29 | Custom SMTP (Resend) para emails de auth
**Contexto:** El servicio de email default de Supabase tiene rate limit (3-4 emails/hora) que aplica incluso en plan Pro. Imposible invitar 14 usuarios desde admin panel sin caer en el límite.
**Decisión:** Configurar Resend como SMTP custom en Supabase Dashboard → Authentication → SMTP Settings. Plan free de Resend da 3,000 emails/mes y 100/día — suficiente para los 15 usuarios.
**Razón:** Resend es el SMTP recomendado por Supabase (DX excelente, integración trivial). Alternativas (SendGrid, Postmark, AWS SES) requieren más setup. Plan free cubre 100% del uso real.
**Estado:** Vigente. Mauricio configuró 3 templates HTML (invite, recovery, magic link) con branding Editorial Susazón.

### D010 — 2026-04-29 | Custom domain dashboardcomercialsusazon.com
**Contexto:** Usar `dashboard-susazon-v3-44sp.vercel.app` no es profesional para usuarios externos a TI. Mauricio compró el dominio `dashboardcomercialsusazon.com` en GoDaddy.
**Decisión:** Configurar Vercel + GoDaddy con `www.` como canonical, apex con redirect 308 → www. DNS records: `A @ → 76.76.21.21` y `CNAME www → cname.vercel-dns.com`. Site URL de Supabase actualizada al dominio nuevo.
**Razón:** El patrón apex → www es estándar SEO/HTTPS. Vercel emite SSL gratis automáticamente vía Let's Encrypt. La URL canonical pasa a `https://www.dashboardcomercialsusazon.com` y la antigua sigue funcionando como fallback (no romper bookmarks de prueba).
**Estado:** Vigente. DNS resuelve correctamente, SSL emitido, dashboard carga.

### D011 — 2026-04-30 | Helper `getMexicoCityDateParts()` para timezone CDMX
**Contexto:** Vercel corre Server Components en UTC (no en hora de México). Después de las 6pm CDMX (= medianoche UTC), `new Date().getDate()` en server retornaba el día siguiente. El dashboard mostraba "Día 26/26 · Tiempo 100%" cuando todavía faltaba el último día laboral. Bug visible cada noche para todos los usuarios.
**Decisión:** Crear helper `getMexicoCityDateParts()` en `lib/business-days.ts` usando `Intl.DateTimeFormat` con `timeZone: "America/Mexico_City"`. Aplicar en 3 puntos: `app/dashboard/page.tsx`, `app/api/data/refresh/route.ts`, `app/cargar-datos/page.tsx`. Todos los demás `new Date()` quedan OK porque construyen fechas explícitas (deterministas).
**Razón:** El helper es resiliente a la TZ del proceso (UTC en Vercel, local en dev) — siempre devuelve año/mes/día CDMX. Solución quirúrgica sin tocar lógica de negocio.
**Estado:** Vigente. Commit `7aca319`. Verificado en producción (incognito + hora ~7pm CDMX).

### D012 — 2026-04-30 | Sidebar collapsible
**Contexto:** El sidebar de territorios ocupa 256px fijos. Con 17 territorios visibles, en laptops de 13" comprime mucho el chart principal del dashboard.
**Decisión:** Hacer el sidebar collapsible con botón ícono (`PanelLeftClose` / `PanelLeftOpen` de lucide-react). Persistencia en `localStorage` (key: `dashboard-sidebar-collapsed`). Default abierto. Cuando colapsado: tira de 44px con solo el botón para reabrir. Transición de 200ms.
**Razón:** Patrón estándar en dashboards modernos (VS Code, Notion, Linear). Beneficio claro (~280px liberados horizontal) sin riesgo (no toca DB ni lógica).
**Estado:** Vigente. Commit `08a1f2a`.

### D013 — 2026-04-30 | Tooltip custom en Tracking Diario alineado al UI moderno
**Contexto:** El tooltip default de Recharts en el chart de Tracking Diario se veía con UI antigua (sólido, sin estilo coherente). El tab Ventas ya tenía un `VentasTooltip` custom moderno con header oscuro + bullets de color.
**Decisión:** Crear `TrackingDiarioTooltip` análogo: header oscuro con "Día X — D MMM" + delta YoY del acumulado + bullets de color por serie. Misma información que el tooltip default, solo cambia presentación. Cursor del chart con línea punteada gris (era sólido por default).
**Razón:** Consistencia visual entre tooltips de todo el dashboard. La info no cambia, solo el "container".
**Estado:** Vigente. Commit `08a1f2a`.

### D014 — 2026-04-30 | Toggle Pesos/Kilos en Tracking Diario
**Contexto:** Mauricio (director) frecuentemente piensa tanto en pesos como en kilos. Tener que abrir Excel para ver "¿cuántos kg vendí vs el año pasado?" es fricción innecesaria. El sistema NO maneja `kgBudget` (solo `ventaBudget`), así que en vista KG todo se compara vs cierre 2025.
**Decisión:** Toggle "Pesos | Kilos" como segmented control arriba de las 8 stats. Persistencia en `localStorage` (key: `tracking-diario-mode`), default = pesos. Vista KG reformula las 8 stats (KG del Mes, vs 2025, Margen $ que no aplica al toggle, vs Mismo Mes Año Ant. KG, Pace 2025, Vel. Actual KG, Falta para igualar 2025, Run Rate KG), progress bar (vs cierre 2025), chart con 4 series (Venta KG diaria + Acumulado 2026 + Acumulado 2025 + Pace 2025), tabla con columnas distintas. Ambas vistas tienen row TOTAL al final de la tabla.
**Razón:** Beneficio alto para el rol de director, trabajo medio (~3 hrs), riesgo bajo (no toca DB ni otros tabs). Datos KG ya existen en `kpi.daily.current[].k` y `kpi.daily.prevYear[].k`.
**Estado:** Vigente. Commit `d941d56`.

### D015 — 2026-04-30 | KPI cards (KG y Margen) con delta absoluto + subInline
**Contexto:** El KPI card de KG arriba mostraba solo `↘ -17.7% vs Abr 25` — el director quería también el delta absoluto en kilos. Margen card similar: solo `13.8% de venta` sin YoY ni delta absoluto en pesos.
**Decisión:** (a) Helper `formatKgDeltaShort()` y `formatMoneyDeltaShort()` para comprimir K/M con signo. (b) KG card: `↘ -17.7% (-101K) vs Abr 25` (formato A inline con paréntesis). (c) Margen card: nueva prop `valueInline` en `KpiCard` que muestra el `% margen` en gris al lado del valor principal, y el sublabel pasa a ser el YoY con delta abs (`↘ -2.5% (-$0.5M) vs Abr 25`).
**Razón:** El director necesita ver tanto el % YoY como la magnitud absoluta del delta para tomar decisiones. El `subInline` mantiene la card a la misma altura sin perder información.
**Estado:** Vigente. Commits `96a0f79` + `d076030`.

### D016 — 2026-04-30 | Fix lógica "Ya superaste" — 3 estados claros
**Contexto:** En vista KG, el progress bar y la stat #7 mostraban "✓ Ya superaste" cuando el mes ya estaba cerrado, **incluso si NO se había superado el cierre 2025**. Bug visible: KG mes al 82% del cierre 2025 mostraba mensaje de éxito en verde.
**Decisión:** Reformular lógica de 2 estados a 3 estados claros: (1) `ySuperaste = acumKg >= prevYearKg` → "✓ Ya superaste" verde, (2) `mesCerradoSinSuperar = remainingBizDays === 0 && !ySuperaste` → "✗ No alcanzado · -101K vs 2025" rojo, (3) en marcha → "X kg/día" con tone warning/danger según pace 2025.
**Razón:** Bug claro de mi lógica original (`faltaIgualarKg = days > 0 ? gap/days : 0` caía en 0 y daba "ya superaste" cuando no había días). El fix separa el estado "superaste" del estado "ya no quedan días para intentar".
**Estado:** Vigente. Commit `96a0f79`.

### D017 — 2026-05-01 | Run-Rate unificado a días HÁBILES (eliminar inconsistencia)
**Contexto:** El dashboard tenía DOS Run-Rates calculados con lógicas diferentes: el del KPI card grande (header) usaba **días calendario** ("día 30/30") mientras que el del Tracking Diario usaba **días hábiles** ("Día 26 de 26"). Mauricio detectó la inconsistencia: para un negocio que no opera domingos ni feriados, dividir por días calendario subestima la velocidad real. Si llevas $25M en día calendario 7 (= día hábil 5), proyección calendario = $107M (subestima por dividir por 2 días no vendidos), proyección hábil = $130M (real, refleja ritmo de venta).
**Decisión:** Unificar TODOS los Run-Rates a días hábiles (L-S menos feriados LFT). En `app/dashboard/DashboardClient.tsx`, cambiar `factor = daysTotal / daysCurrent` a `factor = totalBizDays / elapsedBizDays`, ajustar `showRunRate >= 4 días hábiles` (era `>= 5 calendario`), y pasar `daysCurrent/Total` ya como hábiles. En `KpiCardsRow.tsx`, cambiar el texto "día X/Y" a "día hábil X/Y" para clarificar al usuario.
**Razón:** Coherencia con el comportamiento esperado de un dashboard comercial. Run-Rate sobre día hábil es la convención estándar en B2B donde el negocio no opera todos los días.
**Estado:** Vigente. Commit `41355ee`. Manual de usuario actualizado en mismo commit.

### D018 — 2026-05-01 | Selector de mes/año en dashboard (ver históricos)
**Contexto:** El dashboard solo mostraba el mes actual (CDMX). Si Mauricio estaba en mayo y quería revisar abril 2026 (o abril 2025), no podía — no había forma de cambiar de mes. Los datos sí están en DB (sales_rows tiene 28 meses de Ene 2024 a hoy), pero no había UI para consultarlos.
**Decisión:** Implementar un dropdown `MonthSelector` al lado del título del territorio, listando los últimos 24 meses. Al seleccionar un mes pasado, navega a `/dashboard?year=Y&month=M` y todo el dashboard recarga con esos parámetros. Tres elementos visuales adicionales:
  1. **Banner amarillo** arriba del dashboard cuando `isHistorical = true`, con botón "Volver al mes actual" (link a `/dashboard` sin params).
  2. **Etiqueta "Histórico"** dentro del dropdown trigger cuando se está viendo un mes pasado.
  3. **Etiqueta "Actual"** dentro del dropdown list al lado del mes en curso.

Implementación:
  - `app/dashboard/page.tsx` ahora recibe `searchParams: { year?, month? }` con validación (year >= 2024, month 1-12). Si vienen, usa esos; si no, default = mes actual CDMX.
  - `isHistorical` calculado server-side y pasado a `DashboardClient`.
  - Cuando histórico, `daysCurrent = daysTotal` (mes cerrado): el Run-Rate matemáticamente coincide con la venta real (factor = 1).
  - TODOS los queries (monthlySummary, dailyCurrent, dailyPrevYear, grupos, skus, clientes, vendedores, perdidos, budgetRows) ya estaban parametrizados con currentYear/currentMonth → ningún cambio adicional necesario.

**Limitación documentada en el manual:** los PTTOs (`territory_budgets`) están cargados solo para el año en curso. Meses históricos antes de 2026 no tendrán "Alcance Ptto" calculable — esperado, no es bug.

**Razón:** Necesidad real del director: revisar cierre de meses pasados para juntas, revisiones operativas, comparativos retrospectivos. El gap era evidente.
**Estado:** Vigente. Commit `a3a825f`. Manual y PDF actualizados.

### D013 — 2026-05-10 | Mejora 1: lazy endpoint clientes/día Tracking Diario

**Contexto:** El tab Tracking Diario solo mostraba totales por día. Para investigar qué clientes contribuyeron a una venta diaria específica, Mauricio tenía que abrir Supabase y query manual.

**Decisión:** Hacer cada fila de la tabla diaria expandible (ChevronRight) con un endpoint lazy que carga los clientes del día específico on-demand. Cache en memoria del componente; HTTP cache `private, max-age=60s`. Botón solo en flecha — el resto de la fila sigue cliqueable normal.

**Razón:** Pre-cargar todos los días + todos los clientes sería miles de filas innecesarias en payload. Lazy on-demand es 100x más liviano y la UX es buena (clientes aparecen en <500ms).

**Estado:** Vigente. Commit `744af0c`.

### D014 — 2026-05-10 | Mejora 2: día-vs-día YoY con precisión 100%

**Contexto:** Los charts comparaban mes-cierre 2025 vs mes-en-curso 2026 → sesgo enorme. "Declive del 50%" porque comparaba 30 días vs 5 días.

**Decisión:** Crear 4 vistas SQL diarias en migración 011 (`kpi_grupo_diario`, `kpi_sku_diario`, `kpi_cliente_diario`, `kpi_vendedor_diario`). Pasar acumulado al "mismo día laboral" del 2025 (al-día) además del cierre completo. Helper `findCalendarDayForBizDays(year, month, targetN)` mapea día hábil N entre años considerando feriados LFT distintos.

**Razón:** Precisión 100% en comparativos = decisiones correctas. Antes el dashboard mentía sistemáticamente sobre el desempeño.

**Estado:** Vigente. Commits `efeab07`, `072d872`, varios.

### D015 — 2026-05-10 | Mejora 6: export Excel con exceljs (no xlsx)

**Contexto:** Necesidad recurrente de bajar la data a Excel para tablas dinámicas / compartir con vendedores. Mauricio enfatizó "data accionable".

**Decisión:** Usar `exceljs` (no `xlsx` por CVE-2023-30533 + CVE-2024-22363). Helper `lib/export-excel.ts` genérico con bloque resumen + columnas + filas + total + freeze panes + zebra + numFmt nativo (proporciones reales 0.0% para pivot, NO strings con "%"). Lazy import al click del botón (~700KB no se carga en initial render). Botón en cada tab arriba a la derecha. WYSIWYG: respeta multi-select / status / filtros / dim activos.

**Razón:** Pivot-ready desde Excel + bajo footprint en bundle inicial + seguridad sin compromisos.

**Estado:** Vigente. Commits `49c23a6` (Perdidos) + `c207655` (los otros 6 tabs).

### D016 — 2026-05-10 | Mejora 7: "Todos" configurable con engrane

**Contexto:** Necesidad de comparar subsets arbitrarios de territorios (ej. "costa norte" = Mérida + Cancún + CDMX). Primer intento fue multi-select global en sidebar (cada territorio con checkbox) pero Mauricio lo rechazó: rompía la UX existente de "click = ese territorio".

**Decisión final:** Lista inferior del sidebar sigue siendo **uni-select** (click selecciona ese territorio único, como siempre). El item "Todos" arriba tiene ícono ⚙️ (Settings2) que abre dropdown con checkboxes para configurar QUÉ territorios incluye ese "Todos". Solo afecta cuando estás en modo "Todos"; no toca al estar en un territorio individual.

**Razón:** Preserva UX vieja para clicks rápidos + agrega flexibilidad sin acoplar. 4 modos en `DashboardClient`: `single` / `aggregated-all` / `aggregated-custom` / `aggregated-none`. Helper `lib/aggregate.ts` con `aggregateKpis`, `aggregateDimensionRows`, `aggregatePerdidoRows` agrega dinámicamente en cliente cuando hay subset custom.

**Adicional:** Se eliminó el `TerritoryFilter` local de `PerdidosTab` (~150 líneas borradas) — una sola fuente de verdad ahora vive en el sidebar.

**Estado:** Vigente. Commits `f14c349` (intento 1 rechazado), `2d6e2a0` (rework definitivo), `e4b5887` (frost popover liquid-glass fix).

### D017 — 2026-05-10 | Branding InCom (Inteligencia Comercial)

**Contexto:** El producto necesitaba identidad propia separada del cliente (Susazón). Mauricio compartió un escudo "InCom" (red de nodos + manos sosteniendo + gorrito chef + texto bordado).

**Decisión:**
- Generar favicon (`app/icon.png` 48×48), apple-icon (`app/apple-icon.png` 180×180 con fondo oscuro #1a1814), Open Graph image (`app/opengraph-image.png` 1200×630 con escudo flotando sobre gradient naranja Susazón).
- Eliminar el `favicon.ico` default de Next.js.
- Procesamiento Pillow: combinar 2 PNGs embebidos del SVG (máscara grayscale + escudo RGB) para alpha exacto (vs. floodfill que dejaba artifacts).
- Login rediseñado completo con split-screen: hero izquierdo con escudo InCom 440-520px + subtítulo "INTELIGENCIA COMERCIAL SUSAZÓN®" sobre aurora animado. Card derecho con form + logo Susazón Gourmet 6× (auto-switch marrón/blanco por theme).
- Intro animation 1.2s con scale + slide.
- `SusazonLogo` ahora tiene prop `surface="header"|"page"` con `PAGE_DARK_THEMES = {supabase-orange, stock-market, liquid-glass}` para decidir variante correcta.
- `metadataBase` + `openGraph` + `twitter` cards en `app/layout.tsx`.

**Razón:** Producto profesional necesita identidad. Branding diferenciado del cliente. Login premium estilo Stripe/Linear/Vercel.

**Estado:** Vigente. Commits `977ddc3` (thumbnails), `b457a53` (login redesign), `0f5572e` (logo limpio), `789bcc8` (logo Susazón), `48c0c4a` (logo 6× + fix themes oscuros).

> **Nota de numeración:** En la migración de fase 4 a fase 5 se reutilizaron por error los IDs D013-D017 (existen entradas duplicadas arriba). A partir de D019 la numeración es secuencial y limpia. Las decisiones D018 (2026-05-01, MonthSelector) y D018 (2026-05-13, Toggle Cierre/Hoy) ambas existen — la primera es histórica y la segunda es la formalmente registrada como D019 para evitar colisiones.

### D019 — 2026-05-13 | Fase 6 · Toggle "Cierre / Hoy" para desfase data-vs-calendario

**Contexto:** Si Mauricio refrescaba el dashboard temprano (sin venta del día), el sistema mostraba "REZAGADO -3pp" engañoso porque comparaba venta acumulada (hasta ayer) contra meta lineal de hoy. El día N de calendario no siempre coincide con el día N de datos.

**Decisión:** Toggle en el header global (junto al MonthSelector) que aparece **SOLO cuando hay desfase**. Permite alternar entre:
- **Cierre [13-may]** (último día con venta real)
- **Hoy [14-may]** (calendario)

Implementación:
- Detección automática server-side: `lastDayWithSale = max(d) WHERE venta>0`.
- Si `lastDayWithSale === actualTodayDay` → toggle NO aparece (no hay desfase).
- Click navega a `/dashboard?asOf=YYYY-MM-DD` — el server recalcula `daysCurrent` con ese día como referencia.
- TODO el dashboard se recalcula automáticamente (KPIs, %, vel necesaria, semáforos, run-rate).

**Razón:** Solución elegante a un bug operativo (mensajes alarmistas falsos por refresh temprano). Toggle visible solo cuando aporta valor.
**Estado:** Vigente.

### D020 — 2026-05-13 | Fase 6 · Toggle Pesos/Kilos extendido a 6 tabs

**Contexto:** El toggle Pesos/Kilos solo existía en Tracking Diario (D014). Mauricio quería ver vista KG en los demás tabs operativos.

**Decisión:** Replicar el toggle en 6 tabs: Ventas (12 meses), Productos, Grupo Producto, Clientes, Vendedores (+ Tracking ya existente). Comportamiento idéntico en todos:
- Las **líneas de margen %** se mantienen FIJAS en el eje Y derecho cuando alternas Pesos/KG.
- El insight es: *"¿cuándo vendí más kg, mi margen % subió o bajó?"*
- **Persistencia independiente** por tab (localStorage keys distintas).

**Razón:** UX consistente. El director piensa en pesos Y kilos según el contexto operativo; el toggle libera fricción.
**Estado:** Vigente.

### D021 — 2026-05-13 | Fase 6 · Comparativos "al-día año anterior" (no cierre completo)

**Contexto:** Los KPIs "vs mismo mes año anterior" comparaban contra el **CIERRE COMPLETO** del mes anterior. Resultado: en el día 10 de Mayo 2026 ($22M) vs. Mayo 2025 completo ($60M) daba **-63% engañoso**. El comparativo no era apples-to-apples.

**Decisión:** Helper `computePrevYearAlDia()` en `lib/business-days.ts` que calcula el valor del **mismo día hábil** del año anterior usando `findCalendarDayForBizDays()`. Aplicado en:
- KPIs del Tracking Diario (Pesos y Kilos)
- Tablas Por Territorio del PDF (Kilos y Margen)
- Stat panel del Tracking Diario muestra ambos: "al-día" como principal y "cierre" en gris como referencia secundaria.

**Razón:** Precisión 100% en comparativos. El "al-día" refleja desempeño real al mismo día N hábil; el "cierre" se conserva como referencia secundaria para no perder contexto.
**Estado:** Vigente.

### D022 — 2026-05-13 | Fase 6 · PDF "Avance Comercial" con @react-pdf/renderer

**Contexto:** Mauricio necesitaba un reporte descargable para juntas operativas, sin tener que screenshotear el dashboard. Replica del PDF "AvComSS" semanal que se hace a mano en Excel.

**Decisión:** Reporte completo de 3 páginas generado con `@react-pdf/renderer` (lazy import ~600KB):
- **Página 1 — Tracking Diario completo:** 8 stats Pesos + 8 stats Kilos, progress bar vs PTTO con marca pace 2025, chart compuesto barras+líneas (acumulado, ptto lineal, año anterior) con eje Y numerado.
- **Página 2 — Tablas comerciales:** Por División (Foodservice / Distribuidores / Retail), Por Empresa (Susazón / Suve), Pesos por Territorio (11 territorios + TOTAL, con comparativo al-día 2025), Kilos por Territorio (con cierre como referencia), Margen por Territorio.
- **Página 3 — Detalle:** Top 10 Clientes con comparativo al-día año anterior + Var %, Tracking Diario detallado por día con semáforo de velocidad necesaria.

3 modos según selección del sidebar: **single** (1 territorio) → reporte focalizado / **multi** (subset custom) → con tablas / **all** (todos) → réplica AvComSS clásico.

Botón "Generar PDF" disponible en los 7 tabs operativos (mismo permiso que Excel). Lazy import del bundle pesado de `@react-pdf/renderer` para no inflar initial bundle.

**Razón:** Reporte ejecutivo replicable + bundle delta mínimo gracias a lazy import.
**Estado:** Vigente. Migraciones de SQL no requeridas (todo cliente-side).

### D023 — 2026-05-15 | Fase 7 · Seguridad de sesión completa (3 mecanismos coordinados)

**Contexto:** Supabase Auth default no expira sesiones por inactividad y no permite logout remoto. Para uso real con 15 personas externas a TI, esto es insuficiente — si alguien deja la sesión abierta en una PC compartida, queda accesible indefinidamente. Y un admin necesita poder forzar logout de un usuario comprometido.

**Decisión:** 3 mecanismos coordinados que se complementan:

#### a) Timeout de inactividad configurable
- Admin elige en `/admin/configuracion`: Sin límite (default) / 35 / 45 / 60 / 90 / 120 minutos.
- Listeners de mouse/keyboard/scroll/touch resetean el timer (100% cliente, 0 polling).
- A los 60s antes de expirar → modal **"¿Sigues ahí?"** con countdown grande.
- Admin marca exenciones por persona (`session_timeout_exempt` en `users_permissions`).
- Al expirar redirige a `/login?reason=idle` con banner amarillo.

#### b) Logout remoto desde admin
- Panel `/admin/usuarios`: botón **"Excluir sesión"** por fila + botón **"Cerrar todas las sesiones"**.
- "Cerrar todas" excluye al admin actual + usuarios marcados como exentos.
- Implementación SQL: función `force_signout_user(uuid)` que borra de `auth.sessions` + `auth.refresh_tokens`. (El método `auth.admin.signOut()` del SDK Supabase requería JWT del usuario — no funcionaba con user_id.)
- Usuario afectado redirige a `/login?reason=admin` con banner rojo.

#### c) Smart Polling para detectar logout remoto (3 capas combinadas)
1. **Middleware** valida en CADA request existente — 0 requests extra.
2. **`visibilitychange` + `focus`** al regresar a la tab — ~10 req/día/usuario.
3. **Polling fallback cada 30 min** — safety net para "usuario observando sin tocar".

Total: **~5,600 req/mes para 15 usuarios** (vs. 21,000 con polling cada 60s = **−74%**).

**Razón:** Seguridad de nivel enterprise sin pagar el costo de polling agresivo. 3 capas redundantes garantizan detección en <30 min en el peor caso y casi-instantánea al cambiar tab.
**Estado:** Vigente. Migraciones `017_session_security` (config tables + columna `session_timeout_exempt`) y `018_force_signout_function`.

### D024 — 2026-05-17 | Fase 8 · Tab Insights · Análisis de Concentración (Pareto)

**Contexto:** Los 7 tabs operativos responden preguntas del día a día. Faltaba un espacio para análisis avanzados no operativos: *"¿qué tan dependientes somos del top X clientes / grupos / productos?"* — la pregunta clásica de concentración tipo Pareto.

**Decisión:** Tab nuevo (8vo, icono 💡) dedicado a análisis avanzados. Primer sub-análisis: **Concentración**.

Características:
- **Date Range Picker** con atajos: Este mes, Mes anterior, 30d, 90d, YTD, 12m, custom.
- **3 dimensiones**: Grupos / Clientes / Productos (toggle independiente).
- **4 métricas**: Pesos, Kilos, Margen $, Margen % (toggle).
- **2 visualizaciones**:
  - **Treemap squarify** (algoritmo manual `ConcentracionGrid`, área proporcional al valor, bloques cuadrados ratio ≈ 1:1).
  - **Radar** (gradient fill + dots adaptativos + truncado dinámico para 10-15 ejes).
- **Top N selector**: 7 / 10 / 15 items + "Resto del universo".
- **Multi-select** sin límite para análisis ad-hoc.
- **Estado inicial bonito**: Top 7 + Resto = octágono perfecto.
- **Tabla Pareto expandible**: cada fila se expande con click para mostrar facturas del cliente (o clientes que compraron del grupo/producto). Columnas: Venta, Kilos, Margen $, Margen %, % Universo, Acumulado, Δ pp.
- **Excluir items del universo**: botón "Excluir" por fila — el 100% se recalcula sin ellos (útil para ignorar intercompañías, clientes atípicos).
- **Tooltip flotante moderno** con accent bar + jerarquía visual.
- **Filtra por territorios del sidebar**: respeta single / aggregated-custom / aggregated-all.
- **RLS por territorio** activa (un vendedor con `allowed=['Cancún']` solo ve Cancún).

Stack técnico:
- `app/api/insights/concentracion` + `app/api/insights/item-detail`.
- Función SQL `insights_concentracion(p_from, p_to, p_dim, p_territorios)` con SECURITY INVOKER (hereda RLS del caller).
- Componentes: `InsightsTab`, `ConcentracionAnalysis`, `ConcentracionGrid` (squarify), `TreemapHoverTooltip`, `DateRangePicker`.

**Architecture-ready para crecer:** el tab Insights es un contenedor con sub-toggles. Cuando se agreguen más sub-análisis (Estacionalidad, Cohortes, Crecimiento YoY, etc.) el sub-toggle pasa automáticamente de info-pill a segmented control.

**Razón:** El dashboard operativo no es el lugar para análisis Pareto; ese tipo de pregunta es semanal/mensual y se beneficia de una visualización dedicada. Tab nuevo separa cleanly los dos casos de uso.
**Estado:** Vigente. Migraciones `019_insights_concentracion` (función v1) y `020_insights_concentracion_territorios` (parámetro `p_territorios`).

### D025 — 2026-05-17 | Fase 8 · Treemap manual con algoritmo Squarify (no Recharts)

**Contexto:** Primer intento del Treemap usaba `<Treemap>` de Recharts. Resultado: bloques con ratios amorfos (rectángulos largos arriba, cuadrados abajo), no proporcionales al valor de forma consistente, outlines fantasma en text/badges por herencia del `stroke` del parent.

**Decisión:** Reemplazar con implementación manual del algoritmo **Squarify** (Bruls, Huijsen, van Wijk, 2000) — el mismo que usa D3.

Características:
- Componente `ConcentracionGrid` (~500 líneas) con layout CSS Grid posicionado vía squarify.
- Garantiza bloques con áreas proporcionales al valor PERO con aspect ratio cercano a 1:1 (cuadrados). NUNCA produce rectángulos amorfos delgados.
- `TreemapHoverTooltip` flotante con accent bar + jerarquía visual + auto-flip (anti-clip en bordes del viewport).
- Sin outlines fantasma (no hay herencia de `stroke` del parent Recharts).
- ResizeObserver API para tiers adaptativos: tamaño de bloque ajusta padding/font-size automáticamente.

**Razón:** Recharts Treemap no produce el resultado profesional que el caso de uso requiere. Implementar squarify manual es ~500 líneas pero resuelve definitivamente la proporcionalidad visual.
**Estado:** Vigente. Documentación del algoritmo + papers de referencia en el comment header del componente.

### D026 — 2026-05-23 | Fase 9 · Selector de día libre (general)

**Contexto:** El toggle Cierre/Hoy (D019) solo permitía 2 opciones (último día con venta vs hoy). Mauricio quería elegir CUALQUIER día y ver el dashboard al cierre de ese día.

**Decisión:** Componente `DaySelector` (dropdown estilo MonthSelector) en el header global. Lista los días del mes seleccionado (tope: hoy CDMX en mes actual, fin de mes en histórico), resaltando días con venta (verde) vs sin venta (gris), con atajos "Hoy" y badge "Cierre" en el último día con venta. Click navega a `?asOf=YYYY-MM-DD` y todo el dashboard recalcula.

**Reemplazó al CutoffToggle en el header** (se quitó del header por amontonamiento; el componente CutoffToggle.tsx se conserva sin uso). El backend (`page.tsx`) ya soportaba `?asOf=`; se extendió para que funcione también en meses históricos (antes forzaba `daysCurrent = daysTotal`) y para calcular `daysWithSale` (array de días con venta) para cualquier mes.

**Razón:** Análisis retrospectivo de cualquier día sin depender de los 2 atajos. Combinado con el MonthSelector llega a cualquier fecha histórica.
**Estado:** Vigente. Commits `dabb54a`, `f10f441`.

### D027 — 2026-05-23 | Fase 9 · 4 mejoras de análisis profundo al tab Clientes

**Contexto:** Mauricio pidió 4 mejoras al tab Clientes para analizar su cartera a profundidad.

**Decisión:** Implementadas en el `DimensionTab` genérico mediante props opcionales (solo Clientes las activa → Grupo/Vendedores intactos):

1. **Toggle de gráfica "Mismo mes (3 años) / Evolución"** — la vista Evolución muestra barras de volumen mensual (agregado de clientes visibles) + línea de margen %, solo meses transcurridos. Componente `ClientesEvolutionChart`. Endpoint lazy `clientes-evolution`.

2. **Buscar por Clientes o Productos** — toggle en el buscador. En modo Productos, seleccionar SKUs muestra los clientes que más los compran (suma si varios). En modo Productos + Evolución: dropdown con TODOS los clientes del SKU (ordenados desc con monto) → evolución de 1 cliente comprando esos productos. Endpoint lazy `clientes-por-producto` + filtro `skus` en `clientes-evolution`.

3. **Tabla con 3 vistas** — toggle "Año vs Año / Meses {año} / vs Prom. 90d". Meses = columna por mes transcurrido + Total YTD. Prom 90d = ritmo diario del mes vs ritmo de últimos 90 días hábiles facturados, con Δ% ▲/▼. Componente `ClientesTableViews`. Endpoint lazy `clientes-ritmo-90d` (calcula los 90 días hábiles con `isBusinessDay`).

4. **Desglose por línea de producto** — cada fila de cliente se expande (chevron) a su facturación por grupo → sub-expand a SKUs. Al-día. Componente `ClienteDesglose`. Endpoint lazy `cliente-desglose` (1 query arma el árbol grupo→SKU server-side).

Todas respetan toggle Pesos/Kilos, filtro de territorios del sidebar y RLS por rol. Decisiones de diseño confirmadas con Mauricio vía AskUserQuestion en cada paso.

**Razón:** El tab Clientes era el más usado para análisis comercial; estas mejoras lo convierten en herramienta de análisis profundo sin salir del tab.
**Estado:** Vigente. Commits `002f551`, `fb59c1f`, `1615153`, `351ad16`, `677eb0e`, `6524a2c`, `8950245`.

### D028 — 2026-06-02 | Fase 10 · Cards Variedad de SKUs + Clientes Activos en Tracking Diario

**Contexto:** Mauricio quería ver en el Tracking Diario dos métricas de amplitud de cartera: cuántos SKUs distintos y cuántos clientes distintos se han facturado en el mes.

**Decisión:** Dos cards nuevas con comparativo al-día (mes anterior + año anterior). Endpoints lazy `tracking-variedad` y `tracking-clientes-activos`.

**Regla de negocio clave (confirmada con SQL):** un cliente se identifica por **NOMBRE**, no por `no_cliente`. Cada ERP (Susazón / Suve) numera a sus clientes por separado, así que el mismo cliente físico (ej. "20 CANCUN") tiene `no_cliente` distinto en cada empresa. Contar por `no_cliente` lo duplica. Verificado: Mayo 2026 daba 898 por `no_cliente` vs 648 por nombre (ver bug #38).

**Razón:** Amplitud de cartera (SKUs y clientes activos) es un indicador de salud comercial que no estaba visible.
**Estado:** Vigente. Commits `479289f`, `a625e47`, `33d6b6a`.

### D029 — 2026-06-06 | Fase 11 · Fusión Productos + Clientes en un tab combinable

**Contexto:** Los tabs Productos y Clientes compartían motor (`DimensionTab`) y el usuario quería poder combinar dimensiones (ej. gráfica de Clientes + tabla de Productos) sin duplicar tabs.

**Decisión:** Tab único **"Clientes y Productos"** (8 → 7 tabs). Contenedor `ClientesProductosTab` con render-prop y 3 toggles: Gráfica (Clientes|Productos), Tabla (Clientes|Productos), Volumen (Pesos|Kilos). Estrategia para no romper Clientes: si gráfica=tabla → un solo `DimensionTab` monolítico (idéntico al histórico); si difieren → instancia solo-gráfica + instancia solo-tabla. El `DimensionTab` se generalizó con `dimension=cliente|sku`, `controlledMode`, `showChart`/`showTable`.

**Mejoras encima (sin quitar nada):** buscador propio en la tabla cuando es standalone; desglose simétrico SKU→clientes (`ProductoDesglose`) en la tabla de Productos vista "Año vs Año".

**Razón:** Combinabilidad de dimensiones + un tab menos en la barra, replicando TODO Productos sobre Clientes.
**Estado:** Vigente. Commits `2a75f3c`, `434eb45`, `aaa4d39`, `9897aea`, `089f852`, `529c9c8`, `fff8992`.

### D030 — 2026-06-07 | Fase 12 · Insights: Pareto reemplaza Radar + Territorios + 3 sub-análisis nuevos

**Contexto:** El tab Insights tenía 1 solo sub-análisis (Concentración) con vista Radar. Mauricio pidió más análisis para resolver preguntas comerciales importantes.

**Decisión:** Insights pasa a **4 sub-análisis** detrás de un toggle (cada uno componente independiente y podable):
1. **Concentración** — la vista **Radar** se reemplaza por **Pareto** (barras + % acumulado; el Radar no comunicaba concentración). Nueva dimensión **Territorios** (3 → 4 dims).
2. **Precio $/kg** (Dispersión) — scatter precio/kg vs volumen por cliente para un SKU/grupo/familia; umbral "paga barato" y piso de volumen configurables; tabla ordenable con "dinero en la mesa".
3. **Cuadrante (BCG)** — scatter tamaño (log) vs crecimiento YoY, burbuja=margen; 4 cuadrantes con umbrales configurables; Nuevos aparte.
4. **Estacionalidad** — heatmap mes × dimensión con índice de estacionalidad (100 = mes típico) o absoluto; selector de año; Kg default.
Más popovers de ayuda "Cómo leer esto" en el foco del header (por sub-análisis).

**Decisiones de diseño confirmadas con Mauricio vía AskUserQuestion** (vista Pareto, reemplazar Radar, umbral −10%, piso 95%, mediana como umbral de tamaño, Nuevos aparte, índice de estacionalidad, Kg default, etc.).

**Razón:** Convertir Insights en una suite de inteligencia comercial (margen, foco comercial, planeación).
**Estado:** Vigente. Commits `00b41c6`, `87f5d44`, `d93038e`, `0bb5601`, `191973c`, `65803cb`, `a4c4c68`.

### D031 — 2026-06-07 | Fase 12 · Comparación YoY justa por fechas calendario (no días hábiles)

**Contexto:** El Cuadrante BCG compara el periodo actual contra el año anterior. El default termina "hoy", pero los datos pueden ir más atrás (ej. hoy=07-jun, datos al 05-jun).

**Decisión:** Capar el periodo actual a la **última fecha con datos** dentro del rango (`effectiveTo`) y comparar contra el **mismo tramo de fechas calendario** del año anterior (`from`/`effectiveTo` − 1 año). Se eligió **mismas fechas calendario** (no días hábiles equivalentes): Mauricio confirmó que días hábiles sería más rígido y confuso de leer, y para rangos normales la diferencia es mínima. La UI muestra la ventana de comparación real y avisa cuando se ajustó.

**Razón:** Sin el cap, comparaba 5 días (2026) vs 7 días (2025) → −24% falso cuando la realidad era +12% (bug #41).
**Estado:** Vigente. Commit `191973c`.

### D032 — 2026-06-07 | Fase 13 · Documentación V4.0 completa + auditoría de reconstrucción

**Contexto:** Mauricio pidió etiquetar todo como "Dashboard Comercial Susazón V4.0" y dejar AMBAS carpetas (repo `/docs` + `[Respaldo Profesional Plan Z]`) al 100% para poder reconstruir el sistema desde cero (por Claude Code o un developer), con estándar de industria.

**Decisión:** Overhaul de documentación a V4.0:
1. **Docs vivos** (md/xml): SESSION_LOG (Fases 10-13, D028-D032, bugs #38-#43), INSTRUCTIVO_AGENTE.xml (v4.0, fase_10/11/12, migraciones/endpoints), LO_NUEVO (reescrito), 00_INDICE_MAESTRO, CONTINUACION, AGENTS.md, README.md.
2. **6 .docx regenerados** a v4.0.0 vía `gen_docs.py` (VERSION bump + secciones V4.0/Fases 6-12 en ChangeLog y Manual + nota de estado en los técnicos).
3. **Manual in-app** (`public/instructivo.html` + espejo en docs) a V4.0 marcando lo nuevo; **PDF regenerado** desde el HTML con `chrome-headless-shell` de Playwright (el Chrome headless del sistema fallaba por GPU).
4. **Sync a Plan Z** con `scripts/respaldar.sh` (código + docs kebab-case + AGENTS + sesiones JSONL). CHANGELOG.md de Plan Z con entrada `[4.0.0]`.
5. **Auditoría de reconstrucción** (ambas carpetas): 24 migraciones sin gaps, deps locked (package-lock), `.env.example` completo (incl. Suve documentado), código completo en ambas, secrets gitignored + documentados. Verificación doble: todos los hechos (24 migr · 29 endpoints · 7 tabs · 4 sub-análisis) cuadran con el código real.

**Nota:** los NOMBRES de carpeta conservan "V3.0" a propósito (renombrarlas rompería el repo git/paths/Vercel); el contenido y el producto son V4.0.

**Razón:** Continuidad: cualquier agente o developer puede reconstruir el sistema desde cero con solo estas carpetas.
**Estado:** Vigente. Commits `52261a2`, `fec30fc`, `0631f8e`, `b6daf47`, `80968e6`.

---

## Bugs Resueltos

| # | Fecha | Descripción | Causa | Fix | Commit |
|---|-------|-------------|-------|-----|--------|
| 1 | 2026-04-26 | Sidebar mostraba solo 1 territorio (Celaya) | `SELECT distinct territorio FROM sales_rows` cortaba a 1000 filas | Switch a `territories_state` (auto-poblado por trigger) | (Fase 2c) |
| 2 | 2026-04-27 | Director merging Sus+Suve sin avisar | Aggregación por nombre de vendedor sin distinguir empresa | Migración 009 agregó `empresa` a vista, build 2 datasets, toggle UI | (Fase 3 vendedores) |
| 3 | 2026-04-27 | Eje X muestra "$0, $1, $2..." en charts Familia/Clientes | V2.2 bug: faltaba `dataKey="name"` en XAxis Recharts | Componente `GroupedBarChart` reusable con XAxis configurado | (Fase 3 grupo) |
| 4 | 2026-04-27 | KG column mostraba "23,528K" en lugar de "24K" | hardcoded "K" suffix sobre `toLocaleString` | Usar helper `formatKilos()` de `lib/format.ts` | (Fase 3) |
| 5 | 2026-04-28 | Build Vercel falló: 3 errores TypeScript | `npm run dev` no corre `tsc strict`, Vercel sí | Fixes en `Th` opcional + Recharts types readonly + tooltip formatter guard | `3f9c1cf` |
| 6 | 2026-04-28 | Build Vercel falló: maxDuration 800 inválido | Plan Hobby max 300s, no 800 | Bajar `maxDuration = 300` | `634c4ba` |
| 7 | 2026-04-28 | Refresh APIs error "did not match expected pattern" | URL fetch fallaba porque env var tenía whitespace al pegar | `sanitize()` con `replace(/\s+/g, "").trim()` + `validateUrl()` con `new URL()` defensivo | `e00b51d` |
| 8 | 2026-04-28 | Safari Liquid Glass: cards sólidos sin blur | Falta GPU compositing + stacking context para `backdrop-filter` | `isolation: isolate` + `transform: translateZ(0)` + selector más permisivo | `b81f182` |
| 9 | 2026-04-28 | Vercel timeout 504 al pedir 28 meses x 2 APIs | 28 × 60s = 28 min, excede el límite Hobby de 300s | Warning UI calcula tiempo estimado y avisa antes de ejecutar | `f9a3eb6` |
| 10 | 2026-04-29 | Email magic link "Otp expired" al hacer click | Site URL de Supabase apuntaba a `localhost:3000` (default dev). | Mauricio actualizó Site URL a la URL de prod en Supabase Dashboard → Auth → URL Configuration. | (config Supabase) |
| 11 | 2026-04-29 | Loop `/set-password` ↔ `/login` en flow recovery | `proxy.ts` no tenía `/set-password` en public routes; sin sesión activa redirige a login → loop. | Agregar `pathname === "/set-password"` a `isPublicRoute`. | `6d87c2a` |
| 12 | 2026-04-29 | "Auth session missing!" al fijar password desde formulario | El exchange de code estaba en Server Component (`/set-password/page.tsx`), pero Server Components no pueden persist cookies de sesión al browser — server veía sesión, cliente no. | Mover el exchange al Route Handler `/api/auth/callback` (sí puede mutar cookies). Server Component solo verifica `getUser()`. | `9dd712c` |
| 13 | 2026-04-29 | Recovery flow iba directo a dashboard sin pedir password | Callback solo redirigía a `/set-password` cuando `type === "invite"`. Para `type === "recovery"` iba a `/`. | Cambiar a `needsPasswordSet = type === "invite" \|\| type === "recovery"`. | `94a5366` |
| 14 | 2026-04-29 | Production URL incorrecta en docs y SECRETS | Mauricio había estado usando un Deployment URL específico (con hash) que se vuelve stale. URL correcta es la Production URL estable. | Reemplazar en AGENTS.md, docs/, scripts/gen_docs.py, SECRETS, regenerar `.docx`. | `8bde5d1` |
| 15 | 2026-04-30 | Dashboard mostraba "Día 26/26 · Tiempo 100%" desde 6pm CDMX | Vercel corre Server Components en UTC. Después de 6pm CDMX = medianoche UTC, server cree que es el día siguiente. Bug visible cada noche para todos los usuarios. | Helper `getMexicoCityDateParts()` con `Intl.DateTimeFormat` + `timeZone: "America/Mexico_City"`. Aplicado en 3 archivos. | `7aca319` |
| 16 | 2026-04-30 | Liquid Glass theme: items del sidebar se veían como "todos seleccionados" | Selector CSS `[class*="rounded-"]` aplicaba backdrop-filter a TODO elemento con `rounded-*`, incluyendo cada botón del sidebar. | Override `aside button[class*="rounded-"]` con `backdrop-filter: none`. Solo afecta items del sidebar; cards grandes mantienen el frosted glass. | `08a1f2a` |
| 17 | 2026-04-30 | Tooltip default de Recharts en Tracking Diario se veía obsoleto | El tooltip usaba `contentStyle` simple. El tab Ventas ya tenía un componente custom moderno. | Crear `TrackingDiarioTooltip` con header oscuro + delta YoY + bullets por serie. Misma info, UI moderno. | `08a1f2a` |
| 18 | 2026-04-29 | Email "rate limit exceeded" pese a Supabase Pro | El servicio email default tiene rate limit (3-4/hora) en TODOS los planes Supabase. Pro no lo quita. | Configurar SMTP custom de Resend en Supabase Dashboard → Auth → SMTP Settings. Free tier de Resend: 3,000 emails/mes. | (config Supabase) |
| 19 | 2026-04-30 | "✓ Ya superaste" salía cuando NO se había superado 2025 (mes cerrado) | Lógica `faltaIgualarKg = days > 0 ? gap/days : 0` caía en `0` cuando no quedaban días, y se interpretaba como "ya superaste". | Reformular a 3 estados claros: ySuperaste, mesCerradoSinSuperar, en marcha. Aplicado en stat #7 y progress bar. | `96a0f79` |
| 20 | 2026-05-01 | Run-Rate del header inconsistente con Run-Rate del Tracking Diario (calendario vs hábiles) | El KPI card grande del header usaba `factor = daysTotal/daysCurrent` (días calendario), mientras Tracking Diario ya usaba hábiles. | Unificar a días hábiles en `DashboardClient.tsx`: `factor = totalBizDays/elapsedBizDays`. Texto de la card cambia de "día X/Y" a "día hábil X/Y". | `41355ee` |
| 21 | 2026-05-10 | Perdidos: TODOS los clientes salían como "declive" | Comparaba mes-cierre 2025 vs mes-en-curso 2026 (parcial) → diferencia ~50% siempre. | Migración 011 vistas diarias + helper `findCalendarDayForBizDays()` + lógica al-día consistente. Status calculado con `baseRef`/`baseCur` en métrica activa. | `efeab07` |
| 22 | 2026-05-10 | `CREATE OR REPLACE VIEW` no permite reordenar columnas | Intenté agregar `mes_margen` + `ytd_margen` en medio de columnas existentes en `kpi_cliente_perdidos`. | Agregar nuevos campos al FINAL de la vista (única forma permitida por Postgres). Migración 012. | (migration 012) |
| 23 | 2026-05-10 | Vendedores multi-select preservaba selección inválida al cambiar Sus/Suve | Toggle cambia nombres de vendedores (con/sin sufijo), pero `selectedItems` quedaba con nombres viejos. | `key={...}` dinámico en `<DimensionTab>` fuerza remount + limpieza explícita de `localStorage` (`VENDEDORES_SELECTION_KEY`). | (Mejora 5+) |
| 24 | 2026-05-10 | Dropdown del ⚙️ "Configurar Todos" se transparentaba en Liquid Glass | `--bg-surface` en liquid-glass es solo 6% blanco; el background del dropdown no tapaba la lista de territorios detrás. | Clase `.frost-popover` con `background: rgba(20,18,38,0.88)` + `backdrop-filter: blur(40px) saturate(1.8)`. Override scopeado a `[data-theme="liquid-glass"]`. | `e4b5887` |
| 25 | 2026-05-10 | Logo Susazón se veía marrón ilegible en theme "Susazón Moderno" (supabase-orange) | `PAGE_DARK_THEMES` solo incluía `liquid-glass`. Los themes `supabase-orange` y `stock-market` también tienen `--bg-page` oscuro (#0a0a0a, #0a1124). | Agregar ambos themes a `PAGE_DARK_THEMES` en `components/brand/SusazonLogo.tsx`. | `48c0c4a` |
| 26 | 2026-05-10 | `<>...</>` fragment sin key causaba warning en TrackingDiarioTab | React requiere key en cada item de map; el fragment no la tomaba. | Cambiar a `<Fragment key={row.d}>...</Fragment>` explícito. | `744af0c` |
| 27 | 2026-05-10 | Tab Tracking Diario perdía 1 columna por row TOTAL al agregar expand button | Nueva columna del botón ChevronRight no fue agregada al row TOTAL. | Agregar `<Td>{" "}</Td>` empty como primera celda del TOTAL para alinear. | `744af0c` |
| 21 | 2026-05-01 | No había forma de ver datos de meses pasados desde el dashboard | El dashboard estaba hardcodeado al mes actual CDMX en `app/dashboard/page.tsx`. Sin selector de mes/año en UI. | Componente `MonthSelector` con dropdown 24 meses + searchParams `year`/`month` en `/dashboard` + banner amarillo cuando `isHistorical`. | `a3a825f` |
| 28 | 2026-05-13 | "REZAGADO -3pp" engañoso al refrescar dashboard en la mañana sin venta del día | Comparaba venta acumulada (hasta ayer) contra meta lineal de hoy. Día N calendario ≠ día N datos. | Toggle Cierre/Hoy en header global — aparece SOLO si `lastDayWithSale ≠ actualTodayDay`. Server recalcula `daysCurrent` con `?asOf=YYYY-MM-DD`. | (Fase 6) |
| 29 | 2026-05-13 | KPIs YoY mostraban "-63%" en día 10 del mes (comparaba contra cierre completo del año anterior) | Helper `computePrevYear` agregaba TODO el mes anterior, no el "al-día equivalente". | Helper `computePrevYearAlDia()` con `findCalendarDayForBizDays()`. Stat muestra "al-día" + "cierre" (gris) como referencia. | (Fase 6) |
| 30 | 2026-05-15 | `auth.admin.signOut(jwt, scope)` fallaba con "invalid JWT" al pasar user_id | El SDK Supabase requiere JWT del usuario afectado, no su user_id. Imposible obtener JWT del usuario desde admin panel. | Función SQL `force_signout_user(uuid)` con SECURITY DEFINER que DELETE desde `auth.sessions` + `auth.refresh_tokens`. | (migración 018) |
| 31 | 2026-05-17 | Treemap de Insights: outlines fantasma en text/badges | `stroke="var(--bg-page)"` pasado a `<Treemap>` parent se aplicaba recursivamente a TODOS los `<text>` y `<rect>` children. | Eliminado stroke del parent + `stroke="none"` explícito en cada `<text>`. (Después reemplazado por implementación manual squarify.) | (Fase 8) |
| 32 | 2026-05-17 | Top N "se congela" después de remover item con X | El botón X activaba `isCustom=true` y freezeaba el Top N. Confusión con el botón Ban (Excluir). | Eliminado botón X (siempre con confusión UX). Único botón es "Excluir" que recalcula universo manteniendo Top N funcional. | (Fase 8) |
| 33 | 2026-05-17 | Recharts Treemap producía rectángulos amorfos no proporcionales al valor | Algoritmo interno de Recharts no era squarify puro; bloques con ratios incoherentes (largos arriba, cuadrados abajo). | Reemplazo completo: componente manual `ConcentracionGrid` con algoritmo Squarify (Bruls et al. 2000). Aspect ratio ≈ 1:1 garantizado. | (Fase 8, D025) |
| 34 | 2026-05-17 | Bug crítico en métrica Margen %: stat mostraba "355.9%" | `pct = (item.margen_pct / universe.margen_pct) * 100` no aplica a métricas no aditivas (margen % no se "suma"). | Flag `isAdditive` por métrica. Para margen_pct: muestra valor raw del item, no "% del universo". % universo y acumulado solo aplican a métricas aditivas. | (Fase 8) |
| 35 | 2026-05-17 | Vendedor con `allowed=['Cancún']` veía data de todos los territorios en Insights | Función SQL `insights_concentracion` v1 no respetaba RLS de `sales_rows` porque tenía SECURITY DEFINER. | Migración 020: SECURITY INVOKER + parámetro `p_territorios text[]` opcional. Hereda RLS del caller. Endpoint backend pasa territorios efectivos del sidebar. | (migración 020) |
| 36 | 2026-05-21 | Tab Perdidos: labels YTD hardcoded a "Ene–Abr 25/26" (no se actualizaban al cambiar de mes) | `labelPrev`/`labelCurr` literales en vez de derivar de `monthShortYY` como ya hacía `dimLabel`. | Derivar ambos labels de `monthShortYY` (en mayo: "Ene–May 25/26"). | `87c2462` |
| 37 | 2026-05-23 | `git commit` falló con "index.lock write error: Operation timed out" | iCloud Drive sincronizando archivos de `.git/` → timeout al escribir el lock. No es error de código. | Reintentar el commit (transitorio). Los `git add` previos sí quedaron staged. También afecta `rm -rf .next` (usar `mv .next /tmp/...` antes del build). | (operacional) |
| 38 | 2026-06-02 | Card Clientes Activos contaba el doble (≈898 vs 648 real en Mayo 2026) | Contaba por `no_cliente`, pero cada ERP (Susazón/Suve) numera a sus clientes por separado → mismo cliente físico ("20 CANCUN" = CL-000364 en Sus, CL-000982 en Suve) contado dos veces. | Contar por **nombre de cliente** (`cliente`), no por `no_cliente`. Verificado con SQL contra la DB. | `33d6b6a` |
| 39 | 2026-06-06 | Tab Clientes y Productos: sub-toggle "Clientes/Productos" del buscador redundaba con el toggle de Gráfica del contenedor | El `enableProductSearch` (Mejora 3 de Fase 9) agregaba un sub-toggle dentro del buscador que ahora duplicaba el toggle de dimensión del contenedor unificado. | Quitar `enableProductSearch`/`productOptions`/`productSearchContext` del `DimensionTab` de clientes; el buscador queda como multi-select simple que sigue la dimensión del contenedor. | `529c9c8` |
| 40 | 2026-06-07 | Cuadrante BCG: el eje Y (crecimiento) se aplastaba por outliers extremos | Un cliente diminuto que pasó de ~$50 a ~$63K daba +126,777% de crecimiento, comprimiendo todos los demás puntos. | Acotar el dominio del eje Y con el **p95** del crecimiento (+ clamp del valor ploteado); el valor real se muestra en el tooltip. Estos casos (chico + crece muchísimo) caen correctamente en "Apuesta". | `0bb5601` |
| 41 | 2026-06-07 | Cuadrante BCG: comparación YoY injusta (mostraba −24% falso) | El periodo actual default termina "hoy" (07-jun) pero los datos llegan al 05-jun → comparaba 5 días de 2026 contra 7 días de 2025. | Capar el periodo actual a la última fecha con datos (`effectiveTo`) y alinear la ventana del año anterior al mismo tramo de fechas calendario. Validado: pasaba de −24% (falso) a +12% (real). | `191973c` |
| 42 | 2026-06-07 | Build local quedaba vacío / no compilaba al validar | El comando incluía `pkill -f "next build"`, que mataba el propio wrapper de shell (cuya línea de comando también contenía esa cadena) antes de que `npm run build` arrancara. | Correr el build sin `pkill` (asegurando que no haya builds concurrentes) + workaround iCloud `mv .next /tmp/...`. | (operacional) |
| 43 | 2026-06-07 | `respaldar.sh` abortaba en la sección 4 (backup de sesiones JSONL) | `existing=$(ls ...sessions...*_session_${hash}.jsonl 2>/dev/null \| head -1)` bajo `set -o pipefail` + `errexit`: cuando NO existía una sesión previa de ese hash (primera vez), `ls` retornaba ≠0 y abortaba el script. | Agregar `\|\| true` a la sustitución para que el pipeline retorne 0 cuando no hay match. Re-corrido: 7 sesiones (115MB) respaldadas a ambas carpetas. | (scripts/respaldar.sh) |

---

## Próximos Pasos / Backlog

### Inmediato (Mauricio)

- [ ] **Revocar GitHub PAT** (`github_pat_11CCZMILA0...`) en [github.com/settings/tokens](https://github.com/settings/tokens) — ya no se necesita, Vercel se conecta vía OAuth.
- [ ] **Invitar los 14 usuarios prod restantes** desde `/admin/usuarios` cuando tengas la lista (email + nombre + rol + territorios).
- [ ] **Mover `~/Downloads/SECRETS_DASHBOARD_V3.txt`** a Apple Notes (privado, encriptado).

### Completados en fase 2 (2026-04-29 al 2026-04-30)

- [x] **Custom domain** — `dashboardcomercialsusazon.com` configurado en GoDaddy + Vercel + Supabase Site URL actualizada (D010).
- [x] **Custom SMTP Resend** — para evitar rate limit de email de Supabase (D009).
- [x] **3 templates HTML de email** (invite, recovery, magic link) con branding Editorial Susazón.
- [x] **Fix timezone CDMX** — bug "Día 26/26 desde 6pm" resuelto (D011).
- [x] **Sidebar collapsible** con localStorage (D012).
- [x] **Tooltip custom Tracking Diario** alineado al UI moderno (D013).
- [x] **Toggle Pesos/Kilos** en Tracking Diario (D014).
- [x] **KPI cards con delta absoluto** (KG y Margen) + subInline (D015).
- [x] **Fix bug "Ya superaste"** — lógica de 3 estados (D016).

### Completados en fase 3 (2026-05-01)

- [x] **Run-Rate unificado a días hábiles** — eliminar inconsistencia calendario vs hábil entre header y Tracking Diario (D017).
- [x] **Selector de mes/año en dashboard** — dropdown 24 meses con banner histórico (D018).
- [x] **Manual de usuario actualizado** con corrección de Run-Rate y nueva sección sobre selector de mes (PDF regenerado).

### Completados en fase 4 (2026-05-09)

- [x] **Mejora 1**: Lazy endpoint clientes/día Tracking Diario (D013).
- [x] **Mejora 2**: Día-vs-día YoY con precisión 100% (D014) — 4 vistas SQL + helper `findCalendarDayForBizDays`.
- [x] **Mejora 3**: Multi-select Productos con persistencia + lock 15.
- [x] **Mejora 4**: Multi-select Clientes con `<MultiSelectChips>` reusable.
- [x] **Mejora 5**: Columnas KG en tablas inferiores (Grupo, Clientes, Vendedores).
- [x] **Buscador amplio en Perdidos** + chips de status + dona + LossCards laterales.
- [x] **Año 2024 informativo** como columna en Perdidos.

### Completados en fase 5 (2026-05-10)

- [x] **Mejora 6 (Chunk A)**: Export Excel en tab Perdidos (D015) — helper `lib/export-excel.ts` + `<ExportExcelButton>`.
- [x] **Mejora 6 (Chunk B)**: Export Excel en los 6 tabs restantes (Tracking, Ventas, Grupo, Productos, Clientes, Vendedores).
- [x] **Mejora 7**: Multi-select global con "Todos" configurable + engrane ⚙️ (D016) — `lib/aggregate.ts` con 4 modos de selección.
- [x] **Branding InCom** (D017): favicon + apple-icon + OG image + Twitter card + `metadataBase` + `openGraph` metadata.
- [x] **Login rediseño** split-screen: hero izquierdo con escudo InCom 520px + subtítulo "INTELIGENCIA COMERCIAL SUSAZÓN®" sobre aurora animado. Card derecho con logo Susazón Gourmet 6× (auto-switch marrón/blanco por theme).
- [x] **Intro animation** 1.2s con `prefers-reduced-motion` respetado.
- [x] **Fix Liquid Glass**: `.frost-popover` con background opaco + blur 40px para dropdowns en theme oscuro.
- [x] **`SusazonLogo` extendido** con prop `surface="header"|"page"` para auto-detectar variante correcta según contexto.
- [x] **Apple Notes** template completo de credenciales generado (Supabase + Susazón API + Vercel + GitHub + 14 usuarios + recovery codes).

### Completados en fase 6 (2026-05-11 a 2026-05-13) · UX comercial avanzada

- [x] **Toggle Cierre/Hoy** en header global (D019) — aparece solo si hay desfase data vs calendario.
- [x] **Toggle Pesos/Kilos** extendido a 6 tabs (D020): Ventas, Productos, Grupo Producto, Clientes, Vendedores. Líneas de margen % se mantienen fijas en eje Y derecho al alternar.
- [x] **Comparativos al-día año anterior** (D021): helper `computePrevYearAlDia()` aplicado en KPIs Tracking + tablas PDF. Comparativo principal apples-to-apples; cierre como referencia secundaria.
- [x] **PDF "Avance Comercial"** (D022): 3 páginas, lazy import @react-pdf/renderer ~600KB. 3 modos (single/multi/all) según sidebar.
- [x] **Botón "Generar PDF"** en los 7 tabs operativos.

### Completados en fase 7 (2026-05-14 a 2026-05-15) · Seguridad de sesión

- [x] **Timeout de inactividad configurable** (D023a): Sin límite / 35 / 45 / 60 / 90 / 120 min. Listeners de eventos resetean timer. Modal "¿Sigues ahí?" con countdown.
- [x] **Sistema de exenciones** por usuario (`session_timeout_exempt` en `users_permissions`).
- [x] **Logout remoto desde admin** (D023b): botones "Excluir sesión" + "Cerrar todas las sesiones". Función SQL `force_signout_user(uuid)` con DELETE desde `auth.sessions` + `auth.refresh_tokens`.
- [x] **Smart polling de 3 capas** (D023c): middleware + visibilitychange/focus + fallback 30 min. −74% requests vs polling 60s naive.
- [x] **Banners de razón en `/login`**: `?reason=idle` (amarillo) / `?reason=admin` (rojo).
- [x] **Migraciones 017_session_security + 018_force_signout_function**.

### Completados en fase 8 (2026-05-16 a 2026-05-17) · Tab Insights

- [x] **Tab Insights · Concentración** (D024): 8vo tab, icono 💡, contenedor con sub-toggles para futuros análisis.
- [x] **3 dimensiones × 4 métricas** (Grupos/Clientes/Productos × Pesos/Kilos/Margen$/Margen%).
- [x] **Date Range Picker** con 7 atajos rápidos.
- [x] **Treemap squarify manual** (D025): algoritmo Bruls et al. 2000, aspect ratio ≈ 1:1 garantizado, sin rectángulos amorfos.
- [x] **Radar adaptativo**: gradient fill, dots r=2.5/activeDot=4, truncado dinámico de etiquetas.
- [x] **Top N selector** (7/10/15) + "Resto del universo" octágono.
- [x] **Multi-select sin límite** + estado inicial bonito (Top 7 + Resto).
- [x] **Tabla Pareto expandible**: cada fila se expande con click; columnas Venta/Kilos/Margen $/Margen %/% Universo/Acumulado/Δ pp.
- [x] **Excluir items del universo**: botón "Excluir" por fila recalcula 100% sin ellos.
- [x] **Tooltip flotante moderno** `TreemapHoverTooltip` con accent bar + auto-flip.
- [x] **Filtra por territorios del sidebar**: respeta single / aggregated-custom / aggregated-all.
- [x] **RLS por territorio** activa (SECURITY INVOKER + parámetro `p_territorios`).
- [x] **Migraciones 019_insights_concentracion + 020_insights_concentracion_territorios**.
- [x] **Bug crítico Margen % "355.9%"** fixeado con flag `isAdditive` por métrica.
- [x] **`LO_NUEVO.md`** generado con resumen ejecutivo de Fases 6-8.

### Completados en fase 9 (2026-05-21 a 2026-05-23) · Selector de día + análisis profundo Clientes

- [x] **Mejora 1 — Selector de día libre** (D026): dropdown en header, ver dashboard al cierre de cualquier día. Reemplazó el CutoffToggle. Funciona en mes actual e histórico.
- [x] **Mejora 2 — Toggle gráfica Clientes "Mismo mes / Evolución"** (D027): barras volumen mensual + línea margen %. Endpoint `clientes-evolution`.
- [x] **Mejora 3 — Buscar por productos en Clientes** (D027): toggle Clientes/Productos; ver clientes que compran un SKU; evolución de 1 cliente por producto. Endpoint `clientes-por-producto`.
- [x] **Mejora 4 — Tabla Clientes con 3 vistas** (D027): Año vs Año / Meses / vs Prom. 90d. Endpoint `clientes-ritmo-90d`. Componente `ClientesTableViews`.
- [x] **Mejora 5 — Desglose por línea de producto** (D027): expand por cliente → grupo → SKU. Endpoint `cliente-desglose`. Componente `ClienteDesglose`.
- [x] **Fix bug Perdidos labels YTD** hardcoded (bug 36).
- [x] **Instructivo de usuario + docs actualizados** a v3.9.0.

### Completados en V4.0 — fase 10 (2026-06-01 a 2026-06-02) · Tracking Diario

- [x] **Card Variedad de SKUs** (D028): SKUs distintos del mes, al-día vs mes/año anterior. Endpoint `tracking-variedad`.
- [x] **Card Clientes Activos** (D028): clientes distintos del mes, al-día. Endpoint `tracking-clientes-activos`.
- [x] **Fix conteo por nombre, no por no_cliente** (bug 38): cada ERP Sus/Suve numera aparte → doble conteo. Verificado con SQL (898→648 real en Mayo).

### Completados en V4.0 — fase 11 (2026-06-06) · Tab unificado Clientes y Productos

- [x] **Fusión Productos + Clientes** (D029): 8 → 7 tabs. `ClientesProductosTab` con 3 toggles (Gráfica/Tabla/Volumen). Monolítico si gráfica=tabla; partido si difieren.
- [x] **DimensionTab generalizado**: `dimension=cliente|sku` + `controlledMode` + `showChart`/`showTable`. Endpoints `clientes-evolution`/`clientes-ritmo-90d` con param `dim`.
- [x] **Buscador propio en la tabla** standalone + **desglose simétrico SKU→clientes** (`ProductoDesglose`).
- [x] **Quitar sub-toggle redundante** del buscador (bug 39).

### Completados en V4.0 — fase 12 (2026-06-06 a 2026-06-07) · Insights ampliado

- [x] **Concentración: Radar → Pareto + dimensión Territorios** (D030). Migración 021.
- [x] **Sub-análisis Precio $/kg** (D030): scatter precio/kg vs volumen, umbral/piso configurables, tabla ordenable con "dinero en la mesa". Migración 022, endpoint `precio-dispersion`, `PrecioAnalysis` + `ItemPicker`.
- [x] **Sub-análisis Cuadrante BCG** (D030): tamaño (log) vs crecimiento YoY, 4 cuadrantes, Nuevos aparte. Migración 023, endpoint `cuadrante`, `CuadranteAnalysis`. Comparación YoY justa (D031, bug 41) + eje Y acotado por p95 (bug 40).
- [x] **Sub-análisis Estacionalidad** (D030): heatmap mes × dimensión, índice de estacionalidad. Migración 024, endpoint `estacionalidad`, `EstacionalidadAnalysis`.
- [x] **Popovers de ayuda "Cómo leer esto"** en el foco del header de Insights.
- [x] **Tabla ordenable por columna** en Precio $/kg.

### Completados en V4.0 — fase 13 (2026-06-07) · Documentación V4.0

- [x] **Docs vivos a V4.0** (D032): SESSION_LOG, INSTRUCTIVO_AGENTE.xml, LO_NUEVO, ÍNDICE, CONTINUACION, AGENTS, README.
- [x] **6 .docx regenerados** a v4.0.0 (`gen_docs.py`) + manual HTML/PDF a V4.0 (PDF vía `chrome-headless-shell` de Playwright).
- [x] **Sync a Plan Z** (`respaldar.sh`, fix bug 43) + CHANGELOG `[4.0.0]`.
- [x] **Auditoría de reconstrucción desde cero**: 24 migraciones sin gaps, deps locked, `.env.example` completo (Suve documentado), código completo en ambas carpetas, secrets gitignored + documentados.

### Próximo a venir (acordado con Mauricio)

- [ ] **Tab "Presentación Semanal"** — replica del PPT de la junta directiva (3 sub-tabs: Asesores / Ciudades / Productos). **BLOQUEADO**: requiere definir primero las **cuotas/objetivos por asesor** (Mauricio lo prepara de su lado). Spec recibido + discovery hecho; 7 preguntas pendientes (cuota, zona A/B/C/D, ciudad/plaza, par tablas, margen ponderado, posición del tab, naming). Ver detalle en `CONTINUACION_NUEVA_CONVERSACION.md`.
- [ ] **Fase 3 del tab Clientes y Productos** (acordada, no iniciada): selector global de rango de fechas donde los toggles operan sobre el rango seleccionado; comparativo = mismas fechas calendario.

### Mejoras opcionales (sin prisa)

- [ ] **Themes bonus:** Linear Eclipse + Bento Spatial (si querés más opciones visuales — propuestos pero no implementados).
- [ ] **Upgrade a Vercel Pro** ($20/mes) si necesitás refresh de rangos largos (>5 meses con ambas APIs).
- [ ] **Sentry o Logging tool** para monitoreo de errores en runtime.
- [ ] **CI/CD con GitHub Actions** — tests + lint en cada PR.
- [ ] **Documentar el flujo de PTTO** para futuras cargas anuales.
- [ ] **`kgBudget`** opcional en `territory_budgets` si en futuro se quiere meta de kilos también (afectaría stats #2 y #5/#7 de la vista KG en Tracking Diario).

### Aprendizajes para próximos proyectos

- [ ] Correr `npm run build` LOCAL antes del primer push a Vercel (cacha errores TS strict).
- [ ] Probar en mínimo 2 browsers antes de cerrar features con efectos avanzados (CSS modern).
- [ ] Setup de staging environment (Vercel branch `develop`) para próxima iteración mayor.
- [ ] **Cuando uses `new Date()` en server-side code que dependa de fecha local**, normalizar a la TZ del usuario explícitamente (`Intl.DateTimeFormat` con `timeZone`). Vercel siempre corre en UTC.
- [ ] **Server Components NO pueden mutar cookies**. Para flows de auth con `exchangeCodeForSession`, usar Route Handler.

---

## Instrucciones para el Agente (Claude o sucesor)

1. **Leer `00_INDICE_MAESTRO.md` primero** — te orienta rápido sobre qué archivo leer según tu rol.
2. **Leer este `SESSION_LOG.md`** — entendé las decisiones tomadas y bugs resueltos antes de tocar nada.
3. **Leer `INSTRUCTIVO_AGENTE.xml`** — contexto técnico estructurado para regenerar/mantener.
4. **Leer el `AGENTS.md` del raíz del repo** — auto-cargado al hacer `cd` al proyecto, tiene los gotchas críticos.
5. **Verificar memoria persistente:** `~/.claude/projects/.../memory/project_dashboard_susazon_v3.md`.
6. **Verificar git log:** `git log --oneline -20` para conocer commits recientes.
7. **Confirmar fase actual con Mauricio** ANTES de implementar cualquier cambio — los pendientes pueden haber evolucionado.
8. **Al terminar tu sesión:**
   - Agregá nueva entrada en sección "Registro de Decisiones" con ID secuencial (D009, D010...)
   - Si fixeaste bugs, agregá fila a "Bugs Resueltos"
   - Tachá items completados del backlog
   - Actualizá la fecha en metadata (línea 6) si hubo cambios significativos
   - Regenerá `.docx` solo si hubo cambios estructurales (nuevo módulo, refactor mayor)

### Reglas absolutas (de Mauricio)

- **NUNCA alucinar.** Ante cualquier duda, preguntar antes de implementar (`AskUserQuestion`).
- **NO eliminar elementos existentes** al replicar/mejorar features. Mauricio quiere TODO lo que hay + las mejoras como agregados.
- **Validar end-to-end** antes de declarar "listo".
- **Idioma:** español mexicano. Mauricio entiende inglés pero prefiere español.
- **Commits chunkeados** — tareas largas se trocean con commits intermedios para visibilidad.
