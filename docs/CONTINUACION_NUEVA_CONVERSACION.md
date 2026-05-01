# Continuación en Nueva Conversación — Dashboard Comercial Susazón V3.0

> **Para Claude / Agente AI que está retomando el proyecto.**
> Lee este archivo primero (toma 5 min), luego pasa a los recursos específicos según lo que vayas a hacer.

---

## 🎯 Contexto en 30 segundos

**Proyecto:** Dashboard comercial mensual de Grupo Susazón (Susazón + Suve), una empresa mexicana de carnes/embutidos con ~17 territorios (CEDIS) en México.

**Owner:** Mauricio Usabiaga, Director de Operaciones. Habla español mexicano. **Regla de oro: NUNCA alucinar — preguntar antes de implementar.**

**Stack:** Next.js 16 + Supabase Postgres + Vercel. Frontend React 19, Tailwind 4 CSS-first, Recharts 3.x.

**Estado:** EN PRODUCCIÓN versión 1.3.0 (deploy 2026-04-28, fase 3 cerrada 2026-05-01).

**URL canonical:** `https://www.dashboardcomercialsusazon.com`

**Predecesor:** V2.2 (single-page HTML 3,321 líneas, vivo en `https://dashboard-comercial-susazon.netlify.app/`) — NO tocar, sigue como referencia.

---

## 📚 Cómo orientarte (leer en este orden)

| Paso | Archivo | Para qué |
|------|---------|----------|
| 1 | `AGENTS.md` (raíz del repo) | Auto-cargado al `cd`. Stack, gotchas críticos, reglas absolutas. **21 gotchas** ya documentados. |
| 2 | Este archivo (`CONTINUACION_NUEVA_CONVERSACION.md`) | Estás aquí. Contexto compacto. |
| 3 | `docs/SESSION_LOG.md` | **Todas** las decisiones (D001-D018) + bugs resueltos (1-21) con fix y commit. Lee si vas a tocar algo relacionado. |
| 4 | `docs/INSTRUCTIVO_AGENTE.xml` | Inventario estructurado de archivos, contratos APIs, configuración. Lee si vas a hacer cambios estructurales. |
| 5 | `docs/01_Arquitectura_Tecnica.docx` | Diseño del sistema y por qué decisiones arquitectónicas. |
| 6 | `~/Downloads/SECRETS_DASHBOARD_V3.txt` | Tokens, API keys, credenciales (privado, no en repo). |

**Memoria persistente del usuario** (auto-cargada): `~/.claude/projects/-Users-mauusabiaga-Desktop-Claude-Code-PROJECTS-/memory/MEMORY.md` y archivos relacionados.

---

## 🏗️ Arquitectura ultra-resumida

```
                           ┌─────────────────────────┐
   Browser ─── HTTPS ───►  │ Vercel Edge / Serverless│
   (autenticado)            │ Next.js 16 App Router  │
                            └────────────┬────────────┘
                                         │
                  ┌──────────────────────┼──────────────────────┐
                  │                      │                      │
            Server Components       Route Handlers         Edge Middleware
            (queries Supabase)      (proxy API + auth)     (proxy.ts)
                  │                      │                      │
                  └──────────┬───────────┴──────────────────────┘
                             │
                     ┌───────▼────────┐
                     │   Supabase     │
                     │  Postgres+RLS  │
                     │  Auth + SMTP   │
                     │     (Pro)      │
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │ APIs Susazón   │  (proxy server-side, key oculta)
                     │  + Suve        │
                     │ (datos comerciales)
                     └────────────────┘
```

**Flujo de datos:**
1. Usuario logueado en `dashboard-susazon-v3-44sp.vercel.app` (o el dominio www.)
2. `app/dashboard/page.tsx` (Server Component) hace queries a Supabase con SSR client → RLS filtra por `users_permissions.allowed_territories`
3. Renderiza `DashboardClient` (Client Component) con la data ya filtrada
4. Para refresh de datos: `/api/data/refresh` (Route Handler, gated admin/director) llama a APIs de Susazón con `SUSAZON_API_KEY` (server-only env var) y hace UPSERT idempotente en `sales_rows`

---

## 🗂️ Carpetas críticas

