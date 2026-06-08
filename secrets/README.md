# `secrets/` — Valores reales de credenciales

> ⚠️ Esta carpeta contiene (en la **copia física** del proyecto, NO en GitHub) los
> **VALORES REALES** de las credenciales: Supabase `service_role`, API keys de
> Susazón/Suve, Resend, etc. Está **gitignored** — lo único que se versiona es este
> README. Un `git clone` NO trae los valores; la carpeta física SÍ.

## Qué hay aquí (en la carpeta física)

| Archivo | Contenido |
|---|---|
| `SECRETS_DASHBOARD_V3.txt` | Inventario completo de todas las credenciales (copia del canónico). |
| `.env.local` | Variables de entorno runtime — incluye `DATABASE_URL` (connection string de Postgres). |

## Fuente canónica / dónde más viven

- **Canónico:** `~/Downloads/SECRETS_DASHBOARD_V3.txt` + **Apple Notes** (encriptada con
  biometría) / **1Password**.
- **Cómo OBTENER cada credencial** desde su servicio (Supabase, Vercel, GitHub, APIs,
  Resend, GoDaddy): ver [`docs/GUIA_OBTENER_SECRETS.md`](../docs/GUIA_OBTENER_SECRETS.md).

## Reglas (no negociables)

1. **NUNCA** quitar `secrets/` del `.gitignore`. Verificar con `git check-ignore secrets/SECRETS_DASHBOARD_V3.txt` (debe salir ignorado).
2. **NUNCA** pegar valores reales en código, docs committeados, ni en chats/transcripts.
3. La carpeta física es **sensible**: al compartir o comprimir el proyecto, estos valores van incluidos. Manejar con cuidado.
4. Si el `service_role` key se filtra → **rotarlo de inmediato** en Supabase → Settings → API, y actualizar Vercel + `.env.local`.
