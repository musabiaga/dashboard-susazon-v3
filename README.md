# Dashboard Comercial Susazón V4.2 — InCom

Dashboard comercial semanal/mensual de **Grupo Susazón** (Susazón + Suve). Inteligencia
Comercial Susazón® (**InCom**). En producción.

- **URL:** https://www.dashboardcomercialsusazon.com
- **Owner:** Mauricio Usabiaga (Director de Operaciones)
- **Versión:** 4.2.0

## Qué hace

Reemplaza al dashboard V2.2 (single-page HTML en Netlify) con una arquitectura
cliente-servidor segura: backend que oculta credenciales, RLS por territorio en
Postgres, panel admin, audit log y 6 themes.

## Stack

- **Next.js 16.2.4** (App Router + Turbopack), React 19, TypeScript 5, Tailwind CSS 4
- **Supabase** (Postgres + RLS + Auth) · **Vercel** (hosting) · **Recharts 3.x**

## Los 7 tabs

Tracking Diario · Ventas · Grupo Producto · **Clientes y Productos** · Vendedores ·
Perdidos · **Insights** (Concentración · Precio $/kg · Cuadrante BCG · Estacionalidad).

## Setup local

```bash
git clone https://github.com/musabiaga/dashboard-susazon-v3.git
cd dashboard-susazon-v3
npm install
cp .env.example .env.local   # llenar con los secrets (ver SECRETS, no en repo)
npm run dev
```

## Documentación

Toda la documentación vive en [`/docs`](./docs) — empieza por
[`00_INDICE_MAESTRO.md`](./docs/00_INDICE_MAESTRO.md). Para retomar el proyecto:
`docs/LO_NUEVO.md` + `docs/CONTINUACION_NUEVA_CONVERSACION.md` + `AGENTS.md`.

- Manual de usuario visual: `docs/Instructivo_Usuario_Visual.html` (se abre desde el
  dashboard con el botón "Instructivo") / `.pdf`.
- ChangeLog completo: `docs/03_ChangeLog_Release_Notes.docx`.

## Scripts útiles

- `npm run build` — build de producción
- `python3 scripts/gen_docs.py` — regenera los 6 `.docx`
- `./scripts/respaldar.sh` — sincroniza el respaldo profesional (Plan Z)

## Deploy

Push a `main` → Vercel auto-deploya. `main` siempre debe quedar deployable.

## Licencia

Software propietario de Grupo Susazón. Uso restringido a personal autorizado.
