# Índice Maestro — Dashboard Comercial Susazón V4.0

**Proyecto:** Dashboard Comercial Susazón V4.0 — **InCom** (Inteligencia Comercial Susazón®)
**Empresa:** Grupo Susazón (Susazón + Suve)
**Owner:** Mauricio Usabiaga (Director de Operaciones)
**Estado:** En producción (versión 4.0.0)
**URL canonical:** `https://www.dashboardcomercialsusazon.com`
**Última actualización:** 2026-06-07

> 🆕 **Lee primero `LO_NUEVO.md`** si vienes de una sesión previa a Fase 10 (≤ 2026-05-23) — te
> ahorra leer todo el SESSION_LOG para identificar qué se agregó en V4.0 (Fases 10, 11, 12).

---

## Documentación

| # | Archivo | Tipo | Propósito | Versión | Última actualización |
|---|---------|------|-----------|---------|---------------------|
| 1 | `01_Arquitectura_Tecnica.docx` | Word | Diseño del sistema, stack tecnológico, flujo de información, decisiones arquitectónicas | **4.0.0** | **2026-06-07** |
| 2 | `02_Diccionario_Datos.docx` | Word | Schemas de DB, contratos de APIs, estructura de objetos, mapeo de columnas, funciones SQL | **4.0.0** | **2026-06-07** |
| 3 | `03_ChangeLog_Release_Notes.docx` | Word | Evolución V2.2 → V4.0 (incluye Fases 1-12) | **4.0.0** | **2026-06-07** |
| 4 | `04_Manual_Usuario.docx` | Word | Manual para usuarios finales — incluye tab Clientes y Productos, Insights (4 sub-análisis), Tracking cards | **4.0.0** | **2026-06-07** |
| 5 | `05_Guia_TI_Despliegue.docx` | Word | Guía para ingeniero de TI: despliegue, env vars, troubleshooting, monitoreo | **4.0.0** | **2026-06-07** |
| 6 | `06_Guia_Reconstruccion.docx` | Word | Reconstrucción desde cero: paso a paso, algoritmos, dependencias, verificación | **4.0.0** | **2026-06-07** |
| 7 | `INSTRUCTIVO_AGENTE.xml` | XML | Instructivo completo para futuros agentes Claude. **Incluye Fases 6-12** | **4.0** | **2026-06-07** |
| 8 | `SESSION_LOG.md` | Markdown | Bitácora viva: decisiones D001-D031, bugs 1-42, backlog. **Incluye Fases 6-12** | **4.0** | **2026-06-07** |
| 9 | `00_INDICE_MAESTRO.md` | Markdown | Este archivo — índice de toda la documentación | **4.0** | **2026-06-07** |
| 10 | `CONTINUACION_NUEVA_CONVERSACION.md` | Markdown | Contexto compacto para retomar el proyecto en otra sesión Claude | **4.0** | **2026-06-07** |
| 11 | `Instructivo_Usuario_Visual.html` / `.pdf` | HTML/PDF | Manual visual para usuarios finales (el HTML es el que se abre desde el dashboard). **V4.0 con secciones nuevas marcadas** | **4.0** | **2026-06-07** |
| 12 | `AUTH_FLOWS.md` | Markdown | Documentación técnica del sistema de auth. Diagramas de los 3 flows | 1.0 | 2026-05-01 |
| 12b | `GUIA_OBTENER_SECRETS.md` | Markdown | **Cómo obtener CADA credencial** (Supabase, Vercel, GitHub, APIs, Resend, GoDaddy) para reconstruir desde cero. Sin valores reales (committeable) | **1.0** | **2026-06-07** |
| 13 | `LO_NUEVO.md` | Markdown | **Resumen ejecutivo de V4.0 (Fases 10-12).** Lee primero si vienes de una sesión previa | **3.0** | **2026-06-07** |
| 14 | `_backups/2026-05-10_pre-update/` | Snapshot | Snapshot inmutable de los docs antes de la actualización del 10-may | — | 2026-05-10 |

