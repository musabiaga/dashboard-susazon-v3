# Guía para obtener TODAS las credenciales — Dashboard Comercial Susazón V4.1

> **Propósito:** que cualquier developer o agente pueda **reconstruir el sistema desde
> cero** obteniendo cada credencial de su servicio de origen. **Este documento NO contiene
> valores secretos** (es committeable). Los valores reales viven en
> `SECRETS_DASHBOARD_V3.txt` (privado) + Apple Notes/1Password, y en una carpeta `secrets/`
> gitignored dentro de cada copia del proyecto.

> 🔒 **Regla de oro:** ningún valor real (keys, tokens, passwords) se commitea al repo.
> El `Service Role Key` da admin total a la DB — tratarlo como nuclear.

---

## 0. Mapa de variables de entorno

| Variable (`.env.local` local / Vercel UI en prod) | Servicio | ¿Pública? |
|---|---|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Sí (va al browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Sí (va al browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **NO — admin total** |
| `SUSAZON_API_URL` · `SUSAZON_API_KEY` | API Susazón | NO (server-side) |
| `SUVE_API_URL` · `SUVE_API_KEY` | API Suve (refresh live deshabilitado) | NO |

- **Local:** los valores van en `.env.local` (gitignored).
- **Producción:** los valores se configuran en **Vercel → Project → Settings → Environment Variables** (NO se leen de `.env.local` en prod).

---

## 1. Supabase  (proyecto `qfxyrpifntcixwpvnjpd`, region East US, plan Pro)

Entra a **https://supabase.com/dashboard** con la cuenta del proyecto → selecciona el proyecto.

| Credencial | Dónde obtenerla | Va en |
|---|---|---|
| **Project URL** | Settings → API → *Project URL* | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public key** | Settings → API → *Project API keys → `anon` `public`* | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role key** ⚠️ | Settings → API → *Project API keys → `service_role` `secret`* (botón *Reveal*) | `SUPABASE_SERVICE_ROLE_KEY` |
| **Project ref** | Settings → General → *Reference ID* (o el subdominio del Project URL) | (Supabase CLI) |
| **DB password / connection string** | Settings → Database → *Connection string* (o *Reset database password* si se perdió) | `DATABASE_URL` (para correr migraciones / `pg_dump` / `respaldar.sh --con-db`) |
| **Site URL + Redirect URLs** (auth) | Authentication → URL Configuration | (config en Supabase, no en env) |

**Para aplicar las 37 migraciones a una DB fresca:** Dashboard → SQL Editor (pega cada
migración 001→024 en orden), o `supabase db push` con la CLI + el connection string, o
`psql "$DATABASE_URL" -f supabase/migrations/0XX_*.sql`.

---

## 2. Vercel  (proyecto `dashboard-susazon-v3-44sp`, plan Hobby)

Entra a **https://vercel.com** con **"Continue with GitHub"** (cuenta vinculada al GitHub `musabiaga`).

| Credencial | Dónde obtenerla |
|---|---|
| **Acceso al proyecto** | Login con GitHub OAuth → proyecto `dashboard-susazon-v3-44sp` |
| **Environment Variables** | Project → Settings → Environment Variables → setear las 5 vars de la sección 0 (Production + Preview) |
| **Vercel Token** (solo si usas CLI/API) | Account Settings → Tokens → *Create* |

**Deploy:** está conectado a GitHub → cada push a `main` auto-deploya. No requiere token para eso.
**Límite Hobby:** 300 s por función serverless (relevante para `/api/data/refresh`).

---

## 3. GitHub  (repo privado `musabiaga/dashboard-susazon-v3`)

| Credencial | Dónde obtenerla |
|---|---|
| **Acceso al repo** | Login con la cuenta `musabiaga` (el repo es privado) |
| **Personal Access Token (PAT)** | https://github.com/settings/tokens → *Fine-grained tokens* → *Generate*. Scope: **solo este repo**, permiso *Contents: Read and write*. Úsalo como password al hacer `git push` desde una máquina nueva. |

> El PAT viejo (creado 2026-04-28) está marcado para revocar — Vercel ya usa OAuth, no
> ese token. Para pushes desde otra máquina, generar uno nuevo.

---

## 4. APIs Susazón y Suve  (datos comerciales)

| Credencial | Dónde obtenerla | Va en |
|---|---|---|
| **`SUSAZON_API_URL`** | Fijo: `https://sasweb.susazon.mx/susazon/api_ERPPyMEDashboard/` | `.env` |
| **`SUVE_API_URL`** | Fijo: `https://saswebsuve.susazon.mx/suve/api_ERPPyMEDashboard/` | `.env` |
| **`X-API-KEY`** (misma para ambas) | **La provee TI de Susazón** (contacto en `SECRETS_DASHBOARD_V3.txt`, sección 3). Se manda como header `X-API-KEY` en cada request server-side. | `SUSAZON_API_KEY` (= `SUVE_API_KEY`) |

> El refresh **en vivo** de Suve está deshabilitado (su SQL Express es lento). Los datos
> históricos de Suve YA están en `sales_rows` (empresa = Suve). Reactivar solo si TI optimiza.

---

## 5. Resend  (SMTP para emails de auth: invite / recovery / magic link)

| Credencial | Dónde obtenerla |
|---|---|
| **API Key de Resend** | https://resend.com/api-keys → *Create API Key* (empieza con `re_`) |
| **Dónde se usa** | Supabase Dashboard → Authentication → SMTP Settings → *Enable Custom SMTP*. Host `smtp.resend.com`, Port `465` (SSL), Username `resend`, **Password = la API key de Resend**. |
| **Sender / templates** | From: dominio verificado en Resend. Templates HTML (invite/recovery/magic-link) en Supabase → Auth → Email Templates (backup en docs). |

Plan Free: 3,000 emails/mes. Sin esto, Supabase usa su email default con rate limit (~3-4/hora).

---

## 6. GoDaddy  (dominio `dashboardcomercialsusazon.com`)

| Credencial / dato | Dónde |
|---|---|
| **Acceso** | Login a la cuenta GoDaddy del owner |
| **DNS records** | GoDaddy → Domain → DNS. Registros: `A @ → 76.76.21.21`, `CNAME www → cname.vercel-dns.com`. Renovación auto activada (vence 2029). |
| **Verificación en Vercel** | Vercel → Project → Settings → Domains → agregar el dominio + apex con redirect 308. |

---

## 7. Orden de reconstrucción desde cero (resumen)

1. **Clonar** el repo (o usar la carpeta Plan Z) → `npm install`.
2. **Supabase:** crear/restaurar proyecto → aplicar migraciones 001-024 → obtener URL + anon + service_role + connection string.
3. **APIs:** pedir el `X-API-KEY` a TI Susazón.
4. **Resend:** crear API key → configurar SMTP en Supabase.
5. **`.env.local`** con las 5 (o 7) variables → `npm run dev` para validar local.
6. **Vercel:** importar el repo de GitHub → setear las env vars en la UI → deploy.
7. **GoDaddy:** apuntar el dominio a Vercel (si aplica).
8. **Usuarios:** invitar desde `/admin/usuarios` (Magic Link).

Con esto el sistema queda idéntico. Los **valores** de cada credencial: `SECRETS_DASHBOARD_V3.txt`
+ Apple Notes/1Password (+ `secrets/` gitignored en cada carpeta).
