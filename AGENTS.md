<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Dashboard Comercial Susazón V3.0 — Project Context

**Owner:** Mauricio Usabiaga (Director de Operaciones, Grupo Susazón). Habla español. **Regla absoluta: NUNCA alucinar. Ante cualquier duda, preguntar antes de implementar (AskUserQuestion).**

## Estado actual

**EN PRODUCCIÓN** — deployado en Vercel desde 2026-04-28. URL: `dashboard-susazon-v3-44sp-hw6gg0rwb-musabiagas-projects.vercel.app`. Repo privado: `github.com/musabiaga/dashboard-susazon-v3`.

- ✅ Fases 0-3 completas (auth, RLS, dashboard 7 tabs, admin panel)
- ✅ Fase 5 completa (admin panel: territorios + usuarios + audit log)
- ✅ 6 themes (Clean, Editorial, Warm Neo, Susazón Moderno, Stock Market, Liquid Glass) + selector modal
- ✅ Deploy a Vercel + 5 hotfixes post-deploy aplicados
- ✅ Documentación completa en `/docs/` — leer ANTES de tocar nada

## ⚡ Pendientes inmediatos (Mauricio)

- [ ] Revocar GitHub PAT `github_pat_11CCZMIL...` en github.com/settings/tokens (ya no se usa)
- [ ] Mover `~/Downloads/SECRETS_DASHBOARD_V3.txt` a Apple Notes (privado, encriptado)
- [ ] Invitar los 14 usuarios prod restantes desde `/admin/usuarios` cuando esté la lista

## Dónde está cada cosa

| Necesidad | Archivo |
|---|---|
| **Empezar (cualquier rol)** | `docs/00_INDICE_MAESTRO.md` |
| **Decisiones tomadas + bugs resueltos** | `docs/SESSION_LOG.md` |
| **Contexto técnico estructurado para agentes** | `docs/INSTRUCTIVO_AGENTE.xml` |
| **Diseño del sistema** | `docs/01_Arquitectura_Tecnica.docx` |
| **Schemas DB + contratos APIs** | `docs/02_Diccionario_Datos.docx` |
| **Historial de cambios** | `docs/03_ChangeLog_Release_Notes.docx` |
| **Guía para usuarios finales** | `docs/04_Manual_Usuario.docx` |
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

## Datos clave (no secretos)

- **Carpeta proyecto:** `~/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code]/`
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)
- **URL prod:** `dashboard-susazon-v3-44sp-hw6gg0rwb-musabiagas-projects.vercel.app`
- **Supabase project ID:** `qfxyrpifntcixwpvnjpd` — region East US (N. Virginia)
- **Admin user:** `musabiagaz@susazon.com.mx` · UID `c787cd72-200a-469e-84a1-c0d3253b0b20`
- **Predecesor V2.2** (vivo en paralelo, NO TOCAR): `~/Desktop/Downloads Seleccionados/DASHBOARD SEMANAL VTS. V2.2/index.html` → `https://dashboard-comercial-susazon.netlify.app/`

## Cómo retomar en una sesión nueva

1. **Leer este archivo** (auto-cargado al `cd` al proyecto).
2. **Leer `docs/SESSION_LOG.md`** — decisiones D001-D008 + bugs resueltos.
3. **Leer `docs/INSTRUCTIVO_AGENTE.xml`** si vas a hacer cambios estructurales.
4. **`git log --oneline -20`** para ver últimos commits.
5. **`git status`** por si quedaron cambios sin commitear.
6. **Confirmar fase actual con Mauricio** ANTES de tocar nada.
7. **Si vas a editar docs**, regenerá los `.docx` con `python3 scripts/gen_docs.py`.

## Reglas absolutas

1. **NUNCA alucinar.** Si dudás → AskUserQuestion. Mauricio prefiere "no sé, pregunto" antes que datos inventados.
2. **NO eliminar elementos existentes.** Replicar V2.2 = agregar mejoras, nunca quitar.
3. **Validar end-to-end antes de "listo".** Build local + tipos + smoke test browser.
4. **Commits chunkeados.** Tareas largas se trocean.
5. **Idioma:** español mexicano. Los mensajes técnicos pueden ir en inglés (commits, code) pero la comunicación con Mauricio en español.
6. **Antes de declarar el deploy listo:** correr `npm run build` local. Vercel hace tsc strict — `npm run dev` no.
