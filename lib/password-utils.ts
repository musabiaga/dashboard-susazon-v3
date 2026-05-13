/**
 * lib/password-utils.ts — generador de contraseñas + validador.
 *
 * Usado por:
 *  - Admin Panel: generar contraseña aleatoria al invitar/resetear.
 *  - API endpoints: validar contraseñas antes de aceptarlas.
 *  - Pantalla Mi Cuenta: validar contraseña nueva del usuario.
 *
 * Política: mínimo 8 caracteres. Sin otras reglas (flexible para uso interno).
 */

/** Caracteres legibles — sin ambiguos (0/O, 1/l/I, 5/S). Fácil de transmitir
 *  por WhatsApp sin confusión. */
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ" + // sin I, O
  "abcdefghijkmnpqrstuvwxyz" + // sin l, o
  "23456789" + // sin 0, 1
  "!@#$%&*?+-"; // símbolos comunes (sin / \ ` ' " que rompen al copiar)

/**
 * Genera una contraseña aleatoria criptográficamente segura.
 * Default 12 chars: balance entre seguridad y facilidad de transmisión.
 *
 * Usa `crypto.getRandomValues()` que está disponible tanto en Browser
 * como en Node.js 20+ (Next.js 16 server-side).
 */
export function generatePassword(length = 12): string {
  if (length < 8) {
    throw new Error("Longitud mínima 8 caracteres");
  }
  const arr = new Uint32Array(length);
  // Funciona en browser y Node 20+ (Next.js 16)
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
  }
  return out;
}

/** Resultado de validación con mensaje legible. */
export type PasswordValidation =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Política: mínimo 8 caracteres. Sin otras reglas (Supabase Auth por
 * default pide 6; subimos a 8 para algo más razonable).
 */
export function validatePassword(pw: unknown): PasswordValidation {
  if (typeof pw !== "string") {
    return { ok: false, error: "La contraseña debe ser texto." };
  }
  if (pw.length < 8) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres.",
    };
  }
  if (pw.length > 128) {
    return {
      ok: false,
      error: "La contraseña no puede exceder 128 caracteres.",
    };
  }
  return { ok: true };
}
