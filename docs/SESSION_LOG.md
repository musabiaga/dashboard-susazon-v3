# Session Log — Dashboard Comercial Susazón V4.3

## Metadata

- **Proyecto:** Dashboard Comercial Susazón V4.2 (Profesional) — **InCom** (Inteligencia Comercial Susazón®)
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
- **Cierre fases 14-15 (V4.1):** 2026-07-05 (Insight #5 Penetración/Canasta + módulo Agrupadores completo Fase 1→3 + histograma mensual en las pastillas de Tracking + fixes D033-D035/D037)
- **Cierre fase 16 (V4.2):** 2026-07-19 (Insights: 6º sub-análisis "Crecimiento x Vendedor" — comparativa AA vs Actual capada al mismo día, mediciones Kg/$/Margen %/Margen $/Variedad/Ticket Promedio + totalizador REAL)
- **Cierre fase 17 (V4.3):** 2026-09-03 (Clientes y Productos a profundidad: Meses 3 años, expand mensual "campo minado" + territorio, sort por columna, buscador de año completo, desglose Año-vs-Año de 3 años, vista Meses Hist. · Tracking "Comparar vs año anterior" · 4º KPI Prom. Venta Diario · Concentración cruza dimensiones · migraciones 041-045 · sync automática parqueada)
- **Versión actual:** 4.3.0 (en producción)
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)
- **URL prod canonical:** `https://www.dashboardcomercialsusazon.com`
- **URL prod fallback:** `https://dashboard-susazon-v3.vercel.app`
- **Última actualización:** 2026-09-03

---

## Arquitectura Actual

### Archivos del sistema

| Carpeta / Archivo | Propósito |
|---|---|
| `app/` | App Router Next.js 16 (rutas, layouts, server components) |
| `app/dashboard/` | Dashboard principal con **7 tabs** (Tracking, Ventas, Grupo Producto, **Clientes y Productos**, Vendedores, Perdidos, **Insights**) — Productos+Clientes fusionados en V4.0 |
| `app/admin/` | Panel admin (territorios, usuarios, audit, **configuración de sesión**) |
| `app/cargar-datos/` | Refresh APIs + editor PTTO |
| `app/api/` | API routes server-side (**35 endpoints** totales; +penetracion/-detalle del Insight; +admin/agrupadores (CRUD), /delete, /options; **+insights/crecimiento-vendedor V4.2**) |
| `app/api/insights/` | Endpoints del tab Insights (`concentracion`, `item-detail`, **`precio-dispersion`**, **`cuadrante`**, **`estacionalidad`**, **`penetracion`** (+`-detalle`), **`crecimiento-vendedor`**) |
| `app/api/dashboard/` | Endpoints del dashboard (incluye **`tracking-variedad`**, **`tracking-clientes-activos`** nuevos en V4.0) |
| `components/dashboard/` | Componentes de los 7 tabs y charts (incl. `ClientesProductosTab`, `DimensionTab` generalizado, `ProductoDesglose`) |
| `components/dashboard/insights/` | Componentes del tab Insights (ConcentracionAnalysis, **PrecioAnalysis**, **CuadranteAnalysis**, **EstacionalidadAnalysis**, **PenetracionAnalysis**, **CrecimientoVendedorAnalysis**, **ItemPicker**, ConcentracionGrid, DateRangePicker) |
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
| `supabase/migrations/` | **40 migraciones SQL aplicadas** (021-024 Insights; 025 enum audit_action; 026 Perdidos por nombre; 027 fix RLS timeout; 028 Insight Penetración; **029-037 Agrupadores**: 029 modelo, 030 RLS extendida, 031 opciones picker, 032 my_agrupadores, 033 agregaciones vista enfocada, 034 vendedor, 035 perdidos, 036 insights, 037 meta manual; **038-040 Crecimiento x Vendedor**: 038 RPC base + meta, 039 Variedad, 040 totales REALES + tickets) |
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

### D033 — 2026-06-14 | Tab Perdidos: agrupar por NOMBRE de cliente (mergear casing + cuentas Sus/Suve)

**Contexto:** En la parte inferior del tab Perdidos, el mismo cliente aparecía repetido varias filas. Diagnóstico verificado contra la DB:
- **(Capa 1) Casing inconsistente de `no_cliente`:** la vista `kpi_cliente_perdidos` agrupaba por `no_cliente` *case-sensitive*. El mismo número con distinta capitalización (`CL-001087` / `cl-001087` / `Cl-001087`) salía como clientes distintos. Esto venía del ERP/API de origen: el import (`lib/susazon-api.ts`) guardaba `no_cliente` verbatim (solo `.trim()`, sin `.toUpperCase()`). Afectaba datos VIEJOS (≤ sep-2025): 1,520 filas / ~40 clientes (0.43% de 355,030). Las variantes en minúscula no tenían venta 2026 → se contaban como PERDIDO falso.
- **(Capa 2) Cuentas Susazón + Suve del mismo cliente:** el mismo cliente físico en ambos ERPs (con `no_cliente` distinto por cada uno) salía 2 veces — legítimo en el dato, pero ruidoso para "Perdidos".

