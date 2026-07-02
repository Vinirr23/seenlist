import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];
// /login e /register não fazem sentido pra quem já está logado — mandamos
// pra "/". /forgot-password fica de fora dessa lista de propósito: depois
// de clicar no link do e-mail de recuperação, o usuário chega aqui com uma
// sessão "de recuperação" ativa (para poder definir a nova senha) — se
// redirecionássemos por estar "autenticado", a troca de senha nunca
// aconteceria.
const REDIRECT_IF_AUTHENTICATED_ROUTES = ["/login", "/register"];

/**
 * Roda a cada request: renova a sessão (refresh token) e decide se a
 * rota atual precisa de autenticação. Rotas públicas: /login,
 * /register, /forgot-password e /auth/callback (troca de código por
 * sessão). Tudo o mais é privado — hoje só existe "/", mas a regra
 * vale para qualquer rota futura sem precisar tocar no middleware de
 * novo.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname === route) || pathname.startsWith("/auth/callback");

  if (!user && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && REDIRECT_IF_AUTHENTICATED_ROUTES.some((route) => pathname === route)) {
    return NextResponse.redirect(new URL("/series", request.url));
  }

  return response;
}
