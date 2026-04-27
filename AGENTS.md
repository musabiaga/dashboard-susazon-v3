<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dashboard Comercial Susazón V3.0 — Project Context

**Owner:** Mauricio Usabiaga (Director de Operaciones, Grupo Susazón). Habla español. **Regla absoluta: NUNCA alucinar. Ante cualquier duda, preguntar antes de implementar (AskUserQuestion).**

## Estado al last-touch

- **Fases 0, 1, 2:** ✅ completas
- **Fase 2c (Dashboard real):** ✅ COMPLETA. Sidebar con 16 territorios reales + mini-KPIs por CEDI. 6 KPI cards (Venta/Margen/KG con YoY + Acum 2024/2025/2026). Run-Rate por card. vs PTTO en Venta. Editor de PTTO en `/cargar-datos` con grid año×territorio×12 meses + autosave. Nav links en header (Dashboard / Cargar datos).
- **Fase 2d (Tab Tracking Diario):** ✅ COMPLETA. Replica del V2.2: 8 stats grid + progress bar (REZAGADO/AVANZADO) + chart compuesto Recharts (4 series: Acumulado/Ptto Linear/Año Anterior/Venta Diaria) + tabla diaria de 9 columnas con color tones en Vel. Necesaria.
- **DB actual:** **337,398 filas** Ene 2024 - Abr 2026 (28 meses, ambas APIs). PTTO 2026 cargado para 14 territorios × 6 meses (Ene-Jun). Migraciones 005-007 aplicadas.
- **Próxima fase:** **3 — los 6 tabs restantes** (Ventas, Grupo Producto, Productos, Clientes, Vendedores, Perdidos) con los 4 cambios funcionales del plan original (campo `grupo`, fix eje X "$0 $1 $2", chart doble eje en Productos).

## Decisiones de mapeo PTTO confirmadas (Mauricio 2026-04-26)

- **Intercompañias:** El PTTO va solo en la fila "Intercompañias" (Susazón). "Intercompañias Suve" queda en $0 — el dashboard suma ambas al agregar, así que el comparativo vs PTTO sigue cuadrando.
- **Zurte-T Planta** (nombre en sheet de Mauricio) → **Zurt-t** (nombre en DB / API). Captura PTTO bajo "Zurt-t" — no renombrar la DB porque el próximo refresh del API volvería a meter "Zurt-t".

## Territorios reales en DB (16, ordenados alfabéticamente)

Cedis Bajio Celaya · Cedis Bajio Queretaro · Cedis Cancun · Cedis Leon · Cedis Mexico · Cedis Monterrey · Cedis Morelia · Cedis San Luis Potosi · Cuentas Directas Planta · Distribuidores · Intercompañias · Intercompañias Suve · Tiendas · Venta Detalle · Ventas Retail · Zurt-t

## Stack

- Next.js **16.2.4** (App Router + Turbopack) — NO 14, hay breakings
- React 19.2.4, TypeScript 5, Tailwind CSS 4 (CSS-first con `@theme`)
- Supabase JS v2.104 + `@supabase/ssr` v0.10
- Recharts 3.8 (NO Chart.js)
- shadcn/ui utilities, lucide-react, Zod

## Gotchas críticos (no re-descubrir)

1. **`middleware.ts` → `proxy.ts`** en Next.js 16. Función `middleware()` → `proxy()`. Limpiar `.next/` si Turbopack cachea el error viejo.
2. **`cookies()` es async** — siempre `await cookies()`.
3. **Carpetas con `_` prefix son PRIVADAS** y NO se rutean (App Router). Por eso `app/api/_debug/...` daba 404 → renombrado a `app/api/debug/`.
4. **dotenv-expand interpola `$VAR` y `${VAR}`** en `.env.local`. La key `API-DASH-CLAUDE-2026-$$1` debe escribirse `API-DASH-CLAUDE-2026-\$\$1` para que Next la lea literal.
5. **Campo `empresa` de la API viene STRING** (`"SUSAZON"`/`"SUVE"`), NO int. La columna en Postgres es `smallint CHECK (empresa IN (0,1))`. `lib/susazon-api.ts → normalizeRow()` mapea string→int.
6. **Suve API es lenta** (SQL Express, ~60s/mes en producción). Timeouts: Suve 600s/página, Susazón 120s/página. Route `/api/data/refresh` con `export const maxDuration = 800` para Vercel Pro.
7. **Refresh es idempotente:** antes de insertar (source, año, mes), borra lo existente para esa combo. Seguro de re-correr cualquier rango.
8. **API field `empresa` viene como string descriptivo** (`"SUSAZON DEL CENTRO"`, `"SUVE DEL BAJIO"`, etc.) — no exacto. `normalizeRow()` cae al fallback basado en el endpoint llamado.
9. **Supabase SELECT default limit = 1000 filas.** No usar `distinct` sobre `sales_rows` para listas de territorios — solo verás los primeros que entren en 1000. Usar `territories_state` (auto-poblada por trigger) o las vistas `kpi_monthly_summary` / `kpi_daily_summary` (con `security_invoker = true` que respeta RLS del usuario).
10. **Días hábiles = L-S (Lunes-Sábado), no L-V.** Solo Domingo es no-hábil, más feriados LFT. Helper en `lib/business-days.ts` con tabla hardcoded de feriados 2024-2027. Para abril 2026: 26 días hábiles totales (30 días - 4 domingos).
11. **Tracking Diario fórmulas (verbatim del V2.2)**:
    - `velOrig = ptto / totalBizDays`
    - `velActual = acum / elapsedBizDays`
    - `velNeces = (ptto - acum) / remainingBizDays`
    - `runRate = velActual * totalBizDays`
    - `daysWithInvoice` = días hábiles con venta > 0
    - Color tones Vel.Necesaria: green ≤ velOrig, yellow ≤ velOrig×1.2, red mayor
    - Brecha = alcancePct − tiempoPct; AVANZADO si ≥ 0, REZAGADO si negativo
