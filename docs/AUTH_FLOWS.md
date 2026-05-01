# AUTH_FLOWS — Documentación técnica del sistema de autenticación

> **Audiencia:** desarrolladores y agentes Claude que vayan a tocar
> autenticación, invitaciones, password reset, o el SMTP del proyecto.
>
> **Última actualización:** 2026-05-01

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Stack y arquitectura](#2-stack-y-arquitectura)
3. [Flow 1 — Login normal (email + password)](#flow-1--login-normal)
4. [Flow 2 — Invite (primer login de un usuario nuevo)](#flow-2--invite)
5. [Flow 3 — Reset Password (recovery)](#flow-3--reset-password)
6. [Configuración Custom SMTP (Resend)](#6-configuracion-custom-smtp-resend)
7. [Templates HTML de email — backup completo](#7-templates-html-de-email--backup)
8. [Troubleshooting checklist](#8-troubleshooting-checklist)
9. [Migración a otro proveedor SMTP](#9-migracion-a-otro-proveedor-smtp)
10. [Decisiones de arquitectura](#10-decisiones-de-arquitectura)

---

## 1. Resumen ejecutivo

El proyecto usa **Supabase Auth** como backend de autenticación, con
**custom SMTP via Resend** para emails transaccionales. Hay tres flows
principales:

| Flow | Disparador | Quién lo inicia |
|---|---|---|
| **Login** | Usuario en `/login` con email + password | Usuario final |
| **Invite** | Admin agrega usuario nuevo desde `/admin/usuarios` | Admin |
| **Reset Password** | Usuario click "¿Olvidaste tu contraseña?" en login | Usuario final |

Los 3 flows comparten un **callback común** (`/api/auth/callback`) que es
quien crea la sesión y mete las cookies en el browser. Esto es importante
porque **Server Components NO pueden mutar cookies** — solo Route Handlers
pueden hacerlo.

### Decisiones críticas (ver §10 para detalle)

- **D009 (custom SMTP):** Resend en lugar del email default de Supabase porque
  el default tiene rate limit de 3-4 emails/hora en TODOS los planes (incluso Pro).
- **D010 (custom domain):** todos los flows redirigen a
  `https://www.dashboardcomercialsusazon.com` (Site URL en Supabase Dashboard).
- **D011-D013 (Server Components):** el exchange de code/token_hash por
  sesión SIEMPRE va en `/api/auth/callback` (Route Handler), nunca en
  Server Components.

---

## 2. Stack y arquitectura

### Componentes de auth

```
┌─────────────────┐  email magic link  ┌──────────────┐
│ Resend SMTP     │ ◄────────────────  │ Supabase     │
│ (envía emails)  │                    │ Auth Service │
└─────────┬───────┘                    └──────┬───────┘
          │                                   │
          ▼                                   │
   ┌──────────────┐                           │
   │ Inbox usuario│                           │
   └──────┬───────┘                           │
          │ click link                        │
          ▼                                   │
   ┌──────────────────────────────────┐       │
   │ Browser: navega a la app         │       │
   │ /api/auth/callback?code=XXX&...  │       │
   └──────┬───────────────────────────┘       │
          │                                   │
          ▼                                   │
   ┌──────────────────────────────────┐       │
   │ Next.js Route Handler            │ ──────┘
   │ /api/auth/callback/route.ts      │ exchange code → session
   │ (PUEDE mutar cookies)            │
   └──────┬───────────────────────────┘
          │ set-cookie: sb-access-token, sb-refresh-token
          ▼
   ┌──────────────────────────────────┐
   │ Browser ahora autenticado        │
   │ → redirect a /set-password       │
   │   o a / según el flow            │
   └──────────────────────────────────┘
```

### Archivos involucrados

| Archivo | Responsabilidad |
|---|---|
| `app/login/page.tsx` | UI del login + handleForgotPassword (dispara Reset Password) |
| `app/api/auth/callback/route.ts` | **Route Handler crítico** — exchange code/token por sesión |
| `app/set-password/page.tsx` | Server Component que verifica `getUser()` y monta el form |
| `app/set-password/SetPasswordClient.tsx` | Client Component con el form de password (invite y recovery) |
| `app/api/admin/users/invite/route.ts` | Admin API que dispara `inviteUserByEmail()` |
| `app/api/admin/users/reset-password/route.ts` | Admin API que dispara `resetPasswordForEmail()` |
| `app/api/auth/signout/route.ts` | Logout + audit log |
| `proxy.ts` | Middleware que protege rutas privadas + define public routes |
| `lib/supabase/client.ts` | Browser client (anon key, RLS aplica) |
| `lib/supabase/server.ts` | Server client con cookies SSR |
| `lib/supabase/admin.ts` | Admin client (service role, NO RLS — server-only) |

### Tabla de DB

`users_permissions` (creada en migración 001):

```sql
CREATE TABLE users_permissions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin','director','gerente_regional','vendedor')),
  allowed_territories TEXT[],
  can_edit_ptto BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Cada usuario en `auth.users` tiene UN registro en `users_permissions` que
define sus permisos a nivel app. RLS en `sales_rows` y otras tablas
sensibles lee `allowed_territories` para filtrar.

---

## Flow 1 — Login normal

**Cuándo:** usuario ya tiene cuenta y password configurado, entra a `/login`.

```
┌──────────────────────────────────────────────────────────────┐
│ USUARIO                                                      │
│ → Abre https://www.dashboardcomercialsusazon.com/login       │
│ → Escribe email + password                                   │
│ → Click "Iniciar sesión"                                     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ app/login/page.tsx — handleSubmit()                          │
│   const supabase = createSupabaseBrowserClient();            │
│   await supabase.auth.signInWithPassword({ email, password })│
│   → si OK: cookie sb-access-token se setea en browser        │
│   → si error: muestra "Credenciales incorrectas"             │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Audit log (insert en audit_log)                              │
│   action: "login", user_email: email, source: "web"          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ router.push("/")                                             │
│ → proxy.ts ve sesión válida → permite                        │
│ → redirect a /dashboard                                      │
└──────────────────────────────────────────────────────────────┘
```

**Nada de email se envía en este flow.** Es el más simple — todo client-side.

---

## Flow 2 — Invite

**Cuándo:** admin agrega un usuario nuevo desde `/admin/usuarios` → modal
"Invitar usuario" → Submit.

```
┌──────────────────────────────────────────────────────────────┐
│ ADMIN                                                        │
│ → /admin/usuarios → "Invitar usuario"                        │
│ → Form: email, full_name, role, territories, can_edit_ptto   │
│ → Submit                                                     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ POST /api/admin/users/invite                                 │
│ (server-side, requireAdmin guard)                            │
│                                                              │
│   const origin = new URL(request.url).origin;                │
│   const next = encodeURIComponent("/set-password?from=invite"│
│   const redirectTo = `${origin}/api/auth/callback?next=${next│
│                                                              │
│   await admin.auth.admin.inviteUserByEmail(email, {          │
│     redirectTo,                                              │
│   });                                                        │
│                                                              │
│   // Insert en users_permissions con perms del form          │
│   await admin.from("users_permissions").upsert({...});       │
│                                                              │
│   // Audit log                                               │
│   await admin.from("audit_log").insert({                     │
│     action: "user_created",                                  │
│     details: { target_user_id, role, territories, ... }      │
│   });                                                        │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ SUPABASE AUTH SERVICE                                        │
│   - crea row en auth.users (sin password todavía)            │
│   - genera token de invitación                               │
│   - llama Resend SMTP para mandar email                      │
│     Subject: "Bienvenido a Dashboard Susazón"                │
│     Template: Invite User (HTML editorial)                   │
│     Link: {{ .ConfirmationURL }} → /api/auth/callback?...    │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ USUARIO INVITADO                                             │
│ → Recibe email de noreply@dashboardcomercialsusazon.com      │
│ → Click "Configurar mi contraseña"                           │
│ → Browser navega a:                                          │
│   www.dashboardcomercialsusazon.com/api/auth/callback        │
│     ?code=XXX&type=invite&next=/set-password?from=invite     │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ /api/auth/callback/route.ts                                  │
│   const code = searchParams.get('code');                     │
│   const tokenHash = searchParams.get('token_hash');          │
│   const type = searchParams.get('type');                     │
│                                                              │
│   if (code) {                                                │
│     await supabase.auth.exchangeCodeForSession(code);        │
│     // ↑ ESTO SETEA LAS COOKIES EN EL BROWSER                │
│   }                                                          │
│   if (tokenHash && type) {                                   │
│     await supabase.auth.verifyOtp({ type, token_hash });     │
│   }                                                          │
│                                                              │
│   const needsPasswordSet =                                   │
│     type === "invite" || type === "recovery";                │
│   redirect(needsPasswordSet                                  │
│     ? `/set-password?from=${type}`                           │
│     : '/');                                                  │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ /set-password (Server Component)                             │
│   - Verifica getUser() → debe haber sesión activa            │
│   - Si NO hay sesión → redirect /login (link expirado)       │
│   - Lee users_permissions para personalizar saludo           │
│   - Renderiza SetPasswordClient con flow="invite"            │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ SetPasswordClient (Client Component)                         │
│   - Form con password + confirm password                     │
│   - Validación: 8+ chars, letra, número, coinciden           │
│   - Submit:                                                  │
│     await supabase.auth.updateUser({ password });            │
│     → setea password en auth.users                           │
│   - router.push("/dashboard") + refresh                      │
└──────────────────────────────────────────────────────────────┘
```

**Por qué el exchange va en `/api/auth/callback` y no en `/set-password`:**

Server Components en Next.js NO pueden persistir cookies al browser. Si el
exchange ocurre en `/set-password/page.tsx` (server component), el server
ve la sesión válida (porque tiene la cookie de su request), pero al
renderizar la respuesta HTML al cliente, **no puede setear cookies de
respuesta**. El navegador queda sin cookies → al hacer
`updateUser({ password })` desde el Client Component, falla con
**"Auth session missing!"**.

Solución: usar Route Handler `/api/auth/callback` que SÍ puede mutar
cookies. Después del exchange, redirige al `/set-password` que solo
verifica la sesión ya creada.

---

## Flow 3 — Reset Password

**Cuándo:** usuario olvida su password y click "¿Olvidaste tu contraseña?"
en el login.

```
┌──────────────────────────────────────────────────────────────┐
│ USUARIO                                                      │
│ → /login                                                     │
│ → Escribe su email                                           │
│ → Click "¿Olvidaste tu contraseña?"                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ app/login/page.tsx — handleForgotPassword()                  │
│   const supabase = createSupabaseBrowserClient();            │
│   const next = encodeURIComponent("/set-password?from=recovery
│   await supabase.auth.resetPasswordForEmail(email, {         │
│     redirectTo: `${window.location.origin}/api/auth/callback?next=${next}`│
│   });                                                        │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ SUPABASE AUTH SERVICE                                        │
│   - genera token de recovery                                 │
│   - llama Resend SMTP                                        │
│     Subject: "Restablece tu contraseña — Dashboard Susazón"  │
│     Template: Reset Password (HTML editorial)                │
│     Link: {{ .ConfirmationURL }} → /api/auth/callback?...    │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ USUARIO                                                      │
│ → Recibe email                                               │
│ → Click "Restablecer contraseña"                             │
│ → Browser navega a /api/auth/callback?code=XXX&type=recovery │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
   (resto del flow IDÉNTICO al de Invite, solo cambia el `from=recovery`)
   Callback → exchange → set cookies → redirect /set-password?from=recovery
   → Server Component verifica sesión → SetPasswordClient con flow="recovery"
   → Form (texto cambia a "Cambia tu contraseña")
   → updateUser({ password }) → router.push("/dashboard")
```

**Diferencias con Invite:**

- El usuario YA tiene una password (la quiere cambiar). El `updateUser()`
  la sobreescribe.
- En el callback, `type === "recovery"` (no `"invite"`).
- En `SetPasswordClient`, `flow === "recovery"` cambia los textos:
  - Header: "Cambia tu contraseña, [Nombre]" (vs "¡Bienvenido!")
  - Botón: "Actualizar contraseña y entrar" (vs "Configurar contraseña...")

---

## 6. Configuración Custom SMTP (Resend)

### Por qué Resend y no el email default de Supabase

El servicio de email default de Supabase **tiene rate limit de 3-4
emails/hora en TODOS los planes (incluso Pro)**. Es para development/testing,
no producción. Para 15 usuarios + invitaciones masivas + resets ocasionales,
hay que usar SMTP custom.

**Alternativas evaluadas:**

| Proveedor | Free tier | Setup | DX |
|---|---|---|---|
| **Resend** ✅ elegido | 3,000/mes, 100/día | 5 min | Excelente, recomendado por Supabase |
| SendGrid | 100/día (cuenta gratis) | 30 min | Bueno pero más setup |
| Postmark | 100/mes free | 15 min | Excelente DX, pero free tier muy bajo |
| AWS SES | 62,000/mes (si tu app vive en AWS) | 60+ min | Configuración compleja, requiere domain verification |

### Setup paso-a-paso

#### Paso 1 — Crear cuenta en Resend

1. https://resend.com/signup
2. Verifica tu email
3. Login → Dashboard

#### Paso 2 — Verificar el dominio (recomendado para production)

Si quieres que los emails salgan desde `noreply@dashboardcomercialsusazon.com`:

1. Resend Dashboard → **Domains** → "Add Domain"
2. Escribe `dashboardcomercialsusazon.com`
3. Resend te muestra ~5 DNS records (DKIM, SPF, DMARC) que tienes que
   agregar en GoDaddy.
4. Ve a GoDaddy DNS y agregas esos records exactos.
5. Vuelve a Resend → "Verify" → espera 5-30 min para propagación.

**Alternativa rápida (sin verificar dominio):** Resend te da por default
`onboarding@resend.dev` como sender. Funciona para testing pero los emails
caen más fácil en spam y los usuarios verán remitente raro.

#### Paso 3 — Crear API key

1. Resend Dashboard → **API Keys** → "Create API Key"
2. Nombre: `dashboard-susazon-prod`
3. Permission: **Sending access** (no necesita full access)
4. Copia la key (empieza con `re_...`) — **solo la verás 1 vez**.

#### Paso 4 — Configurar SMTP en Supabase

1. https://supabase.com/dashboard/project/qfxyrpifntcixwpvnjpd/settings/auth
2. Scroll hasta **"SMTP Settings"**
3. Toggle **"Enable Custom SMTP"** → ON
4. Llenar campos:

   | Campo | Valor |
   |---|---|
   | **Sender email** | `noreply@dashboardcomercialsusazon.com` (si verificaste dominio) o un email gmail si usas el sandbox |
   | **Sender name** | `Susazón Dashboard` |
   | **Host** | `smtp.resend.com` |
   | **Port** | `465` (SSL) |
   | **Min interval between emails** | `60` (seg, default está bien) |
   | **Username** | `resend` (literal, NO tu email) |
   | **Password** | la API key `re_...` que copiaste |

5. Click **"Save"**.
6. Botón **"Send test email"** → confirma que recibes el correo de prueba.

#### Paso 5 — Verificar que los flows funcionan

1. Desde `/admin/usuarios` invita a un usuario de prueba (puede ser tu
   gmail personal).
2. Verifica que llega el email con branding Editorial Susazón.
3. Click en el botón → debe abrir `/set-password?from=invite` con form.
4. Configura password → debe redirigir al dashboard.

#### Paso 6 — Aplicar los 4 templates HTML

Los templates ya están customizados con branding Editorial. Ver §7 para
backup completo. Aplicar en:

https://supabase.com/dashboard/project/qfxyrpifntcixwpvnjpd/auth/templates

| Template | Subject |
|---|---|
| **Confirm signup** | `Confirm Your Signup` |
| **Invite user** | `Bienvenido a Dashboard Susazón` |
| **Magic Link** | `Tu link de acceso a Dashboard Susazón` |
| **Reset Password** | `Restablece tu contraseña — Dashboard Susazón` |

Para cada uno: click el template → tab "Source" → pegar el HTML
correspondiente de §7 → "Save".

---

## 7. Templates HTML de email — backup

> Si Supabase pierde estos templates (poco probable, pero el panel UI no
> tiene backup automático), restauralos desde aquí.

### 7.1 Confirm Signup *(no usado en este proyecto, pero queda como default si algún día se activa email confirmation)*

**Subject:** `Confirm Your Signup`

```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

### 7.2 Invite User

**Subject:** `Bienvenido a Dashboard Susazón`

```html
<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenido a Dashboard Susazón</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F0E8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,35,50,0.06);">
        <tr>
          <td style="background-color:#1A2332;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ED6808;font-size:28px;font-weight:700;letter-spacing:0.02em;">SUSAZÓN</h1>
            <p style="margin:6px 0 0;color:#8b95a3;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Dashboard Comercial · V3.0</p>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 40px 32px;">
            <h2 style="margin:0 0 16px;color:#1A2332;font-size:22px;font-weight:700;line-height:1.3;">¡Bienvenido al equipo!</h2>
            <p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.6;">
              Hola,
            </p>
            <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">
              Te dieron acceso al <strong>Dashboard Comercial de Grupo Susazón</strong>. Es la herramienta interna donde podrás consultar ventas, márgenes, kilos, clientes y más en tiempo casi real.
            </p>
            <p style="margin:0 0 32px;color:#4a5568;font-size:15px;line-height:1.6;">
              Para empezar, configurá tu contraseña haciendo click en el botón de abajo:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#ED6808;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
                    Configurar mi contraseña
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:32px 0 0;color:#8b95a3;font-size:13px;line-height:1.6;">
              Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#ED6808;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F0E8;padding:24px 40px;border-top:1px solid #ede5d3;">
            <p style="margin:0 0 6px;color:#8b95a3;font-size:12px;line-height:1.5;">
              Este link expira en <strong>1 hora</strong> por seguridad. Si expiró, contactá al administrador para reenviarlo.
            </p>
            <p style="margin:0;color:#b8ad95;font-size:11px;line-height:1.5;">
              Si no esperabas este email, ignorálo — nadie podrá acceder sin tu contraseña.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#1A2332;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#8b95a3;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Grupo Susazón · 2026</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

### 7.3 Magic Link

**Subject:** `Tu link de acceso a Dashboard Susazón`

```html
<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Magic Link Dashboard</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F0E8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,35,50,0.06);">
        <tr>
          <td style="background-color:#1A2332;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ED6808;font-size:28px;font-weight:700;letter-spacing:0.02em;">SUSAZÓN</h1>
            <p style="margin:6px 0 0;color:#8b95a3;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Dashboard Comercial · V3.0</p>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 40px 32px;">
            <h2 style="margin:0 0 16px;color:#1A2332;font-size:22px;font-weight:700;line-height:1.3;">Tu link de acceso</h2>
            <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">
              Hacé click en el botón para entrar al Dashboard sin contraseña:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#ED6808;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
                    Entrar al Dashboard
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F0E8;padding:20px 40px;border-top:1px solid #ede5d3;">
            <p style="margin:0;color:#8b95a3;font-size:12px;line-height:1.5;">
              Este link expira en <strong>1 hora</strong>. Si no lo pediste, ignorá este email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#1A2332;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#8b95a3;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Grupo Susazón · 2026</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

### 7.4 Reset Password

**Subject:** `Restablece tu contraseña — Dashboard Susazón`

```html
<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F0E8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,35,50,0.06);">
        <tr>
          <td style="background-color:#1A2332;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ED6808;font-size:28px;font-weight:700;letter-spacing:0.02em;">SUSAZÓN</h1>
            <p style="margin:6px 0 0;color:#8b95a3;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Dashboard Comercial · V3.0</p>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 40px 32px;">
            <h2 style="margin:0 0 16px;color:#1A2332;font-size:22px;font-weight:700;line-height:1.3;">Restablecé tu contraseña</h2>
            <p style="margin:0 0 12px;color:#4a5568;font-size:15px;line-height:1.6;">
              Hola,
            </p>
            <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.6;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta en el <strong>Dashboard Comercial Susazón</strong>.
            </p>
            <p style="margin:0 0 32px;color:#4a5568;font-size:15px;line-height:1.6;">
              Hacé click en el botón de abajo para definir una nueva contraseña:
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#ED6808;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
                    Restablecer contraseña
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:32px 0 0;color:#8b95a3;font-size:13px;line-height:1.6;">
              Si el botón no funciona, copiá y pegá este link en tu navegador:<br>
              <a href="{{ .ConfirmationURL }}" style="color:#ED6808;word-break:break-all;">{{ .ConfirmationURL }}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#fef3c7;padding:16px 40px;border-top:1px solid #fbbf24;">
            <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">
              <strong>⚠️ ¿No fuiste vos?</strong> Si no pediste este restablecimiento, ignorá este email. Tu contraseña actual sigue funcionando y nadie tiene acceso a tu cuenta.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F0E8;padding:20px 40px;border-top:1px solid #ede5d3;">
            <p style="margin:0;color:#8b95a3;font-size:12px;line-height:1.5;">
              Este link expira en <strong>1 hora</strong> por seguridad. Si expiró, podés solicitar uno nuevo desde el login.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#1A2332;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#8b95a3;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Grupo Susazón · 2026</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

### Variables disponibles en los templates

Supabase reemplaza estas variables al renderizar:

| Variable | Qué es |
|---|---|
| `{{ .ConfirmationURL }}` | El link de acción (callback con code/token_hash) |
| `{{ .Email }}` | Email del destinatario |
| `{{ .Token }}` | Token de 6 dígitos OTP (si activas OTP en login) |
| `{{ .TokenHash }}` | Hash del token (raramente usado en templates) |
| `{{ .SiteURL }}` | El "Site URL" configurado en Supabase Dashboard |
| `{{ .RedirectTo }}` | El redirectTo enviado al hacer la llamada |

---

## 8. Troubleshooting checklist

### "Email rate limit exceeded"

**Síntoma:** después de invitar 3-4 usuarios o pedir varios resets, falla
con "rate limit exceeded".

**Causa:** estás usando el email service default de Supabase (no Resend).

**Fix:**
1. https://supabase.com/dashboard/project/qfxyrpifntcixwpvnjpd/settings/auth
2. Scroll hasta SMTP Settings → confirmar que "Enable Custom SMTP" está ON.
3. Si OFF, configurar Resend (ver §6).
4. Si ON, verificar que el password (API key) sigue válido — Resend a veces
   las rota. En ese caso: https://resend.com/api-keys → crear nueva → actualizar
   en Supabase.

---

### "OTP expired" al hacer click en el email

**Síntoma:** usuario click en el link del email y ve "OTP expired".

**Causas posibles:**

1. **Más de 1 hora pasó desde que se envió el email.** Los links de
   invitación/recovery expiran en 1 hora.
   - **Fix:** admin manda nueva invitación / usuario pide nuevo reset.

2. **El usuario abrió el link 2 veces.** El primer click consume el token.
   Segundo click → "expired" (porque ya no es válido).
   - **Fix:** mismo de arriba.

3. **Site URL en Supabase apunta a otro lugar.** El callback necesita coincidir.
   - **Fix:** https://supabase.com/dashboard/project/qfxyrpifntcixwpvnjpd/auth/url-configuration
   - **Site URL** debe ser `https://www.dashboardcomercialsusazon.com`
   - **Redirect URLs** deben incluir `https://www.dashboardcomercialsusazon.com/**`

---

### "Auth session missing!" al fijar password

**Síntoma:** usuario llena el form de password en `/set-password`, click
"Configurar contraseña", error: "Auth session missing!".

**Causa raíz documentada (D012-D013):** Server Component intentó hacer el
exchange de code → sesión, pero NO puede mutar cookies del browser. Server
veía la sesión, browser no.

**Verificación:**
1. Abrir DevTools → Application → Cookies.
2. Buscar cookies que empiezan con `sb-` (Supabase).
3. Si NO hay cookies → el callback no las seteó correctamente.

**Fix:** asegurar que el flow va por `/api/auth/callback` (Route Handler)
y NO el exchange está en un Server Component.

```typescript
// ✅ CORRECTO — en /api/auth/callback/route.ts (Route Handler)
const { error } = await supabase.auth.exchangeCodeForSession(code);

// ❌ INCORRECTO — en /set-password/page.tsx (Server Component)
const { error } = await supabase.auth.exchangeCodeForSession(code);
// El server ve la sesión, pero las cookies NO llegan al browser.
```

---

### Email no llega al usuario

**Síntomas:** invitación o reset no llega.

**Checklist en orden:**

1. **¿Está en spam/promotions?** Buscar primero ahí.
2. **¿El email del usuario es válido?** Verificar typos en `auth.users`.
3. **¿Resend está bien configurado?**
   - Supabase Dashboard → SMTP Settings → "Send test email" debe llegar.
4. **¿Hay quota disponible en Resend?**
   - https://resend.com/emails → ver "Emails sent today" (límite 100/día free).
5. **¿El dominio sender está verificado?**
   - https://resend.com/domains → debe estar verde "Verified".
   - Si está en `dashboardcomercialsusazon.com`, verificar DKIM/SPF/DMARC en GoDaddy.
6. **Logs de Resend:**
   - Resend Dashboard → "Logs" → filtrar por destinatario.
   - Ver si el email se mandó (status: delivered) o falló (status: bounced/complained).

---

### Loop entre `/set-password` y `/login`

**Síntoma:** usuario click en email → llega a `/set-password` → redirige a `/login` → pone email/password → vuelve a `/set-password` → loop.

**Causa raíz documentada (Bug 11):** `proxy.ts` no tenía `/set-password` en
public routes. Sin sesión activa al cargar la página, redirige a login.

**Fix:** asegurar que `/set-password` está en `isPublicRoute` en `proxy.ts`:

```typescript
const isPublicRoute =
  pathname === "/login" ||
  pathname === "/set-password" ||  // ← obligatorio
  pathname.startsWith("/api/auth") ||
  pathname.startsWith("/_next") ||
  pathname === "/favicon.ico" ||
  pathname.endsWith(".png") ||
  pathname.endsWith(".svg");
```

---

### Recovery flow va directo al dashboard sin pedir password

**Síntoma:** usuario click en "Restablecer contraseña" → llega al dashboard
sin que le pidieran password nueva.

**Causa raíz documentada (Bug 13):** el callback redirige a `/set-password`
solo cuando `type === "invite"`. Para `type === "recovery"` iba directo a `/`.

**Fix:** en `/api/auth/callback/route.ts`:

```typescript
const needsPasswordSet =
  type === "invite" || type === "recovery";  // ← incluir recovery

const redirect = needsPasswordSet
  ? `/set-password?from=${type}`
  : '/';
```

---

## 9. Migración a otro proveedor SMTP

Si en el futuro hay que cambiar de Resend a otro (SendGrid, Postmark, AWS SES, etc.):

### Pasos

1. **Crear cuenta en el nuevo proveedor** + verificar dominio
   `dashboardcomercialsusazon.com` (DKIM/SPF/DMARC en GoDaddy).

2. **Generar API key** en el nuevo proveedor con permiso de envío.

3. **Reemplazar config SMTP en Supabase Dashboard:**
   - Project Settings → Authentication → SMTP Settings
   - Cambiar Host, Port, Username, Password al del nuevo proveedor.
   - Save.

4. **Send test email** desde Supabase Dashboard → debe llegar con el
   nuevo proveedor.

5. **Verificar los 3 flows:**
   - Invitar usuario de prueba (gmail personal está bien) → email debe
     llegar con templates Editorial.
   - Reset password → email debe llegar.
   - Magic link (si lo usás) → email debe llegar.

6. **Actualizar SECRETS:**
   - `~/Downloads/SECRETS_DASHBOARD_V3.txt` § 10 → cambiar Resend por el nuevo.

7. **Cancelar cuenta de Resend** (después de 1 semana de operar OK con el
   nuevo, por si hay que rollback).

### Lista de proveedores compatibles con SMTP

Cualquiera que dé credenciales SMTP estándar. Verificar:

- Soporta SMTP en puerto 465 (SSL) o 587 (TLS/STARTTLS).
- Acepta autenticación con username + password (o API key como password).
- Permite "from" arbitrario (o requiere domain verification).

---

## 10. Decisiones de arquitectura

Detalle completo en `docs/SESSION_LOG.md`. Resumen:

### D009 — Custom SMTP Resend
- **Por qué:** rate limit de email default de Supabase es 3-4/hora en
  todos los planes.
- **Alternativa rechazada:** quedarse con default + esperar.
- **Estado:** vigente.

### D010 — Custom domain con redirect apex → www
- **Por qué:** profesionalismo + branding + SEO.
- **Alternativa rechazada:** usar solo `dashboard-susazon-v3-44sp.vercel.app`.
- **Estado:** vigente.

### D012 — Sidebar collapsible (no es de auth pero relacionado a UX)

### Bug 10 — Site URL = localhost
- **Causa:** Supabase venía con default `localhost:3000`.
- **Fix:** actualizar Site URL a la URL canonical antes de invitar usuarios.

### Bug 11 — Loop /set-password ↔ /login
- **Causa:** `/set-password` no estaba en public routes del proxy.
- **Fix:** agregar a `isPublicRoute` en `proxy.ts`.

### Bug 12 — "Auth session missing!"
- **Causa:** exchange en Server Component, no puede setear cookies.
- **Fix:** mover exchange a Route Handler `/api/auth/callback`.

### Bug 13 — Recovery iba directo al dashboard
- **Causa:** callback solo redirigía a `/set-password` para `type=invite`.
- **Fix:** incluir `type=recovery` en `needsPasswordSet`.

### Bug 18 — "Email rate limit exceeded"
- **Causa:** email default de Supabase + quería invitar 14 usuarios.
- **Fix:** configurar Resend SMTP custom.

---

## 11. Glosario rápido

| Término | Qué es |
|---|---|
| **Magic Link** | Login sin password vía link en email. NO se usa actualmente en este proyecto (usamos email + password). |
| **OTP** | One-time password. Token de 6 dígitos enviado por email. NO se usa en este proyecto. |
| **PKCE** | Proof Key for Code Exchange. Flow de OAuth que usa `?code=`. Lo usa nuestro callback. |
| **Token Hash** | Otro formato de exchange. Usa `?token_hash=&type=`. También soportado en nuestro callback. |
| **Service Role** | API key de Supabase que bypass RLS. SOLO server-side, NUNCA al browser. Usada en `lib/supabase/admin.ts` para operaciones admin (invite, delete user). |
| **Anon Key** | API key pública, RLS aplica. Va al browser. En `lib/supabase/client.ts`. |
| **RLS** | Row-Level Security. Postgres aplica filtros automáticos según `auth.uid()` y políticas de cada tabla. |

---

## 12. Recursos externos

- **Supabase Auth docs:** https://supabase.com/docs/guides/auth
- **Resend docs:** https://resend.com/docs
- **Supabase Custom SMTP:** https://supabase.com/docs/guides/auth/auth-smtp
- **Supabase Email Templates:** https://supabase.com/docs/guides/auth/auth-email-templates
- **Next.js Server Components vs Route Handlers:** https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

**Última actualización:** 2026-05-01 — Cierre de fase 3 + creación inicial del doc.
