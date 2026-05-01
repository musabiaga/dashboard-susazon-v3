# Session Log — Dashboard Comercial Susazón V3.0

## Metadata

- **Proyecto:** Dashboard Comercial Susazón V3.0 (Profesional)
- **Empresa/Usuario:** Grupo Susazón (Susazón + Suve) — Mauricio Usabiaga, Director de Operaciones
- **Inicio:** 2026-04-26
- **Cierre fase 1:** 2026-04-28 (deploy a producción)
- **Cierre fase 2:** 2026-04-30 (custom domain + UI polish + feature toggle Pesos/KG)
- **Versión actual:** 1.2.0 (en producción)
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)
- **URL prod canonical:** `https://www.dashboardcomercialsusazon.com`
- **URL prod fallback:** `https://dashboard-susazon-v3-44sp.vercel.app`
- **Última actualización:** 2026-04-30

---

## Arquitectura Actual

### Archivos del sistema

| Carpeta / Archivo | Propósito |
|---|---|
| `app/` | App Router Next.js 16 (rutas, layouts, server components) |
| `app/dashboard/` | Dashboard principal con 7 tabs |
| `app/admin/` | Panel admin (territorios, usuarios, audit) |
| `app/cargar-datos/` | Refresh APIs + editor PTTO |
| `app/api/` | API routes server-side (proxy seguro a Susazón/Suve) |
| `components/dashboard/` | Componentes de los 7 tabs y charts |
| `components/theme/` | 6 themes + selector modal |
| `components/layout/` | Header, layout shells |
| `lib/supabase/` | Clientes Supabase (browser, server, admin) |
| `lib/susazon-api.ts` | Wrapper server-side de APIs Susazón/Suve |
| `lib/format.ts` | Formatters (money, kilos, dates) — portado del V2.2 |
| `lib/business-days.ts` | Cálculo de días hábiles L-S menos LFT — portado V2.2 |
| `lib/admin-guards.ts` | Guards de rol admin para API routes |
| `supabase/migrations/` | 10 migraciones SQL aplicadas |
| `docs/` | Esta documentación |
| `proxy.ts` | Middleware de Next.js 16 (renombrado de middleware.ts) |
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
