# Índice Maestro — Dashboard Comercial Susazón V3.0

**Proyecto:** Dashboard Comercial Susazón V3.0
**Empresa:** Grupo Susazón (Susazón + Suve)
**Owner:** Mauricio Usabiaga (Director de Operaciones)
**Estado:** En producción (versión 1.3.0)
**URL canonical:** `https://www.dashboardcomercialsusazon.com`
**Última actualización:** 2026-05-01

---

## Documentación

| # | Archivo | Tipo | Propósito | Versión | Última actualización |
|---|---------|------|-----------|---------|---------------------|
| 1 | `01_Arquitectura_Tecnica.docx` | Word | Diseño del sistema, stack tecnológico, flujo de información, decisiones arquitectónicas | 1.3 | 2026-05-01 |
| 2 | `02_Diccionario_Datos.docx` | Word | Schemas de DB, contratos de APIs, estructura de objetos internos, mapeo de columnas | 1.3 | 2026-05-01 |
| 3 | `03_ChangeLog_Release_Notes.docx` | Word | Evolución V2.2 → V3.0, historial de commits, fixes y features por versión | 1.3 | 2026-05-01 |
| 4 | `04_Manual_Usuario.docx` | Word | Manual no-técnico para los 15 usuarios finales (admin, director, gerente, vendedor) | 1.3 | 2026-05-01 |
| 5 | `05_Guia_TI_Despliegue.docx` | Word | Guía para ingeniero de TI: despliegue, env vars, troubleshooting, monitoreo | 1.3 | 2026-05-01 |
| 6 | `06_Guia_Reconstruccion.docx` | Word | Reconstrucción desde cero: paso a paso, algoritmos, dependencias, verificación | 1.3 | 2026-05-01 |
| 7 | `INSTRUCTIVO_AGENTE.xml` | XML | Instructivo completo para futuros agentes Claude que continúen el proyecto | 1.3 | 2026-05-01 |
| 8 | `SESSION_LOG.md` | Markdown | Bitácora viva: decisiones, bugs, backlog, contexto histórico | 1.3 | 2026-05-01 |
| 9 | `00_INDICE_MAESTRO.md` | Markdown | Este archivo — índice de toda la documentación | 1.3 | 2026-05-01 |
| 10 | `CONTINUACION_NUEVA_CONVERSACION.md` | Markdown | **Contexto compacto para retomar el proyecto en otra sesión Claude** sin tener que releer todos los docs | 1.0 | 2026-04-30 |
| 11 | `Instructivo_Usuario_Visual.pdf` | PDF | Instructivo visual estilo Liquid Glass para usuarios finales — explica pantalla principal y cada KPI | 1.0 | 2026-04-30 |

## Documentos NO en el repo (privados)

| Archivo | Ubicación | Contenido |
|---------|-----------|-----------|
| `SECRETS_DASHBOARD_V3.txt` | `~/Downloads/` (luego mover a Apple Notes) | TODOS los tokens, API keys, credenciales, UIDs |

## Código fuente

El código vive en este mismo repo (`github.com/musabiaga/dashboard-susazon-v3`). Las carpetas críticas:

- `app/` — Páginas Next.js (App Router)
- `components/` — Componentes React reusables
- `lib/` — Utilidades server-side y cliente
- `supabase/migrations/` — Schemas SQL aplicados (10 migraciones)
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
| **Claude / Agente AI** continuando el proyecto | **`CONTINUACION_NUEVA_CONVERSACION.md`** (PRIMERO) + `INSTRUCTIVO_AGENTE.xml` + `SESSION_LOG.md` + el `AGENTS.md` raíz |
| **Mauricio** (futuro) revisando qué pasó | `SESSION_LOG.md` + `03_ChangeLog_Release_Notes.docx` |
| **Auditor / Director** evaluando seguridad | `01_Arquitectura_Tecnica.docx` (sección Seguridad) |

## Notas importantes

- Los archivos `.md` y `.xml` son **documentos vivos** — actualizar cuando hay cambios significativos
- Los archivos `.docx` se regeneran cuando hay updates mayores (con el script `scripts/gen_docs.py`)
- **Cero información sensible** en este repo — todos los secretos viven en `SECRETS_DASHBOARD_V3.txt` (privado)
- El predecesor V2.2 (single-page HTML) **sigue vivo en paralelo** en Netlify — NO tocar
