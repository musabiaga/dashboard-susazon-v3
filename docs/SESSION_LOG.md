# Session Log — Dashboard Comercial Susazón V3.0

## Metadata

- **Proyecto:** Dashboard Comercial Susazón V3.0 (Profesional)
- **Empresa/Usuario:** Grupo Susazón (Susazón + Suve) — Mauricio Usabiaga, Director de Operaciones
- **Inicio:** 2026-04-26
- **Cierre fase 1:** 2026-04-28 (deploy a producción)
- **Versión actual:** 1.0.0 (en producción)
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)
- **URL prod:** `dashboard-susazon-v3-44sp-hw6gg0rwb-musabiagas-projects.vercel.app`

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

---

## Próximos Pasos / Backlog

### Inmediato (Mauricio)

- [ ] **Revocar GitHub PAT** (`github_pat_11CCZMILA0...`) en [github.com/settings/tokens](https://github.com/settings/tokens) — ya no se necesita, Vercel se conecta vía OAuth.
- [ ] **Invitar los 14 usuarios prod restantes** desde `/admin/usuarios` cuando tengas la lista (email + nombre + rol + territorios).
- [ ] **Mover `~/Downloads/SECRETS_DASHBOARD_V3.txt`** a Apple Notes (privado, encriptado).

### Mejoras opcionales (sin prisa)

- [ ] **Custom domain** `dashboard.susazon.mx` desde el panel DNS de Susazón → Vercel (5 min).
- [ ] **Themes bonus:** Linear Eclipse + Bento Spatial (si querés más opciones visuales — propuestos pero no implementados).
- [ ] **Upgrade a Vercel Pro** ($20/mes) si necesitás refresh de rangos largos (>5 meses con ambas APIs).
- [ ] **Sentry o Logging tool** para monitoreo de errores en runtime.
- [ ] **CI/CD con GitHub Actions** — tests + lint en cada PR.
- [ ] **Documentar el flujo de PTTO** para futuras cargas anuales.

### Aprendizajes para próximos proyectos

- [ ] Correr `npm run build` LOCAL antes del primer push a Vercel (cacha errores TS strict).
- [ ] Probar en mínimo 2 browsers antes de cerrar features con efectos avanzados (CSS modern).
- [ ] Setup de staging environment (Vercel branch `develop`) para próxima iteración mayor.

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
