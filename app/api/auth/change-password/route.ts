import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePassword } from "@/lib/password-utils";

interface ChangePasswordBody {
  current_password: string;
  new_password: string;
}

/**
 * POST /api/auth/change-password
 *
 * Endpoint para que un usuario autenticado cambie su propia contraseña.
 *
 * Pasos:
 *   1. Verificar sesión activa (sino → 401).
 *   2. Validar `current_password` con signInWithPassword (re-auth para
 *      asegurar que sea realmente el usuario, no alguien con la sesión
 *      en una pestaña abierta).
 *   3. Validar `new_password` con política (mínimo 8 chars).
 *   4. updateUser({ password: new_password }) vía sesión del usuario.
 *   5. Si el usuario tenía `user_metadata.must_change_password=true`,
 *      limpiar el flag con admin client (usuario no puede modificar su
 *      propio user_metadata directamente, requiere service role).
 *   6. Audit log.
 *
 * Body: { current_password, new_password }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json(
      { error: "Sesión no válida. Vuelve a iniciar sesión." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as Partial<ChangePasswordBody> | null;
  if (
    !body ||
    typeof body.current_password !== "string" ||
    typeof body.new_password !== "string"
  ) {
    return NextResponse.json(
      { error: "Body inválido: requiere current_password y new_password" },
      { status: 400 }
    );
  }

  // 1. Validar política de la contraseña nueva
  const validation = validatePassword(body.new_password);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // 2. La nueva no puede ser igual a la actual
  if (body.new_password === body.current_password) {
    return NextResponse.json(
      { error: "La nueva contraseña debe ser distinta a la actual." },
      { status: 400 }
    );
  }

  // 3. Re-autenticar con la contraseña actual.
  //    Esto valida que sea realmente el usuario (no alguien con sesión robada).
  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: body.current_password,
  });
  if (reAuthError) {
    return NextResponse.json(
      { error: "Contraseña actual incorrecta." },
      { status: 400 }
    );
  }

  // 4. Cambiar la contraseña usando la sesión del usuario
  const { error: updateError } = await supabase.auth.updateUser({
    password: body.new_password,
  });
  if (updateError) {
    return NextResponse.json(
      { error: `Error al cambiar contraseña: ${updateError.message}` },
      { status: 500 }
    );
  }

  // 5. Limpiar must_change_password si estaba activo.
  //    Usamos admin client porque user_metadata no se puede modificar via
  //    sesión cliente (solo el service role tiene permiso).
  const admin = createSupabaseAdminClient();
  const flagWasSet = (user.user_metadata as { must_change_password?: boolean } | null)
    ?.must_change_password === true;
  if (flagWasSet) {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        must_change_password: false,
      },
    });
  }

  // 6. Audit log
  await admin.from("audit_log").insert({
    user_id: user.id,
    user_email: user.email,
    action: "user_updated",
    details: {
      event: "password_change_by_user",
      cleared_must_change_flag: flagWasSet,
    },
  });

  return NextResponse.json({
    ok: true,
    cleared_must_change: flagWasSet,
  });
}