```
DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]/
├── AGENTS.md              ← Lee primero (auto-cargado)
├── proxy.ts               ← Middleware Next.js 16 (rename de middleware.ts)
├── app/
│   ├── layout.tsx
│   ├── globals.css        ← 6 themes + Tailwind 4 @theme
│   ├── login/             ← Auth
│   ├── set-password/      ← Flow invite + reset password
│   ├── dashboard/         ← 7 tabs principal
│   ├── cargar-datos/      ← Loader + editor PTTO (admin/director)
│   ├── admin/             ← Panel admin (territorios, usuarios, audit)
│   └── api/               ← Route handlers (auth callback, data refresh, admin)
├── components/
│   ├── dashboard/         ← Componentes de los 7 tabs
│   ├── theme/             ← ThemeProvider + 6 themes
│   └── layout/            ← Header, etc.
├── lib/
│   ├── supabase/          ← Clients (browser, server, admin)
│   ├── susazon-api.ts     ← Wrapper API Susazón/Suve (server-only)
│   ├── business-days.ts   ← Días hábiles + getMexicoCityDateParts() ⚠️ TZ helper
│   └── format.ts          ← formatMoney, formatKilos
├── supabase/migrations/   ← 10 migraciones SQL
├── scripts/gen_docs.py    ← Regenera los 6 .docx
└── docs/                  ← Esta carpeta + .docx
```

---

## 🔑 Configuración clave (no secrets)

- **Supabase project:** `qfxyrpifntcixwpvnjpd` (East US, plan Pro)
- **Vercel project:** `dashboard-susazon-v3-44sp` (sufijo auto-generado)
- **SMTP:** Resend (free tier 3,000/mes) — configurado en Supabase Dashboard → Auth → SMTP Settings
- **Custom domain:** `dashboardcomercialsusazon.com` en GoDaddy (auto-renueva 2029-04-29)
- **17 territorios:** 16 activos + 1 apagado por admin (`Venta Detalle`)
- **Admin único en prod:** `musabiagaz@susazon.com.mx` (UID `c787cd72-200a-469e-84a1-c0d3253b0b20`). 14 usuarios pendientes de invitar.

---

## 🚨 Gotchas que TIENES que conocer (top 10)

1. **`new Date()` en server-side da hora UTC, NO CDMX.** Usa `getMexicoCityDateParts()` de `lib/business-days.ts` para "hoy" en CDMX. Ya aplicado en 3 archivos.

2. **Server Components NO pueden mutar cookies.** Para flows de auth (`exchangeCodeForSession`, `verifyOtp`), usar Route Handlers, NO Server Components. Si lo haces en Server Component, el server ve la sesión pero el browser no recibe las cookies → "Auth session missing!".

3. **Public routes en `proxy.ts`:** `/login`, `/set-password`, `/api/auth/*`. Si agregas una página pública (sin requerir auth), actualiza `isPublicRoute`.

4. **Email rate limit de Supabase:** el servicio default tiene rate limit (3-4/hora) en TODOS los planes (incluso Pro). Custom SMTP con Resend ya configurado.

5. **Vercel Hobby maxDuration ≤ 300s.** El refresh de APIs tiene `export const maxDuration = 300`. Suve API es lenta (~60s/mes) → max ~5 meses con ambas APIs por refresh.

6. **Supabase max-rows = 50,000** (bumpeado desde 1,000 default). NO usar `distinct` sobre `sales_rows`; usar `territories_state` (auto-poblado por trigger) o vistas KPI.

7. **dotenv-expand interpola `$VAR`.** `API-DASH-CLAUDE-2026-$$1` debe ir como `API-DASH-CLAUDE-2026-\$\$1` en `.env.local`. En Vercel UI va literal.

8. **Días hábiles = L-S** (no L-V). Solo Domingo + feriados LFT. Tabla en `lib/business-days.ts`.

9. **Recharts 3.x:** tipos `readonly`. Si tocas tooltips, payload va con `readonly TooltipItem[]`.

