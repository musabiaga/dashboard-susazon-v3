# Índice Maestro — Dashboard Comercial Susazón V4.2

**Proyecto:** Dashboard Comercial Susazón V4.2 — **InCom** (Inteligencia Comercial Susazón®)
**Empresa:** Grupo Susazón (Susazón + Suve)
**Owner:** Mauricio Usabiaga (Director de Operaciones)
**Estado:** En producción (versión 4.2.0)
**URL canonical:** `https://www.dashboardcomercialsusazon.com`
**Última actualización:** 2026-07-24

> 🆕 **Lee primero `LO_NUEVO.md`** si vienes de una sesión previa — te ahorra leer todo el
> SESSION_LOG. **V4.2** agregó el 6º Insight **Crecimiento x Vendedor** (comparativa Año
> Anterior vs Actual por vendedor, con totalizador REAL y Ticket Promedio). V4.1 había
> agregado el módulo **Agrupadores** (territorios virtuales, Fase 1→3), el 5º Insight
> **Penetración/Canasta** y el **histograma** de las pastillas de Tracking.

---

## Documentación

| # | Archivo | Tipo | Propósito | Versión | Última actualización |
|---|---------|------|-----------|---------|---------------------|
| 1 | `01_Arquitectura_Tecnica.docx` | Word | Diseño del sistema, stack tecnológico, flujo de información, decisiones arquitectónicas | **4.2.0** | **2026-07-24** |
| 2 | `02_Diccionario_Datos.docx` | Word | Schemas de DB, contratos de APIs, estructura de objetos, mapeo de columnas, funciones SQL | **4.2.0** | **2026-07-24** |
| 3 | `03_ChangeLog_Release_Notes.docx` | Word | Evolución V2.2 → V4.2 (incluye Fases 1-16) | **4.2.0** | **2026-07-24** |
| 4 | `04_Manual_Usuario.docx` | Word | Manual para usuarios finales — incluye Agrupadores, Insights (**6 sub-análisis**, incl. Crecimiento x Vendedor), histograma de pastillas, tab Clientes y Productos | **4.2.0** | **2026-07-24** |
| 5 | `05_Guia_TI_Despliegue.docx` | Word | Guía para ingeniero de TI: despliegue, env vars, troubleshooting, monitoreo | **4.2.0** | **2026-07-24** |
| 6 | `06_Guia_Reconstruccion.docx` | Word | Reconstrucción desde cero: paso a paso, algoritmos, dependencias, verificación | **4.2.0** | **2026-07-24** |
| 7 | `INSTRUCTIVO_AGENTE.xml` | XML | Instructivo completo para futuros agentes Claude. **Incluye Fases 6-16** | **4.2** | **2026-07-24** |
| 8 | `SESSION_LOG.md` | Markdown | Bitácora viva: decisiones D001-D043, bugs 1-50, backlog. **Incluye Fases 6-16** | **4.2** | **2026-07-24** |
| 9 | `00_INDICE_MAESTRO.md` | Markdown | Este archivo — índice de toda la documentación | **4.2** | **2026-07-24** |
| 10 | `CONTINUACION_NUEVA_CONVERSACION.md` | Markdown | Contexto compacto para retomar el proyecto en otra sesión Claude | **4.2** | **2026-07-24** |
| 11 | `Instructivo_Usuario_Visual.html` / `.pdf` | HTML/PDF | Manual visual para usuarios finales (el HTML es el que se abre desde el dashboard). **V4.2 con secciones nuevas marcadas** | **4.2** | **2026-07-24** |
| 12 | `AUTH_FLOWS.md` | Markdown | Documentación técnica del sistema de auth. Diagramas de los 3 flows | 1.0 | 2026-05-01 |
| 12b | `GUIA_OBTENER_SECRETS.md` | Markdown | **Cómo obtener CADA credencial** (Supabase, Vercel, GitHub, APIs, Resend, GoDaddy) para reconstruir desde cero. Sin valores reales (committeable) | **1.0** | **2026-07-05** |
| 13 | `LO_NUEVO.md` | Markdown | **Resumen ejecutivo de V4.2 (Fase 16: Crecimiento x Vendedor) y V4.1 (Fases 10-15).** Lee primero si vienes de una sesión previa | **3.0** | **2026-07-05** |
| 14 | `_backups/2026-05-10_pre-update/` | Snapshot | Snapshot inmutable de los docs antes de la actualización del 10-may | — | 2026-05-10 |

> **Sobre los `.docx` y el PDF:** en V4.2 se regeneraron los 6 `.docx` a la versión **4.2.0**
> vía `scripts/gen_docs.py`, y el PDF visual se regeneró desde `public/instructivo.html`.
> Todos reflejan el estado al **2026-07-24** (Fases 1-16, incluye Crecimiento x Vendedor).

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
- `components/` — Componentes React (incl. `components/dashboard/insights/` con **6 sub-análisis**)
- `lib/` — Utilidades server-side y cliente
- `supabase/migrations/` — Schemas SQL aplicados (**40 migraciones**)
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
