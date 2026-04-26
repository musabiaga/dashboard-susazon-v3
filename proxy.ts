import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (Next.js 16+, antes "middleware"): refresca la cookie de sesión
 * Supabase y protege rutas privadas.
 * Rutas públicas: /login, /api/auth/*, recursos estáticos.
 * Cualquier otra ruta requiere sesión activa.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Si Supabase no está configurado todavía, deja pasar sin auth (modo placeholder).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("PEGAR_AQUI")
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca sesión (toca getUser para mantener cookie viva)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg");

  // Sin sesión y ruta privada → redirige a /login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión y entrando a /login → redirige al dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth callback)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