> **Sobre los `.docx` y el PDF:** en V4.0 se regeneraron los 6 `.docx` a la versión **4.0.0**
> vía `scripts/gen_docs.py`, y el PDF visual se regeneró desde `public/instructivo.html`.
> Todos reflejan el estado al **2026-06-07** (Fases 1-12).

---

## Respaldo Profesional Plan Z (V2.0)

Respaldo profesional con estructura V2.0 (kebab-case + scaffold completo + sesiones JSONL) en:

```
Desktop/Downloads Seleccionados/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code] [Respaldo Profesional Plan Z]/
```

Contiene: `README.md`, `CHANGELOG.md` (source of truth), `.gitignore`, `.env.example`,
`package.json`, los docs en kebab-case dentro de `/docs/`, y las sesiones de trabajo dentro
de `/sessions/`. **Se sincroniza desde el repo principal con `scripts/respaldar.sh`** (copia
código + docs con renombre kebab-case + sesiones).

## Documentos NO en el repo (privados)

| Archivo | Ubicación | Contenido |
|---------|-----------|-----------|
| `SECRETS_DASHBOARD_V3.txt` | `~/Downloads/` (luego mover a Apple Notes) | TODOS los tokens, API keys, credenciales, UIDs |
| `Apple Notes: DASHBOARD COMERCIAL SUSAZÓN V3.0` | Apple Notes bloqueado | Credenciales usuarios + Supabase + Vercel + GitHub PAT + recovery codes |

## Código fuente

El código vive en este repo (`github.com/musabiaga/dashboard-susazon-v3`). Carpetas críticas:

- `app/` — Páginas Next.js (App Router) · **7 tabs** en `app/dashboard/`
- `components/` — Componentes React (incl. `components/dashboard/insights/` con 4 sub-análisis)
- `lib/` — Utilidades server-side y cliente
- `supabase/migrations/` — Schemas SQL aplicados (**24 migraciones**)
- `docs/` — Esta documentación

## Dónde está deployado

- **URL prod canonical:** `https://www.dashboardcomercialsusazon.com` (registrar: GoDaddy)
- **URL prod fallback:** `https://dashboard-susazon-v3-44sp.vercel.app`
- **Hosting:** Vercel (plan Hobby) — proyecto `dashboard-susazon-v3-44sp`
- **DB:** Supabase project `qfxyrpifntcixwpvnjpd` (region East US, plan Pro)
- **SMTP:** Resend (free tier 3,000 emails/mes)
- **Repo:** `github.com/musabiaga/dashboard-susazon-v3` (privado)

## Cómo usar esta documentación

| Si sos... | Empezá leyendo |
|---|---|
| **Usuario final** (gerente, vendedor) | El **Instructivo visual** desde el botón del dashboard, o `04_Manual_Usuario.docx` |
| **Ingeniero TI / DevOps** | `05_Guia_TI_Despliegue.docx` + `01_Arquitectura_Tecnica.docx` |
| **Desarrollador** implementando features | `01_Arquitectura_Tecnica.docx` + `02_Diccionario_Datos.docx` + `06_Guia_Reconstruccion.docx` |
| **Desarrollador tocando auth/SMTP** | `AUTH_FLOWS.md` |
| **Claude / Agente AI** continuando el proyecto | **`LO_NUEVO.md`** (PRIMERO) + **`CONTINUACION_NUEVA_CONVERSACION.md`** + `INSTRUCTIVO_AGENTE.xml` + `SESSION_LOG.md` + el `AGENTS.md` raíz |
| **Mauricio** revisando qué pasó | `SESSION_LOG.md` + `03_ChangeLog_Release_Notes.docx` |

## Notas importantes

- Los archivos `.md` y `.xml` son **documentos vivos** — actualizar cuando hay cambios significativos
- Los `.docx` se regeneran con `scripts/gen_docs.py`; el PDF visual, desde `public/instructivo.html`
- El respaldo Plan Z se sincroniza con `scripts/respaldar.sh`
- **Cero información sensible** en este repo — los secretos viven en `SECRETS_DASHBOARD_V3.txt` (privado)
- El predecesor V2.2 (single-page HTML) sigue vivo en paralelo en Netlify — NO tocar
