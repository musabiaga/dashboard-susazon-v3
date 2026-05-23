# Índice Maestro — Dashboard Comercial Susazón V3.0

**Proyecto:** Dashboard Comercial Susazón V3.0 — **InCom** (Inteligencia Comercial Susazón®)
**Empresa:** Grupo Susazón (Susazón + Suve)
**Owner:** Mauricio Usabiaga (Director de Operaciones)
**Estado:** En producción (versión 3.9.0)
**URL canonical:** `https://www.dashboardcomercialsusazon.com`
**Última actualización:** 2026-05-23

> 🆕 **Lee primero `LO_NUEVO.md`** si vienes de una sesión previa a Fase 6 (≤ 2026-05-10) — te
> ahorra leer todo el SESSION_LOG para identificar qué se agregó recientemente (Fases 6, 7, 8).

---

## Documentación

| # | Archivo | Tipo | Propósito | Versión | Última actualización |
|---|---------|------|-----------|---------|---------------------|
| 1 | `01_Arquitectura_Tecnica.docx` | Word | Diseño del sistema, stack tecnológico, flujo de información, decisiones arquitectónicas | 2.0 | 2026-05-10 |
| 2 | `02_Diccionario_Datos.docx` | Word | Schemas de DB, contratos de APIs, estructura de objetos internos, mapeo de columnas + helpers `lib/aggregate.ts` | 2.0 | 2026-05-10 |
| 3 | `03_ChangeLog_Release_Notes.docx` | Word | Evolución V2.2 → V3.3 (incluye Mejoras 1-7 + Branding InCom + Login rediseño) | 2.0 | 2026-05-10 |
| 4 | `04_Manual_Usuario.docx` | Word | Manual para usuarios finales — incluye multi-select global, export Excel, expand clientes/día | 2.0 | 2026-05-10 |
| 5 | `05_Guia_TI_Despliegue.docx` | Word | Guía para ingeniero de TI: despliegue, env vars, troubleshooting, monitoreo | 2.0 | 2026-05-10 |
| 6 | `06_Guia_Reconstruccion.docx` | Word | Reconstrucción desde cero: paso a paso, algoritmos, dependencias, verificación | 2.0 | 2026-05-10 |
| 7 | `INSTRUCTIVO_AGENTE.xml` | XML | Instructivo completo para futuros agentes Claude que continúen el proyecto. **Incluye Fases 6-9** | **3.1** | **2026-05-23** |
| 8 | `SESSION_LOG.md` | Markdown | Bitácora viva: decisiones D001-D027, bugs 1-37, backlog. **Incluye Fases 6-9** | **3.1** | **2026-05-23** |
| 9 | `00_INDICE_MAESTRO.md` | Markdown | Este archivo — índice de toda la documentación | **3.1** | **2026-05-23** |
| 10 | `CONTINUACION_NUEVA_CONVERSACION.md` | Markdown | **Contexto compacto para retomar el proyecto en otra sesión Claude** | **2.1** | **2026-05-23** |
| 11 | `Instructivo_Usuario_Visual.pdf` | PDF | Instructivo visual para usuarios finales | 1.0 | 2026-04-30 |
| 12 | `AUTH_FLOWS.md` | Markdown | **Documentación técnica del sistema de auth.** Diagramas de los 3 flows | 1.0 | 2026-05-01 |
| 13 | **🆕 `LO_NUEVO.md`** | Markdown | **Resumen ejecutivo de Fases 6-9 (Mayo 11-23, 2026).** Cubre todo lo nuevo desde la última actualización de los `.docx`. Lee primero si vienes de una sesión previa. | **2.0** | **2026-05-23** |
| 14 | `_backups/2026-05-10_pre-update/` | Snapshot | Snapshot inmutable de los 13 docs antes de actualizar con la sesión del 10-may | — | 2026-05-10 |