**Decisión:** Agrupar Perdidos por **NOMBRE** de cliente (regla ya usada en "Clientes Activos", bug #38), no por `no_cliente` — **sin transformar ni alterar el dato de origen**:
1. **Migración 026:** la vista `kpi_cliente_perdidos` agrupa por `(anio, cliente, vendedor, territorio)`; `no_cliente = MIN(UPPER(no_cliente))` como representativo canónico (UPPER **solo al leer**, para mostrar un número prolijo — no muta dato). Mergea casing + cuentas Sus/Suve del mismo cliente+vendedor en una sola fila.
2. **`app/dashboard/page.tsx`:** el pivot de los 3 años se keyea por `cliente|vendedor` (no por `no_cliente`, que podía variar entre años); `first_purchase` normalizado a UPPER y al más antiguo.
3. **`PerdidosTab.tsx`:** keys de React + join del Excel por `cliente|vendedor`.

**Diagnóstico verificado del casing (SQL):** 1,520 filas / 40 clientes con minúsculas, **solo entre 2024-01-05 y 2025-09-08; CERO desde oct-2025 y cero en 2026**. Cada variante minúscula (`cl-000002`) tiene gemela exacta en mayúscula (`CL-000002`) — es el **mismo ID generado por el sistema**, no captura libre. ⇒ **No es un error de captura vigente en el ERP**, sino un artefacto histórico de exportación que el origen **ya autocorrigió** hace ~9 meses.

**Gobernanza (decisión del dueño del dato, Mauricio):** no parchar downstream un problema de origen. Por eso:
- **NO se transforma `no_cliente` en el import** (se revirtió el `.toUpperCase()` que se había agregado, commit `8a0f48c`). El ERP es la fuente de verdad; se guarda tal cual. Si el ERP regresara con casing inconsistente, queda **visible** para escalarlo, no enmascarado.
- **NO se mutan las 1,520 filas históricas** (sin `UPDATE` fabricado). Quedan como foto fiel del ERP en su momento. La unificación por nombre (B) ya las junta bien en pantalla.

**Verificado (SQL post-migración):** VICTORIA HANUN SALUM pasó de ~3-5 filas (PERDIDO falsos) a **1 fila/año, activa y creciendo** ($8.25M→$8.64M→$9.05M). HECTOR MANUEL VEGA VILLANUEVA mantiene **2 filas legítimas** (2 vendedores distintos).

**Razón:** El usuario gestiona Perdidos por cliente (nombre), no por número de ERP — la unificación por nombre es regla de negocio, no parche. La inconsistencia de casing es dato histórico ya resuelto en origen; tocarla downstream ocultaría una eventual regresión del ERP.
**Estado:** Vigente. Commits `6625f20` (unificación por nombre) + `8a0f48c` (revertir transform del import) + migración 026.

---

### D034 — 2026-06-16 | Tabs vacíos: timeout RLS por función evaluada por-fila

**Contexto:** Mauricio reportó que de "Grupo Producto" a "Perdidos" (e Insights) los tabs dejaron de mostrar datos — las gráficas salían con los NOMBRES de grupos/vendedores/productos pero con venta/margen en **0**. Pidió diagnóstico a detalle ANTES de tocar nada.

**Diagnóstico (con prueba dura, sin alucinar):**
- DB, vistas, consultas y RLS: **todo sano** (jun-2026 = $73.2M). Yo consulto vía service-role (salto RLS) → por eso a mí me respondía rápido.
- `pg_stat_statements` (stats REALES de producción): `kpi_grupo_summary` media **3,423ms / máx 7,987ms**; `kpi_cliente_summary` máx 7,976ms; `kpi_sku_summary` 7,976ms; `kpi_vendedor_summary` 7,894ms; `kpi_cliente_perdidos` 7,766ms. **Todos los máximos clavados justo abajo de 8,000ms** = huella de timeout (`statement_timeout` de `authenticated` = 8s).
- Causa: la política RLS de `sales_rows` (`territorio = ANY(visible_territories_for_current_user())`) hacía que Postgres **re-evaluara la función SECURITY DEFINER por cada fila** (28,939×/consulta). Aislado: misma agregación **1,612ms por-fila vs 37ms una-vez = 43×**.
- Al hacer timeout (8s) → la app recibe null → el tab se dibuja con los nombres (de la consulta ligera al-día) pero con valores en 0. Intermitente (concurrencia/caché). **NO causado por nuestros cambios** — las vistas `_summary` nunca se tocaron; es un cuello preexistente que cruzó el umbral de 8s al crecer el dato.

**Decisión / Fix (de raíz, no parche):** Migración **027** — forzar evaluación ÚNICA de la función envolviéndola en subconsulta. Como devuelve `text[]`, el patrón es `territorio IN (SELECT unnest(func()))` (la función corre 1× en un SubPlan hasheado). Mismo trato a `current_user_is_admin()`. NO se subió el `statement_timeout` (eso sería tapar el síntoma).

**Verificado post-fix:** `kpi_grupo_summary` **1,612ms → 29ms** (56×); seguridad **intacta** (usuario con 5 territorios permitidos sigue viendo exactamente 5); datos idénticos. Es fix de DB (no requiere deploy de código; ya activo en prod).

**Razón:** El timeout era el síntoma; la evaluación por-fila era la enfermedad. Subir el timeout habría dejado el dashboard lento y frágil. El patrón `IN (SELECT unnest(...))` es la recomendación oficial de Supabase para funciones en políticas RLS.
**Estado:** Vigente. Migración 027 aplicada en prod 2026-06-16. Ver [[feedback_no_parchar_origen]] (mismo principio: arreglar la causa, no el síntoma).

---

### D035 — 2026-06-16 | Tracking Diario: desglose de clientes por día vacío en vista "Todos"/subset

**Contexto:** En Tracking Diario, al expandir un día para ver los clientes que facturaron, en vista "Todos" (o subset custom) salía "Sin clientes con facturación"; en territorio individual sí funcionaba. Mauricio pidió confirmar el diagnóstico ANTES de tocar nada.

**Diagnóstico (confirmado con código + DB, no alucinado):** `DashboardClient` pasaba a `TrackingDiarioTab` la **etiqueta de display** (`exportTerritoryLabel`: `"Todos"`, o `"Cedis A, Cedis B…"`) como prop `territorio`. El fetch de `/api/dashboard/clientes-dia` mandaba esa etiqueta y el endpoint hacía `.eq("territorio", <etiqueta>)`. Como ningún territorio se llama literalmente "Todos", devolvía **0 filas**. En individual, la etiqueta == nombre real → matcheaba. Prueba DB (día 1-jun-2026): sin filtro = 203 clientes; `.eq('Todos')` = **0**; `.eq('Cedis Cancun')` = 14.

**Decisión / Fix:** usar la **selección REAL** de territorios (ya existía como prop `variedadTerritorios`, renombrada a `territoriosEfectivos`: `null`=todos / `[]`=ninguno / `[...]`=subset). El fetch manda 1 param `territorio` por cada uno (`?territorio=A&territorio=B`); el endpoint usa `.getAll()` + `.in()`. `null`=sin filtro (RLS limita a lo visible); `[]`=corta a vacío sin consultar. **Comportamiento confirmado con Mauricio:** en subset custom muestra SOLO esos territorios (consistente con el total del día). Verificado en DB: `.in(subset 3)` = 75 clientes/$2.94M.

**Razón:** El componente usaba un valor de PRESENTACIÓN (etiqueta) como valor de CONSULTA (nombre de territorio). El fix separa ambos: `territorio` queda solo para el label de exports; `territoriosEfectivos` es el filtro real.
**Estado:** Vigente. Commit `1f28847`. Sin migración (solo código de app).

---

### D036 — 2026-06-16 | Nuevo Insight "Penetración / Canasta" (5º sub-análisis)

**Contexto:** Mauricio compartió un Excel (hoja "Hoja7"): pivote por cliente con # de SKUs distintos, venta, margen 2025 vs 2026 y sus deltas. Pidió que interpretara el documento antes de construir. Acordado: análisis bidireccional (por cliente = # SKUs; por SKU = # clientes), ventana alineada día-vs-día (como BCG), drill-down COMPLETO (sin truncar) con flag nuevo/perdido, scatter Δconteo vs Δventa, export Excel de 2 hojas (Por Cliente / Por SKU) estilo Hoja7. El valor es el **contexto/visibilidad** (cross-sell + rescate), no un KPI fijo.

**Decisión / Implementación (5 chunks, commits intermedios):**
1. **Backend** (migración **028**): `insights_penetracion` (resumen) + `insights_penetracion_detalle` (drill-down). `p_dimension` 'clientes'|'productos' alterna la dimensión agregada y la contada (`COUNT(DISTINCT ...) FILTER`). SECURITY INVOKER; rendimiento **392ms** bajo RLS (el fix 027 lo sostiene). Commit `d70ffc8`.
2. **API**: `/api/insights/penetracion` (+ `-detalle`), calcan `cuadrante/route.ts` (effectiveTo + shiftYear + territorios). Commit `30c3c87`.
3. **Frontend**: `PenetracionAnalysis.tsx` (toggle clientes/SKU + Pesos/Kilos, KPIs, scatter, tabla ordenable con drill-down lazy completo marcando nuevos/perdidos) + registro en `InsightsTab` con popover de ayuda. Commit `30c3c87`.
4. **Export**: `lib/export-excel` refactor → `exportToExcelMultiSheet`; botón en el Insight genera 2 hojas estilo Hoja7. `canExportExcel` hilado DashboardClient→InsightsTab→componente. Commit `b5aeaf6`.
5. **Docs + sync** (esta entrada).

**Verificación:** CLUB CAMPESTRE DE SAN LUIS = 14 SKUs 2026 vs 7 2025, venta $182,805 vs $52,772 → **idéntico a la Hoja7 del Excel**. Prom SKUs/cliente 6.40→5.81; 207 altas / 202 bajas. build + tsc verdes en cada chunk.

**Nota:** la ventana es YTD alineada (1-ene→hoy, mismo tramo año anterior), por eso los totales no replican el snapshot del Excel del usuario (que estaba filtrado a otra cosa); el Insight usa el dato vivo con los filtros del sidebar.
**Estado:** Vigente. Commits `d70ffc8`, `30c3c87`, `b5aeaf6` + migración 028.

---

### D037 — 2026-06-22 | Reactivación de usuarios: confirmar email al fijar password + hacer cumplir is_active

**Contexto:** Mauricio reportó que "reactivar un usuario cambiándole la contraseña no funciona bien" — el usuario no podía entrar pese a estar activo en el admin. Diagnóstico (código + DB, sin suponer): (1) los invitados por email nunca confirmaban su correo, y el reset de password no confirmaba el email → login imposible; (2) además, al investigar, `is_active` resultó **cosmético**: no se hacía cumplir en proxy/login/RLS/hooks, así que "desactivar" no bloqueaba a nadie.

**Decisión (ambas confirmadas con Mauricio):**
1. **Confirmar email al fijar password directo** (`reset-password`): `updateUserById({ password, email_confirm: true, ... })`. El admin avala el email; replica el alta por contraseña.
2. **Hacer cumplir `is_active` vía ban de auth** (`update`): desactivar → `ban_duration` ~100 años + `force_signout_user` (cierra sesiones vivas); reactivar → `ban_duration:"none"`. Se eligió el ban nativo de Supabase sobre un gate en `proxy.ts` para no pegarle a la DB en cada request.

**Razón:** El bloqueo/acceso del usuario debe ser real y a nivel auth, no un flag que nadie lee. Confirmar el email al fijar password cierra el caso de "le pongo contraseña y no entra".
**Nota / pendiente:** los usuarios YA desactivados antes de este fix **no quedaron baneados retroactivamente** (se banean la próxima vez que se les togglee). Si se quiere bloqueo inmediato de los inactivos actuales, banearlos de una vez (decisión de Mauricio).
**Estado:** Vigente. Commit `1fff49c`.

---

### D038 — 2026-06-26 | Agrupadores (territorios virtuales) — Fase 1: modelo + admin + seguridad

**Contexto:** Mauricio pidió un "agrupador" que cree un territorio virtual (unión configurable de territorio/grupo/familia/SKU/cliente) que aparezca en el sidebar como un territorio más, se administre como tal y se asigne a usuarios — para campañas por producto y para KAMs por cartera de clientes. Se hicieron 3 rondas de preguntas (AskUserQuestion) hasta cerrar requisitos.

**Requisitos LOCKED:** agrupador = nombre + lista FIJA de miembros tipados; datos = UNIÓN de miembros; lente que se traslapa (no suma a "Todos"); frontera de seguridad real (RLS); puede ser el único acceso de un KAM; cliente por nombre; meta manual opcional; sidebar en sección aparte con ícono; admin en /admin/territorios; solo admin crea/asigna.

**Decisión / Implementación (Fase 1, 6 chunks + commits):**
1. **Modelo** (migr **029**): tablas `agrupadores` + `agrupador_members` (tipo+valor) + `users_permissions.allowed_agrupadores uuid[]`. Commit `b808bda`.
2. **RLS** (migr **030**): `current_user_agrupador_scope()` / `current_user_scope_arrays()` (SECURITY DEFINER) + política de `sales_rows` extendida (territorio visible OR casa con agrupadores). Las `kpi_*` (security_invoker) propagan la RLS a TODO el dashboard. Validado: KAM ve solo su scope, 143ms barrido completo, funciones 1×/query. Commit `b808bda`.
3. **Admin API** (migr 031 + endpoints): `/api/admin/agrupadores` (GET/POST), `/delete`, `/options`; `users/update` + `invite` aceptan `allowed_agrupadores`. Commit `8b9668c`.
4. **Admin UI**: `AgrupadoresManager` en /admin/territorios (crear/editar + picker de miembros con buscador, ícono, meta). Commit `a5a406c`.
5. **Asignación**: multi-select de agrupadores en el modal de /admin/usuarios; caso KAM (solo agrupador, sin territorios). Commit `c8ab045`.
6. **Sidebar** (migr **032** `my_agrupadores`): sección "Agrupadores" (ícono+nombre) como contexto; para usuarios restringidos oculta territorios en $0 (vista limpia). Commit `48f6d82`.

**Verificación end-to-end:** agrupador real "Chef Leo" (11 clientes). Un usuario restringido solo a él ve exactamente 11 clientes / 6 territorios / $141.98M y nada más (RLS). `my_agrupadores()` lo devuelve para el sidebar. Cada chunk con build+tsc verde.

**Pendiente (Fase 2):** "vista enfocada" — que un usuario con acceso amplio (director) haga clic en un agrupador y el dashboard ENTERO se re-filtre a su scope. Requiere re-agregación por criterios no-territorio (el header y Tracking se agregan solo por territorio). Fase 3: meta manual (PTTO) + export/PDF.
**Estado:** Vigente (Fase 1 completa). Commits `b808bda`, `8b9668c`, `a5a406c`, `c8ab045`, `48f6d82` + migraciones 029-032.

---

### D039 — 2026-06-28 | Agrupadores Fase 2: vista enfocada (clic en agrupador → dashboard re-filtrado)

**Contexto:** Cerrada la Fase 1 (seguridad/KAM), Mauricio pidió la "vista enfocada": que al hacer clic en un agrupador (director/admin con acceso amplio) el dashboard ENTERO se re-filtre a ese scope. Alcance acordado (AskUserQuestion): **core primero** (header + Ventas + Grupo + Clientes/Productos + Tracking; Perdidos/Vendedores/Insights después) y **same-page** vía `?agrupador=<id>`.

**Reto:** las ~13 vistas `kpi_*` están agregadas por `territorio`; no se pueden sub-filtrar por cliente/SKU. Solución: **agrupador como "territorio sintético"** — funciones que agregan sobre la unión de miembros y devuelven `territorio = nombre del agrupador` → el render client-side se reutiliza entero.

**Implementación (3 chunks):**
1. **Backend** (migr **033**): 9 funciones `agrupador_*` (member_arrays helper SECURITY DEFINER gateado + monthly/daily/grupo/sku/cliente summary+diario, SECURITY INVOKER). Validado: Chef Leo = $142,051,042 idéntico a la consulta directa; monthly=grupo=daily. Commit `56b8e6d`.
2. **page.tsx** (chunk 2): helpers `coreSrc()`/`emptyIfAgrupador()` — cuando `?agrupador=<id>` (validado vía my_agrupadores) cargan de las funciones; **modo normal queda IDÉNTICO** (riesgo cero). uniqueNames=[nombre]. Commit `6b58cb3`.
3. **Frontend** (chunk 3): sidebar agrupadores clickeables → `?agrupador=<id>` (resalta activo) + "← Volver a Territorios"; `DashboardTabs.hiddenTabs` oculta los no-core en modo agrupador. Commit `c0e2563`.

**Decisión clave:** disciplina `agrupadorId ? <nuevo> : <original exacto>` en page.tsx → el dashboard de territorios de todos los usuarios queda intacto; el modo agrupador es opt-in por URL.
**Pendiente (Fase 2b/3):** Perdidos/Vendedores/Insights en modo agrupador; meta manual (PTTO sintético) por agrupador; export.
**Estado:** Vigente (Fase 2 core completa). Commits `56b8e6d`, `6b58cb3`, `c0e2563` + migración 033.

### D040 — 2026-07-02 | Agrupadores Fase 2b: Vendedores + Perdidos + Insights en modo agrupador

**Contexto:** Cerrada la Fase 2 core (D039), Mauricio pidió completar los tabs que quedaban fuera de la vista enfocada. Los tres se resolvieron con la MISMA arquitectura ("agrupador como territorio sintético" + disciplina `p_agrupador_id ? nuevo : original`), en 3 chunks.

**Implementación:**
1. **Vendedores** (migr **034**): `agrupador_vendedor_summary`/`_diario` — agregan sobre la unión de miembros, `territorio = nombre`, incluyen `empresa` (0=Sus/1=Suve) para el toggle Separar/Unir. Commit `9c42a46`.
2. **Perdidos** (migr **035**): `agrupador_cliente_perdidos` + `agrupador_cliente_lifecycle` — espejan `kpi_cliente_perdidos` (026) y `kpi_cliente_lifecycle` (016). Validado Chef Leo: 73 filas/17 clientes/YTD $32.4M. Commit `bed8ab1`.
3. **Insights** (migr **036**, el complejo): las **6 funciones** `insights_*` (concentracion, cuadrante, estacionalidad, penetracion, penetracion_detalle, precio_items) reciben `p_agrupador_id uuid` con un **branch CASE** en el WHERE: NULL → filtro por territorios **idéntico**; con id → unión de miembros (vía `agrupador_member_arrays`, gateado al usuario). El CASE cortocircuita → cero overhead en modo normal. Las **5 rutas RPC** pasan el param; las **2 rutas que leen `sales_rows` directo** (precio-dispersion, item-detail) usan `lib/insightsAgrupador.agrupadorOrFilter` → filtro PostgREST `.or()` por miembros. `InsightsTab` + los 5 componentes mandan `&agrupador=id` y lo suman a los deps. Commits `1308920` (SQL) + `c3ea0b1` (rutas/front).

**Decisión clave:** cada pieza mantiene el modo normal byte-idéntico (branch opt-in por `p_agrupador_id`/`?agrupador`). Validado: modo NORMAL intacto (concentración 850 cli/$743M; penetración 1059 cli/$753M) y agrupador Chef Leo **cross-consistente** (penetración = precio_items = $32.68M → sin doble conteo). `NONCORE_TABS = []` → con Fase 2b **todos** los tabs están disponibles en modo agrupador.

**Pendiente (Fase 3):** meta manual (PTTO sintético) por agrupador; export por agrupador.
**Estado:** Vigente (Fase 2b completa). Commits `9c42a46`, `bed8ab1`, `1308920`, `c3ea0b1` + migraciones 034/035/036.

### D041 — 2026-07-02 | Agrupadores Fase 3: meta manual (PTTO) + export → feature COMPLETA

**Contexto:** Última fase de Agrupadores. Dos piezas (AskUserQuestion): **meta manual** (PTTO sintético por agrupador) y **export**. Decisiones: meta = **solo venta mensual** (sin kg/margen → cero cambios de schema); export = **reutilizar** el PDF "Avance Comercial" + Excel existentes (no bespoke).

**Implementación:**
1. **Meta manual:** la captura en admin (`agrupadores.meta_mensual` + `AgrupadoresManager` + `/api/admin/agrupadores`) **ya existía desde Fase 1**. Faltaba usarla: migr **037** expone `meta_mensual` vía `my_agrupadores()`; `page.tsx` la inyecta como `ventaBudget` del territorio sintético (`budgetByTerritory[nombre] = meta_mensual`) → alimenta `ventaBudget` + `totalVentaBudget` → el cumplimiento del header sale idéntico a un territorio. Sin meta → 0 (cumplimiento oculto). `meta_mensual` es mensual = mismo grano que el PTTO del header (`territory_budgets` del mes actual).
2. **Export:** `reportInput` (PDF) tenía filtro `REPORT_TERRITORIES` (11 territorios reales) → el nombre sintético quedaba fuera → `null` = sin PDF. Se agregó una **rama modo-agrupador** que salta ese filtro y reporta el territorio sintético (`mode: single`, título = nombre del agrupador, cumplimiento vs meta). El **Excel por-tab ya servía** (no está gateado por ese filtro; construye del data ya cargado del agrupador).

**Decisión clave:** el PDF ya consumía `ventaBudget` para `ptto`/`alcancePct` → la meta fluye al PDF **gratis** por Chunk A. Reutilizar en vez de bespoke = mínimo riesgo.
**Estado:** Vigente. **Agrupadores COMPLETA (Fase 1 + 2 + 2b + 3).** Commit `19aba43` + migración 037.

### D042 — 2026-07-05 | Histograma mensual interactivo en las pastillas de Tracking Diario

**Contexto:** Mauricio pidió que las 3 pastillas (Venta/Margen/KG) de Tracking Diario abrieran un histograma mensual al pasar el cursor o dar tap. Rebotado (AskUserQuestion): forma = **ambos con toggle** (Timeline ↔ Comparativo); estilo = **barras + línea de tendencia**; detalle = **valor + Δ vs el mismo mes del año anterior**.

**Implementación:** nuevo `KpiHistogramPopover` (client) que envuelve cada `KpiCard`. Popover (hover desktop / tap touch) con `ComposedChart` (Recharts): barras por mes + línea. Toggle **Timeline** (meses seguidos 2024→actual, línea = media móvil 3m) ↔ **Comparativo** (Ene–Dic, una barra por año 2024/25/26 + línea de promedio estacional); tooltip por mes = valor + Δ YoY (en Margen, además el % de venta). **Sin backend**: reusa `activeKpi.monthly` (serie ya cargada, scoped por selección + modo agrupador); se pasa page→DashboardClient→KpiCardsRow.

**Decisión clave:** reutilizar la serie mensual ya cargada (0 llamadas extra, consistente con el número de la pastilla) en vez de un endpoint nuevo. Validado tsc + build + SSR 200 (ruta temporal, ya eliminada). Falta verificación visual autenticada (pixel).
**Estado:** Vigente. Commit `abe8071`. Incluido en el release documental **V4.1.0**.

### D043 — 2026-07-12 → 2026-07-19 | Insights: 6º sub-análisis "Crecimiento x Vendedor" (V4.2)

**Contexto:** Mauricio pidió un análisis para **evaluar el desempeño y crecimiento de cada vendedor**: una comparativa Año Anterior vs Año Actual (Mes y Acumulado) de su cartera, por cliente o por producto. Es el 6º sub-análisis del tab Insights. Se construyó en 3 entregas chunkeadas (regla de commits chunkeados).

**Entrega 1 — base (commit `7cc5122`, migr 038):**
1. **Backend:** `insights_crecimiento_vendedor(dimension, vendedor, territorios, agrupador)` devuelve venta/kg/margen de las **4 celdas** (año anterior/actual × mes/YTD), **capadas al MISMO día** (`ref` = max fecha con datos) para que la comparación sea justa. + `insights_crecimiento_meta` (fecha de corte + lista de vendedores). Branch de agrupador incluido. SECURITY INVOKER (respeta RLS).
2. **API:** `/api/insights/crecimiento-vendedor` — 1 solo fetch devuelve `data` + `meta`.
3. **Frontend:** `CrecimientoVendedorAnalysis` — 2 tablas sincronizadas (año anterior / año actual), toggles **Dimensión** (Clientes|Productos) y **Medición**, dropdown de **Vendedor**, búsqueda, Δ% Mes/Acum con color (Nuevo 🟢 / −100% 🔴, margen % en **pp**), ordenable por columna. Registrado como 6º en `SUB_ANALYSES` de `InsightsTab`.

**Validado:** COSTCO Mes 2025 $24.06M vs 2026 $20.58M (capado justo), Acum +19%; 44 vendedores; corte 2026-07-12.

**Entrega 2 — Variedad + alineación (commit `2d8abc7`, migr 039):**
1. **Medición "Variedad" (No. de SKUs):** `COUNT(DISTINCT campo espejo)` en las 4 celdas. Dimensión **Clientes** = # SKUs distintos que compró; Dimensión **Productos** = # clientes distintos que lo compraron (espejo). Hint en UI de qué cuenta según la dimensión. Validado: SABOR E HIGIENE 139 SKUs, COSTCO 1 (real: solo compra Arrachera Kirkland).
2. **Alineación de tablas:** alturas fijas por fila (título 26 · encabezado 32 · fila 34) en ambas tablas → cuadran renglón a renglón sin importar el contenido (antes había drift de ~3px por diferencia de encabezados).

**Entrega 3 — Totalizador REAL + Ticket Promedio (commit `cb1793d`, migr 040):**
1. **Totalizador (fila TOTAL fija al pie de ambas tablas)** — `insights_crecimiento_totales` agrega **sobre TODO el scope**: Σ pura para venta/kg/margen $ y `COUNT(DISTINCT)` para variedad/tickets. **NUNCA la suma de los renglones.** Margen % = **Σmargen ÷ Σventa**; Ticket Prom. = **Σventa ÷ #tickets**. Los **Δ del total se calculan de los totales** 2025 vs 2026, jamás promediando renglones.
2. **Medición "Ticket Promedio"** — ticket = **fecha + cliente** (no hay folio en `sales_rows`; junta Sus+Suve del mismo día). Dimensión Clientes → **$/ticket**; Dimensión Productos → **kg/ticket**. Conteo de tickets por fila agregado a `insights_crecimiento_vendedor`.

**Decisión clave (por qué el totalizador es una RPC aparte y no un `reduce` en el cliente):** sumar los renglones da un número **falso** en toda métrica no aditiva. Prueba dura — Variedad 2026: el total REAL es **272 SKUs** vs **6,793** si se sumaran las filas (el mismo SKU lo compran muchos clientes). Venta sí cuadra exacto ($822,001,343 = Σ filas, por ser aditiva), y Margen % pasa de 13.0% (promedio ingenuo de filas) a **15.2%** (Σmargen/Σventa, el real). Total ponderado de Ticket Promedio = $45,210. Esto es coherente con la regla de gobernanza del proyecto: la métrica se define por regla de negocio, no por conveniencia del render.

**Estado:** Vigente. **Insights = 6 sub-análisis.** Migraciones 038-040. Commits `7cc5122` + `2d8abc7` + `cb1793d`. tsc + build OK en cada entrega. Release **V4.2.0**.

### D044 — 2026-07-30 → 2026-09-03 | V4.3: profundización de Clientes y Productos + comparativos año-vs-año + cruce en Concentración (Fase 17)

**Contexto:** tras cerrar V4.2, Mauricio pidió una serie de mejoras iterativas —cada una rebotada primero (`AskUserQuestion`), construida, verificada y desplegada por separado (regla de commits chunkeados)— centradas en analizar la cartera a mayor profundidad y comparar contra el año anterior "al día". 14 commits, migraciones 041-045. La sesión de trabajo se reanudó dos veces por compactación de contexto (micro-cortes de Starlink); el trabajo no se perdió.

**Entrega 1 — Tracking Diario "Comparar vs año anterior (al día)" (`5057048`) + KPI "Prom. Venta Diario" (`d292431`):**
1. Toggle on-demand (off por defecto, localStorage) que transforma el tab en 2026 vs 2025 respetando scope y Pesos/Kilos. Gráfica: barras diarias 2025 agrupadas con 2026 + acumulados; tabla pareada por día (Venta día/acum, Margen $, Margen %) con Δ% + TOTAL al día; **expandible por día** → clientes 2026 vs 2025 (mismo día del mes) cruzados por NOMBRE, etiqueta Nuevo/Perdido. **Cero queries nuevas** (2 fetches a `clientes-dia` + merge). Componente `TrackingCompareYoY`.
2. 4º KPI grande "Prom. Diario" = venta al día ÷ días hábiles transcurridos (L-S menos LFT); delta vs AA **al día** (mismo tramo — difiere del delta de Venta, que va vs cierre); VS PTTO = objetivo diario (PTTO ÷ días hábiles totales); histograma desplegable mes a mes. **ACUM 2024/25/26** consolidada en UNA pastilla vertical a mitad de ancho; los 4 KPIs crecen (grid 9 col: 4×2+1). `KpiData` gana `ventaAlDia/prevYearVentaAlDia/elapsedBizDays/totalBizDays`.

**Entrega 2 — Gráfica "Meses (3 años)" (`dd4f11b` + `23ae3f4`):** el toggle "Mismo mes (3 años)" pasa de "1 mes × 3 años" a "**12 meses × 3 años**": barras agrupadas 2024/2025/2026 por mes + 3 líneas de Margen %. Multi-SKU agrega en una serie por año. Reusa `/clientes-evolution` con 3 llamadas lazy (sin endpoint nuevo). Leyenda (`ChartLegend` por secciones) y tooltip **homologados al tab Ventas**. Nuevo `ClientesTresAniosChart`.

**Entrega 3 — Fix Ptto Linear (`800113a`, bug 51):** ver Bugs Resueltos.

**Entrega 4 — Expand mensual bidireccional "campo minado" (`05ee073` + `b99fcb6`, migr 041):** en "Meses {año}" cada fila se expande: SKU → clientes por mes / cliente → SKUs por mes; meses sin compra en rojo tenue + "sin comprar desde MMM". **No existía una vista cliente×SKU×mes** (las `kpi_*` son por una sola dimensión) → función `insights_cliente_sku_mensual` que agrega de `sales_rows` (SECURITY INVOKER → RLS). Endpoint `cliente-sku-mensual` con la **misma forma** que `clientes-evolution` para reusar el render.

**Entrega 5 — Sort por columna + fix dropdown congelado (`588e5a9`, bug 52):** clic en header ordena en las 3 vistas (Meses por mes/Total YTD incl. sub-filas; Año vs Año por todas sus columnas; Prom 90d por ritmos y Δ); se resetea al cambiar vista/dimensión. Fix: ver Bugs Resueltos.

**Entrega 6 — Insights·Concentración cruza dimensiones (`f4faba8`, migr 042):** fila "Filtrar por" (Producto/Cliente/Grupo/Familia + items) acota el universo del Pareto; + dimensión **Familias**. **Decisión clave:** función **nueva** `insights_concentracion_cruzada` (replica territorios + rama de agrupador + filtros opcionales) en vez de modificar `insights_concentracion` — que tiene 2 overloads (3-arg y 5-arg con agrupador) — para **no romper el módulo Agrupadores**.

**Entrega 7 — Buscador con universo de AÑO COMPLETO (`608a20f`, migr 043, bug 53):** ver Bugs Resueltos. `dim_universe_year` consulta `sales_rows` directo (no las vistas por mes) para devolver nombres distintos del año **sin el tope de 1000 filas** de PostgREST; `DimensionTab.fullYearSearchContext` hace fetch lazy por territorio y **une** mes + año sin quitar ningún item; los seleccionados sin venta en el mes se sintetizan como **fila-cero** para fluir a las vistas.

**Entrega 8 — Territorio(s) en el expand cuando el scope es "Todos" (`f7a3f7c`, migr 044):** cada sub-fila muestra el/los territorio(s) donde vendió (con +N y tooltip) **en lugar** del "sin comprar desde"; con un solo territorio se conserva el churn (Mauricio eligió "reemplaza" entre 3 opciones). Cambio de firma → **DROP+CREATE** de `insights_cliente_sku_mensual` agregando `territorios[]` (`array_agg DISTINCT` por name×mes; el endpoint los une entre meses).

**Entrega 9 — Desglose "Año vs Año" con 3 años, ambos lados (`d8c9e2a` + `0b970ca`):** al expandir producto → clientes y cliente → SKUs, cada sub-fila replica **todas** las columnas del header (Mauricio eligió "todas" y "aplanar grupo" para el lado cliente). Hallazgo: `clientes-por-producto` **ya devolvía** los 3 años al-día — solo faltaba renderizarlos. Se extrajo `DesgloseYoYTable` (presentacional compartido) para no duplicar; `ProductoDesglose`/`ClienteDesglose` quedan como wrappers; `cliente-desglose` reescrito "por SKU, 3 años al-día" (espejo del anterior; único consumidor verificado).

**Entrega 10 — Vista "Meses Hist." (`a4f136d`, migr 045):** diseño rebotado (3 layouts + métrica de celda) → Mauricio eligió **expandible** (fila = total 3 años/mes; expand = sub-filas por año × 12 meses) y **celda según Pesos/Kilos**. `dim_mensual_multianio` + endpoint + `MesesHistTable` con heatmap; 4º `tableView` `"meses-hist"` en `DimensionTab`. Datos confirmados: 2024 y 2025 completos, 2026 Ene–Sep.

**Decisión — Sincronización automática PARQUEADA:** se diseñó y construyó (endpoint con `CRON_SECRET`, reintento, `app_settings.sync_schedule`, UI Manual/Automático + hora, banner de fallo, migración pg_cron cada 15 min con dedupe y secreto en Vault). Al explicar que el modo a hora fija exige un secreto manual (Vercel + Vault), Mauricio decidió **dejarlo manual por ahora**. Se revirtió todo (working tree limpio, producción intacta); el SQL quedó parqueado en `docs/parked/idea1-sync-auto/043_sync_auto_cron.sql.parked` (fuera de `supabase/migrations/`). Alternativa sin secreto documentada (auto-al-abrir).

**Estado:** Vigente. Migraciones 041-045 (total **45**). Release **V4.3.0**. tsc + build prod OK en cada entrega; verificación visual en producción por Mauricio (el Browser pane no tiene su sesión y no se capturan credenciales).

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
| 44 | 2026-06-08 | Tab AuditLog "te sacaba de la página por error" (días sin funcionar) + escrituras de sesión/usuario fallaban con 500 | (1) `AuditClient.ACTION_CONFIG` no mapeaba `settings_toggle` (que SÍ está en el enum y en la tabla) → `config` undefined → `config.icon` reventaba el render de React (crash → "te saca"). (2) El enum `audit_action` no tenía 6 valores que el código inserta (`force_signout`, `force_signout_all`, `invite`, `reset`, `session_timeout_changed`, `session_timeout_exemption_changed`) → "invalid input value for enum audit_action" en cada uno (visto en logs de Postgres). La "migración 014_audit_actions_session" que el INSTRUCTIVO decía existir nunca se creó; solo 015 agregó `settings_toggle`. Detonante: el usuario activó el timeout de sesión y togglear ajustes generó filas que crasheaban la lectura. | Migración **025** (`ADD VALUE IF NOT EXISTS` ×6, aplicada) + completar `ACTION_CONFIG`/`ACTION_ORDER`/`VALID_ACTIONS` + **fallback defensivo** en el render (acción no mapeada muestra el string crudo, no crashea). | `0b44448` + migración 025 |
| 47 | 2026-06-16 | Tracking Diario: el desglose de clientes por día salía "Sin clientes con facturación" en vista "Todos" / subset (en territorio individual sí funcionaba) | `DashboardClient` pasaba la **etiqueta de display** (`exportTerritoryLabel`: `"Todos"` o `"Cedis A, Cedis B…"`) como prop `territorio`; el endpoint `clientes-dia` hacía `.eq("territorio", <etiqueta>)` → ningún territorio se llama "Todos" → 0 filas. En individual la etiqueta == nombre real → sí matcheaba. Prueba DB: día 1-jun sin filtro=203 clientes, `.eq('Todos')`=0. | Usar la selección REAL (`territoriosEfectivos`: null/[]/[...]) en vez de la etiqueta. Fetch manda 1 `territorio` por cada uno; endpoint `.getAll()` + `.in()`. null=sin filtro (RLS), []=vacío sin consultar. Subset custom muestra solo esos territorios. Verificado: `.in(3)`=75 clientes. | `1f28847` |
| 48 | 2026-06-22 | Reactivar usuario cambiándole la contraseña: el usuario no podía entrar ("le dice que su usuario no existe") pese a estar dado de alta y activo en el admin | Usuarios invitados por **email** nunca confirmaban el correo (`email_confirmed_at = NULL`). El reset de contraseña hacía `updateUserById({password})` **sin** `email_confirm` → Supabase rechaza el login de un email sin confirmar ("Invalid login credentials / Email not confirmed"). Verificado en DB: todos los desactivados/nunca-logueados tenían el email sin confirmar. | `reset-password`: agregar `email_confirm: true` al `updateUserById` (el admin avala el email al fijar la contraseña; igual que el alta por contraseña en invite). | `1fff49c` |
| 49 | 2026-06-22 | "Desactivar" usuario no bloqueaba el acceso (era cosmético) — un desactivado podía seguir iniciando sesión | `is_active` no se hacía cumplir en ningún lado: ni `proxy.ts`, ni login, ni RLS, ni función/hook de la DB. El handler de desactivar ni siquiera cerraba la sesión. El mensaje "no podrá iniciar sesión" era falso. | `update`: al desactivar → **banear** en auth (`ban_duration` ~100 años) + `force_signout_user`; al reactivar → des-banear (`ban_duration:"none"`). Ahora `is_active` se hace cumplir de verdad. | `1fff49c` |
| 46 | 2026-06-16 | Tabs Grupo/Vendedores/Productos/Perdidos/Insights vacíos: gráficas con nombres pero venta/margen en 0 (intermitente) | La política RLS de `sales_rows` (`territorio = ANY(visible_territories_for_current_user())`) evaluaba la función SECURITY DEFINER **por fila** (28,939×/consulta). Las vistas `_summary` y `kpi_cliente_perdidos` promediaban 2.7–3.4s con picos de 7.9s → cruzaban el `statement_timeout` de `authenticated` (8s) → la app recibía null → tabs en 0. Confirmado con `pg_stat_statements` (máximos clavados en ~7.9s). Preexistente, agravado por crecimiento de datos; NO por cambios de código. | Migración **027**: envolver la función en subconsulta `territorio IN (SELECT unnest(func()))` → evaluación única (1× vs 28,939×). Verificado: 1,612ms → 29ms (56×); seguridad intacta; datos idénticos. No se subió el timeout (sería parche). | migración 027 |
| 45 | 2026-06-14 | Tab Perdidos: el mismo cliente aparecía repetido en varias filas | La vista `kpi_cliente_perdidos` agrupaba por `no_cliente` *case-sensitive*: (1) mismo ID con distinto casing (`CL-`/`cl-`/`Cl-`, **artefacto histórico** del export del ERP — 1,520 filas / 40 clientes, solo 2024-01→2025-09, 0 desde oct-2025) salía como clientes distintos → variante minúscula sin venta 2026 = PERDIDO falso; (2) mismo cliente en cuentas Sus + Suve (`no_cliente` distinto) salía 2 veces. | Migración **026**: la vista agrupa por NOMBRE `(anio, cliente, vendedor, territorio)` con `no_cliente = MIN(UPPER(...))` (UPPER solo al leer). Pivot de `page.tsx` + keys de `PerdidosTab` por `cliente\|vendedor`. **Decisión de gobernanza:** NO se transforma el dato de origen (se revirtió el `.toUpperCase()` del import, `8a0f48c`) ni se mutan las filas históricas; la unificación por nombre resuelve el síntoma. Verificado: VICTORIA HANUN SALUM → 1 fila/año activa; HECTOR VEGA → 2 filas legítimas (2 vendedores). | `6625f20` + `8a0f48c` + migr. 026 |
| 50 | 2026-07-07 | Histograma de las pastillas (Tracking) en modo **Timeline**: el hover mostraba el mes equivocado — quedaba pegado en inicio-2024 ("solo se veían los extremos, no el medio") | El eje X usaba `dataKey='label'` (nombre del mes), que **se repite entre años** (Feb/Mar/… existen en 2024, 2025 y 2026). Recharts **colapsa las categorías duplicadas** de un eje categórico → las 31 barras se mapeaban sobre ~14 posiciones; solo Ene'24/Ene'26 eran únicos. | Eje X con clave **ÚNICA** por punto (`xkey = 'AAAA-MM'`) + `tickFormatter` que la vuelve a mostrar como nombre de mes. El modo Comparativo no se afecta (Ene–Dic ya eran únicos). Verificado con hover real (CDP): x=12%→Abr2024, x=50%→Abr2025, x=88%→Mar2026 (antes las tres caían en 2024). | `52c141b` |
| 51 | 2026-08-20 | Tracking Diario: la línea de **Ptto Linear** no llegaba al 100% del presupuesto — se quedaba en 25/26 ($57.98M de $60.30M) | El eje X del chart se armaba solo con los días **con dato**, así que se cortaba en el último día con venta (Ago: día 30, domingo) y la línea nunca alcanzaba el último día hábil (31). | Extender el eje a **TODOS los días hábiles del mes** (`listBizDays`) aunque aún no haya venta → el día 31 sí se dibuja y Ptto Linear cierra en su total. Cálculos intactos; solo cambia el rango del eje X. Bonus: se ve la "pista" de días hábiles restantes. | `800113a` |
| 52 | 2026-08-22 | Clientes y Productos: al abrir el dropdown del expand mensual y **cambiar de territorio** (usuario multi-territorio), la parte de abajo se "congelaba" con el detalle del territorio anterior mientras el header ya cambiaba | El cache del expand (`subData`) se llaveaba **solo por nombre** de la entidad, no por scope → al cambiar territorio servía el detalle cacheado del territorio previo. | Cache llaveado por scope `${año}|${dimensión}|${territorios}::${nombre}` → nunca sirve otro territorio; además un `useEffect` **cierra los expandidos** al cambiar de scope. Volver a un territorio da cache-hit. | `588e5a9` |
| 53 | 2026-09-03 | Clientes y Productos: al buscar un SKU en **Productos** decía "Sin resultados", pero el mismo SKU **sí aparecía** al expandir un cliente en "Meses 2026" (TOP SIRLOIN SELECT AA: Ago 731, Sep 0) | El universo del buscador salía de `kpi_sku_summary` filtrado por `.eq("mes", currentMonth)` para los 3 años → solo items con venta en el mes seleccionado (en algún año). Un SKU que nunca vendió en Septiembre quedaba fuera; OKASH sí salía (con Sep = —) porque vendió en Sep de un año previo. El expand por cliente usa año completo, por eso sí lo mostraba. | Migración **043** `dim_universe_year` (nombres distintos con venta en cualquier mes del año, scoping territorio/agrupador/RLS, consulta `sales_rows` directo para evitar el tope de 1000 filas) + endpoint `dim-universe` + `fullYearSearchContext` en `DimensionTab`: el buscador **une** mes + año sin quitar ninguno; un item seleccionado sin venta en el mes se sintetiza como **fila-cero** (0 en Año vs Año/gráfica — correcto — y desglose real en Meses). Verificado: 289 SKUs / 1,100 clientes en 2026, encuentra el SKU. Mauricio eligió "todo el año, Productos y Clientes". | `608a20f` |

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

### Completados en V4.1 — fases 14-15 (2026-06-14 a 2026-07-07) · Penetración + Agrupadores + histograma

- [x] **5º Insight "Penetración / Canasta"** (D036): amplitud de canasta (cliente → # SKUs; SKU → # clientes) vs año anterior. Migración **028**, endpoints `penetracion` + `penetracion-detalle`, `PenetracionAnalysis`.
- [x] **Módulo Agrupadores — territorios virtuales, Fase 1→3** (D038-D041): modelo + admin + **frontera de seguridad real por RLS** (un KAM ve SOLO su agrupador); **vista enfocada** en los 7 tabs (agrupador como "territorio sintético"); **meta manual (PTTO)** + export PDF/Excel. Migraciones **029-037**. Feature COMPLETA.
- [x] **Histograma mensual interactivo** en las 3 pastillas de Tracking (Venta/Margen/KG) (D042): toggle Timeline ↔ Comparativo, barras + línea de tendencia, Δ YoY. Sin backend (reusa `activeKpi.monthly`).
- [x] **Fixes:** Perdidos agrupa por nombre (bug 45); timeout RLS por evaluación por-fila (bug 46, migr 027); desglose de clientes por día en vista "Todos" (bug 47); reactivación de usuarios + `is_active` se hace cumplir de verdad (bugs 48-49).
- [x] **Docs V4.1** (commits `7b4a973`, `170a3a4`, `34cfa8a`): LO_NUEVO, CONTINUACION, INSTRUCTIVO_AGENTE v4.1, GUIA_SECRETS, .docx a v4.1.0, PDF visual regenerado con `chrome-headless-shell`.
- [x] **Fix histograma Timeline** (bug 50): eje X con clave única `AAAA-MM` → el hover ya cae en el mes correcto.

### Completados en V4.2 — fase 16 (2026-07-12 a 2026-07-19) · Insights: Crecimiento x Vendedor

- [x] **6º sub-análisis "Crecimiento x Vendedor"** (D043): comparativa Año Anterior vs Año Actual (Mes + Acumulado) por cliente o producto, filtrable por vendedor, **capada al mismo día** para comparación justa. Migración **038**, endpoint `crecimiento-vendedor`, `CrecimientoVendedorAnalysis`. Commit `7cc5122`.
- [x] **Medición "Variedad" (No. de SKUs)** + alineación exacta de las 2 tablas. Migración **039**. Commit `2d8abc7`.
- [x] **Totalizador REAL** (fila TOTAL fija al pie de ambas tablas): Σ pura en aditivas, `COUNT(DISTINCT)` en variedad/tickets, Margen % = Σmargen÷Σventa, Δ calculado de los totales — **nunca** promediando renglones. Migración **040**. Commit `cb1793d`.
- [x] **Medición "Ticket Promedio"**: ticket = fecha + cliente (junta Sus+Suve); Clientes → $/ticket, Productos → kg/ticket. Commit `cb1793d`.

### Completados en V4.3 — fase 17 (2026-07-30 a 2026-09-03) · Clientes y Productos a profundidad + comparativos año-vs-año

- [x] **Tracking Diario "Comparar vs año anterior (al día)"** (D044-1): toggle on-demand, barras 2025 + 2026, tabla pareada con Δ% + TOTAL, expandible por día → clientes Nuevo/Perdido. `TrackingCompareYoY`. Commit `5057048`.
- [x] **4º KPI "Prom. Venta Diario"** + ACUM 2024/25/26 consolidada en una pastilla (D044-1). Commit `d292431`.
- [x] **Gráfica "Meses (3 años)"** (12 meses × 3 años + 3 líneas de margen %), leyenda/tooltip homologados a Ventas (D044-2). `ClientesTresAniosChart`. Commits `dd4f11b` + `23ae3f4`.
- [x] **Fix Ptto Linear** cierra en su total en el último día hábil (bug 51). Commit `800113a`.
- [x] **Expand mensual bidireccional "campo minado"** en "Meses {año}" (D044-4). Migración **041** `insights_cliente_sku_mensual` + endpoint `cliente-sku-mensual`. Commits `05ee073` + `b99fcb6`.
- [x] **Orden por columna** en las 3 vistas + **fix dropdown congelado** al cambiar territorio (bug 52). Commit `588e5a9`.
- [x] **Insights·Concentración cruza dimensiones** ("Filtrar por" + Familias) (D044-6). Migración **042** `insights_concentracion_cruzada` (nombre nuevo, no toca Agrupadores). Commit `f4faba8`.
- [x] **Buscador con universo de AÑO COMPLETO** (bug 53). Migración **043** `dim_universe_year` + endpoint `dim-universe`. Commit `608a20f`.
- [x] **Territorio(s) en el expand mensual** cuando el scope es "Todos" (D044-8). Migración **044** (`territorios[]`). Commit `f7a3f7c`.
- [x] **Desglose "Año vs Año" con 3 años** al expandir producto → clientes y cliente → SKUs (D044-9). `DesgloseYoYTable` compartido; `cliente-desglose` reescrito. Commits `d8c9e2a` + `0b970ca`.
- [x] **Vista "Meses Hist."** — matriz Años×Meses expandible con heatmap (D044-10). Migración **045** `dim_mensual_multianio` + `MesesHistTable`. Commit `a4f136d`.
- [x] **Docs V4.3**: LO_NUEVO, CONTINUACION, INSTRUCTIVO_AGENTE fase_17, SESSION_LOG (D044 + bugs 51-53), índice maestro, AGENTS.md, .docx a v4.3.0 (`gen_docs.py`), instructivo visual HTML/PDF, sync a Plan Z.
- [~] **Sincronización automática de datos** — diseñada y construida (pg_cron+Vault / auto-al-abrir), **parqueada** a petición de Mauricio; refresh sigue manual. Artefacto en `docs/parked/idea1-sync-auto/`.

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