10. **Safari + backdrop-filter:** requiere `isolation: isolate` + `transform: translateZ(0)`. Ya aplicado en theme `liquid-glass`.
11. **Run-Rate = HÁBILES siempre** (desde D017, 2026-05-01). Todos los Run-Rates del dashboard usan días hábiles L-S menos LFT, NO calendario. Si ves cálculos divergentes, verificar que estés usando `elapsedBizDays`/`totalBizDays`.
12. **Selector de mes/año** (desde D018, 2026-05-01). El dashboard puede mostrar meses pasados via `?year=Y&month=M`. Server-side validation en `app/dashboard/page.tsx`. Cuando es histórico, `daysCurrent = daysTotal` (mes cerrado). PTTOs solo cargados para 2026 → meses anteriores no tienen "Alcance Ptto".

**Lista completa: `AGENTS.md` sección "Gotchas críticos" (23 gotchas).**

---

## 📊 Estado del backlog (al 2026-05-01)

### Pendientes inmediatos (Mauricio, no Claude)

- [ ] Revocar GitHub PAT viejo (`github_pat_11CCZMIL...`) en github.com/settings/tokens
- [ ] Invitar los 14 usuarios prod restantes desde `/admin/usuarios`
- [ ] Mover `~/Downloads/SECRETS_DASHBOARD_V3.txt` a Apple Notes

### Mejoras opcionales (sin prisa)

- [ ] Themes bonus: Linear Eclipse + Bento Spatial (propuestos pero no implementados)
- [ ] Upgrade Vercel Pro ($20/mes) si necesita refresh > 5 meses
- [ ] Sentry / Logging tool para monitoreo runtime
- [ ] CI/CD GitHub Actions (tests + lint en PR)
- [ ] Documentar flujo de PTTO para próxima carga anual
- [ ] Agregar `kgBudget` a `territory_budgets` si quieren meta de kilos también

### Aprendizajes para próximos proyectos

- [ ] Correr `npm run build` LOCAL antes del primer push a Vercel (cacha errores TS strict)
- [ ] Probar en mínimo 2 browsers antes de cerrar features con CSS modern
- [ ] Setup staging env (Vercel branch `develop`) para próxima iteración mayor

---

## 🛠️ Cómo retomar trabajo (workflow)

### 1. Sincronización inicial

```bash
cd "/Users/mauusabiaga/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]"
git status                # ver si quedaron cambios pendientes
git log --oneline -20     # últimos commits
git pull origin main      # sincronizar con remoto
```

### 2. Confirmar estado con Mauricio

ANTES de implementar nada, preguntar:
- "¿Qué quieres hacer hoy?"
- "¿Probaste lo último que dejamos? ¿Algún issue nuevo?"

### 3. Antes de tocar código

- Lee `AGENTS.md` (auto-cargado).
- Si vas a tocar un área específica, busca en `SESSION_LOG.md` decisiones previas (D001-D016).
- Si encuentras una decisión "Vigente" relacionada, **respétala** — ya se discutió y aprobó.

### 4. Implementación

- **Preguntar** ante cualquier ambigüedad (regla absoluta de Mauricio).
- **Validar end-to-end:** `npm run build` local + tipos clean + smoke test.
- **Commits chunkeados** para tareas largas.
- **NO eliminar elementos existentes** al replicar/mejorar features.

### 5. Cierre de sesión

- Agregar entrada al `SESSION_LOG.md` (D017, D018... consecutivo) si hay decisión relevante.
- Si fixeaste bugs, agregar fila a "Bugs Resueltos".
- Si hubo cambios estructurales: regenerar `.docx` con `python3 scripts/gen_docs.py`.
- Tachar items completados en backlog.
- Actualizar versión en metadata si hay deploy nuevo.

---

## 🔥 Comandos útiles

```bash
# Build de producción (validación pre-push)
npm run build

# Type check sin build
npx tsc --noEmit

# Dev server (Turbopack)
npm run dev

# Si Turbopack cachea CSS y no reflejan cambios
rm -rf .next && npm run dev

# Commit + push (PAT en SECRETS)
git add <files>
git commit -m "..."
git push origin main

# Regenerar .docx
python3 scripts/gen_docs.py
```

---

## 🎨 Convenciones del código