> **Importante sobre los `.docx`:** los Word documents (1-6) reflejan el estado al **2026-05-10** (versión 3.3.0). Las Fases 6, 7 y 8 (2026-05-11 al 2026-05-17, versiones 3.5.0 → 3.8.0) están documentadas en los archivos vivos (`SESSION_LOG.md`, `INSTRUCTIVO_AGENTE.xml`) y resumidas en **`LO_NUEVO.md`**. Los `.docx` se regenerarán en una próxima sesión cuando haya cambios estructurales que lo ameriten.

## Documentos NO en el repo (privados)

| Archivo | Ubicación | Contenido |
|---------|-----------|-----------|
| `SECRETS_DASHBOARD_V3.txt` | `~/Downloads/` (luego mover a Apple Notes) | TODOS los tokens, API keys, credenciales, UIDs |
| `Apple Notes: DASHBOARD COMERCIAL SUSAZÓN V3.0` | Apple Notes bloqueado | Credenciales 14 usuarios + Supabase + Vercel + GitHub PAT + recovery codes |

## Respaldo Profesional Plan Z (V2.0)

Existe un respaldo profesional con estructura V2.0 (kebab-case + scaffold completo + 5 sesiones JSONL) en:

```
~/Downloads/DASHBOARD SEMANAL VENTAS V3.0 [Claude Code] [Respaldo Profesional Plan Z]/
```

Contiene: `README.md`, `CHANGELOG.md` (source of truth), `.gitignore`, `.env.example`,
`package.json`, los 11 docs en kebab-case dentro de `/docs/`, y las 5 sesiones de
trabajo (~65 MB) dentro de `/sessions/`.

## Documentos NO en el repo (privados)

| Archivo | Ubicación | Contenido |
|---------|-----------|-----------|
| `SECRETS_DASHBOARD_V3.txt` | `~/Downloads/` (luego mover a Apple Notes) | TODOS los tokens, API keys, credenciales, UIDs |

## Código fuente

El código vive en este mismo repo (`github.com/musabiaga/dashboard-susazon-v3`). Las carpetas críticas:

- `app/` — Páginas Next.js (App Router)
- `components/` — Componentes React reusables
- `lib/` — Utilidades server-side y cliente
- `supabase/migrations/` — Schemas SQL aplicados (**20 migraciones**)
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
| **Usuario final** (gerente, vendedor) | `Instructivo_Usuario_Visual.pdf` (PDF compacto y visual) o `04_Manual_Usuario.docx` (más detallado) |
| **Ingeniero TI / DevOps** que va a deployar/mantener | `05_Guia_TI_Despliegue.docx` + `01_Arquitectura_Tecnica.docx` |
| **Desarrollador** que va a implementar features | `01_Arquitectura_Tecnica.docx` + `02_Diccionario_Datos.docx` + `06_Guia_Reconstruccion.docx` |
| **Desarrollador tocando auth/SMTP/templates** | `AUTH_FLOWS.md` (paso a paso de los 3 flows + backup de templates + troubleshooting) |
| **Claude / Agente AI** continuando el proyecto | **`LO_NUEVO.md`** (PRIMERO, si vienes de < Fase 6) + **`CONTINUACION_NUEVA_CONVERSACION.md`** + `INSTRUCTIVO_AGENTE.xml` + `SESSION_LOG.md` + el `AGENTS.md` raíz |
| **Mauricio** (futuro) revisando qué pasó | `SESSION_LOG.md` + `03_ChangeLog_Release_Notes.docx` |
| **Auditor / Director** evaluando seguridad | `01_Arquitectura_Tecnica.docx` (sección Seguridad) |

## Notas importantes

- Los archivos `.md` y `.xml` son **documentos vivos** — actualizar cuando hay cambios significativos
- Los archivos `.docx` se regeneran cuando hay updates mayores (con el script `scripts/gen_docs.py`)
- **Cero información sensible** en este repo — todos los secretos viven en `SECRETS_DASHBOARD_V3.txt` (privado)
- El predecesor V2.2 (single-page HTML) **sigue vivo en paralelo** en Netlify — NO tocar
