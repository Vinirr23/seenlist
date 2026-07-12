import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/beta"];
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
 * sessão). Tudo o mais é privado por padrão (/series, /movies,
 * /library, /profile, /explore e as rotas de detalhe) — a regra vale
 * pra qualquer rota nova sem precisar tocar no middleware de novo.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname === route) ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/mobile-bridge") || // TASK-079: recebe os tokens vindos do app nativo, antes de qualquer sessão existir nesse contexto de navegação
    pathname.startsWith("/u/") || // TASK-028: perfil público, precisa funcionar sem login
    /**
     * TASK-091 (app nativo) — nenhuma rota debaixo de /api/tmdb/*
     * usa dado de usuário nenhum (só repassa o TMDB: filme, série,
     * episódio, resumos da Biblioteca, busca) — mas sem essa exceção
     * o middleware bloqueava QUALQUER chamada sem cookie de sessão
     * com 401. Isso nunca dava problema no site (o navegador sempre
     * manda os cookies junto, automaticamente), mas sempre acontecia
     * vindo do app nativo: o `fetch()` nativo não tem cookie de
     * navegador nenhum pra mandar — a sessão do app mobile vive no
     * AsyncStorage, não em cookie. O sintoma era silencioso demais
     * pra perceber sem olhar o log: a Biblioteca carregava normal
     * (RLS do Supabase, chamada direta), só faltava poster/título,
     * porque essa chamada específica voltava 401 e o código, de
     * propósito, não trava a tela nesse caso — só mostra sem
     * decoração nenhuma.
     */
    pathname.startsWith("/api/tmdb/");

  if (!user && !isPublicRoute) {
    // Rotas de API: quem chama é `fetch()` do client, não o navegador
    // navegando de verdade. Redirecionar mandaria de volta o HTML da
    // tela de login como se fosse a resposta da API — o `.json()` de
    // quem chamou quebraria de um jeito confuso. Uma sessão pode
    // expirar enquanto a página já está aberta, então isso acontece
    // de verdade, não é só teórico.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && REDIRECT_IF_AUTHENTICATED_ROUTES.some((route) => pathname === route)) {
    return NextResponse.redirect(new URL("/series", request.url));
  }

  return response;
}