- **Idioma:** comentarios en código pueden ir en inglés o español, comentarios largos prefieren español. Mensajes de commit en inglés (sin acentos).
- **Formato money:** usar `formatMoney()` de `lib/format.ts` (ej: `$1.6M`, `$127.0M`).
- **Formato kilos:** usar `formatKilos()` de `lib/format.ts` (ej: `28,612 kg`, `469K kg`).
- **Themes:** vía `data-theme` attribute. NO uses Tailwind dark mode prefix; usa CSS vars (`var(--bg-surface)`, etc.).
- **Persistencia frontend:** `localStorage` con keys prefijadas (`dashboard-sidebar-collapsed`, `tracking-diario-mode`, `dashboard-theme`).
- **TypeScript strict.** Vercel falla si tienes errores TS no detectados en dev (Turbopack es más permisivo que tsc).

---

## 📦 Componentes que probablemente toques

| Componente | Ubicación | Qué hace |
|---|---|---|
| `DashboardClient` | `app/dashboard/DashboardClient.tsx` | Orquesta sidebar + tabs + state global |
| `Sidebar` | `components/dashboard/Sidebar.tsx` | Lista de territorios + collapsible |
| `KpiCardsRow` | `components/dashboard/KpiCardsRow.tsx` | Las 3 KPI cards top + 3 acumulado |
| `TrackingDiarioTab` | `components/dashboard/TrackingDiarioTab.tsx` | Tab principal con toggle Pesos/KG |
| `VentasTab` | `components/dashboard/VentasTab.tsx` | Chart anual + tabla |
| `DimensionTab` | `components/dashboard/DimensionTab.tsx` | Tab genérico (Grupo Producto, Productos, Clientes) |
| `VendedoresTab` | `components/dashboard/VendedoresTab.tsx` | Tab vendedores con toggle Sus/Suve |
| `PerdidosTab` | `components/dashboard/PerdidosTab.tsx` | Clientes perdidos / declive / nuevos |

---

## 🚀 Si Mauricio te pide "agregar feature X al tab Y"

1. **Pregunta primero** qué exactamente quiere (no asumas).
2. Lee el componente del tab Y completo.
3. Verifica si el dato que necesita el feature ya existe en `kpi`/`TerritoryKpi` (en `Sidebar.tsx`).
4. Si NO existe, ¿hay que agregar a la query SQL (`app/dashboard/page.tsx`)? ¿Hay que agregar a la migration?
5. Si afecta otros tabs, mostrarlo a Mauricio antes de tocar.
6. Implementar, build local, push.
7. Pedir validación visual antes de cerrar.

---

## ⚠️ Cosas que NO hacer

- ❌ NO modificar el repo o deploy V2.2 (Netlify) — sigue vivo en paralelo.
- ❌ NO commitear `.env.local` (gitignored, pero por si acaso).
- ❌ NO hardcodear secrets en código.
- ❌ NO usar `dynamic = 'force-static'` en pages que dependan de auth.
- ❌ NO marcar tasks como completed sin validación end-to-end.
- ❌ NO cambiar el nombre de tabla `users_permissions` (tiene FK a `auth.users` y triggers).
- ❌ NO eliminar columnas de `sales_rows` sin backup primero (337K filas).

---

## 📞 Contactos / recursos externos

- **Mauricio:** español mexicano. Director de Operaciones. Tiene paciencia técnica pero exige cero alucinación.
- **TI Susazón:** maneja la API Key (`API-DASH-CLAUDE-2026-$$1`). Para rotación, contactar via Mauricio.
- **GoDaddy soporte:** chat en https://godaddy.com/help (responden en español).
- **Vercel soporte:** https://vercel.com/help (en inglés).
- **Supabase soporte:** https://supabase.com/dashboard/support/new (en inglés).

---

## ✅ Checklist final antes de cerrar tu sesión

- [ ] `git status` limpio o cambios commiteados
- [ ] `npm run build` pasa local
- [ ] SESSION_LOG actualizado con decisión D### si aplicable
- [ ] Tabla "Bugs Resueltos" actualizada si fixeaste algo
- [ ] Backlog actualizado (tachar/agregar items)
- [ ] Si hubo cambios estructurales: `.docx` regenerados
- [ ] Avisaste a Mauricio que terminaste
- [ ] Pushaste a `origin main` (no quedan cambios locales sin remote)

---

**Última actualización de este doc:** 2026-05-01 (cierre de fase 3 — Run-Rate hábiles + selector de mes)
