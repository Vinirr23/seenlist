import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// CORREÇÃO (2026-09-04, a pedido — landing page em "/") — "/" entrou
// na lista: antes o middleware barrava qualquer visitante sem sessão
// ANTES mesmo de `app/page.tsx` rodar, mandando direto pra "/login"
// (raiz do "vai direto pra login" reportado) — "/" agora é público, e
// quem TEM sessão continua caindo em "/series" (`app/page.tsx` decide
// isso, não o middleware).
// CORREÇÃO (2026-09-04, a pedido — página "/about") — mesmo raciocínio
// do "/" acima: "/about" é a página pública que explica o que é o
// SeenList pra quem ainda não tem conta (link "Sobre" no rodapé, ver
// `components/landing/shared.tsx`) — sem essa entrada, o middleware
// mandava qualquer visitante sem sessão direto pra "/login" antes da
// página sequer renderizar.
// BUG REAL CORRIGIDO (2026-09-04, achado fazendo o SEO do site) —
// "/privacy" e "/terms" NUNCA estiveram nessa lista, então qualquer
// visitante deslogado (incluindo o Googlebot, que nunca tem cookie de
// sessão) era redirecionado pro "/login" ao tentar abrir essas
// páginas, mesmo elas já existindo e tendo conteúdo de verdade
// (`app/privacy/page.tsx`, `app/terms/page.tsx`). Duas consequências
// reais: o Google nunca conseguia indexar a política de privacidade
// nem os termos, e — mais grave — a Apple/Google normalmente exigem
// uma URL de política de privacidade PÚBLICA e acessível na hora de
// avaliar o app pra publicação; apontando pra uma URL que redireciona
// pro login, a submissão na App Store podia ser rejeitada por causa
// disso.
const PUBLIC_ROUTES = ["/", "/about", "/privacy", "/terms", "/login", "/register", "/forgot-password", "/beta"];
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
    pathname.startsWith("/api/tmdb/") ||
    // TASK-094 (app nativo — Explorar) — mesma razão do /api/tmdb/*
    // acima: só repassa busca ao TMDB, nenhum dado de usuário.
    pathname.startsWith("/api/search") ||
    /**
     * Sentry — túnel de erro do navegador (`tunnelRoute: "/monitoring"`
     * em next.config.mjs, criado pelo wizard oficial). O próprio
     * wizard avisa: "check that this route will not match your
     * middleware, otherwise reporting of client-side errors will
     * fail" — e batia aqui: sem esta exceção, qualquer pessoa
     * DESLOGADA (tela de login/cadastro, perfil público /u/...) teria
     * o erro dela redirecionado pro /login em vez de chegar no
     * Sentry, silenciosamente. Não expõe dado de usuário nenhum — só
     * repassa o payload de telemetria já pronto do SDK.
     */
    pathname.startsWith("/monitoring");

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