12. **Al replicar features del V2.2, NO eliminar elementos.** Mauricio quiere TODO lo que el V2.2 tiene + las mejoras del V3.0 como agregados. Si una mejora desplaza algo, está mal.

## Datos clave

- **Carpeta proyecto:** `~/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]/`
- **Supabase project:** `qfxyrpifntcixwpvnjpd` — region East US (N. Virginia)
- **Admin user:** `musabiagaz@susazon.com.mx` · UID `c787cd72-200a-469e-84a1-c0d3253b0b20` · rol `admin`
- **API Susazón:** `https://sasweb.susazon.mx/susazon/api_ERPPyMEDashboard/`. Validado 2026-04-26: 200 OK, 5,951 filas/abril 2026, ~5s, 1 página.
- **API Suve:** `https://saswebsuve.susazon.mx/suve/api_ERPPyMEDashboard/`. Validado 2026-04-26: 200 OK, **2,539 filas/abril 2026, ~60s**, 1 página. Suve es SQL Express (lento por diseño).
- **Misma X-API-KEY para ambas APIs:** `API-DASH-CLAUDE-2026-$$1` (TI lo configuró igual). En `.env.local` ambas vars escapadas como `\$\$1`.
- **Campo `empresa` en row data:** viene como string descriptivo, NO exacto. Susazón devuelve variantes con "SUSAZON ...", Suve devuelve "SUVE DEL BAJIO" y posiblemente otras. `normalizeRow()` en `lib/susazon-api.ts` cae al fallback `cfg.empresaCode` basado en el endpoint llamado — robusto.
- **Campo `grupo` confirmado presente en AMBAS APIs** (no solo Susazón). Sirve para el Cambio 1 (tab Familia → grafica `grupo`).
- **Predecesor V2.2** (vivo en paralelo, NO TOCAR): `~/Desktop/Downloads Seleccionados/DASHBOARD SEMANAL VTS. V2.2/index.html` → `https://dashboard-comercial-susazon.netlify.app/`

## Mapa de archivos

```
.env.local                                  # secrets (escape \$\$1)
proxy.ts                                    # NO middleware.ts
app/
  layout.tsx                                # ThemeProvider + fonts
  globals.css                               # 3 themes vía data-theme
  login/page.tsx                            # Supabase signInWithPassword
  dashboard/page.tsx                        # placeholder, falta sidebar+KPIs+tabs
  cargar-datos/page.tsx + LoaderClient.tsx  # refresh UI
  api/data/refresh/route.ts                 # POST, admin/director only, idempotente
  api/data/snapshot/route.ts                # GET, RLS-filtered
lib/
  susazon-api.ts                            # fetchMonth + normalizeRow + filterValidRows
  supabase/{client,server,admin}.ts         # 3 variantes
  format.ts                                 # portado V2.2
components/
  brand/SusazonLogo.tsx                     # auto-switch on-dark/on-light
  theme/{ThemeProvider,ThemeSelector}.tsx
  layout/Header.tsx
supabase/migrations/                        # 001 users · 002 territories · 003 audit · 004 sales_rows
```

## Cambios funcionales pendientes vs V2.2 (no perder)

1. Tab "Familia" → graficar campo `grupo` (TI ya lo agregó a la API).
2. Fix eje X "$0, $1, $2..." en charts de Familia + Clientes + Vendedores → `XAxis dataKey="name"` en Recharts.
3. Tab Productos: agregar chart doble eje (Pesos $ izq + Kilos derecha) ARRIBA de la tabla.

## Plan completo

Vive en `/Users/mauusabiaga/.claude/plans/linked-honking-boot.md`. Cargarlo si se requiere detalle de roles, RLS, fases, criterios end-to-end, decisiones pendientes.

## Cómo retomar en una sesión nueva

1. `cd "~/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]/"` — este `AGENTS.md` se auto-carga.
2. Leer la memoria del proyecto: `~/.claude/projects/.../memory/project_dashboard_susazon_v3.md`.
3. `git log --oneline -20` para ver últimos commits.
4. `git status` por si quedaron cambios sin commitear.
5. Confirmar fase actual con Mauricio antes de seguir — los pendientes pueden haber cambiado.
