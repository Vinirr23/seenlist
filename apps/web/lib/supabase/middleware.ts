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
// FASE 2 (2026-10-21, Lote 3) — "/download" e "/delete-account" nunca
// estiveram nesta lista, mesmo fazendo parte do que foi explicitamente
// decidido MANTER público nesta fase (download do app e exclusão de
// conta). Mesmo bug de categoria já documentado acima pra "/privacy"/
// "/terms": qualquer visitante sem sessão caía em "/login" antes de
// "/download"/"/delete-account" sequer renderizar.
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/download",
  "/delete-account",
  "/login",
  "/register",
  "/forgot-password",
  "/beta",
];
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
 * /register, /forgot-password, /auth/callback (troca de código por
 * sessão), /u/* (perfil público), /r/* (review compartilhada e suas
 * imagens) e /title/* (ficha pública de filme/série, SEO). Tudo o
 * mais é privado por padrão (/series, /movies, /library, /profile,
 * /explore e as rotas de detalhe) — a regra vale pra qualquer rota
 * nova sem precisar tocar no middleware de novo.
 */
/**
 * FASE 2 (2026-10-21, Lote 3) — rotas que NUNCA precisam que este
 * middleware chame `supabase.auth.getUser()` (nem, portanto, tente
 * renovar cookie de sessão), porque confirmei, lendo o código de cada
 * uma, que nenhuma lê sessão do lado servidor nem depende dessa
 * renovação:
 *
 * - Páginas institucionais ("/", "/about", "/privacy", "/terms",
 *   "/download", "/delete-account"): nenhuma faz `createClient()` do
 *   lado servidor.
 * - "/beta" (`app/beta/page.tsx`): o único acesso a dado é um
 *   `insert` anônimo em `beta_signups`, feito com o cliente do
 *   NAVEGADOR (`lib/supabase/client.ts`), nunca do servidor.
 * - "/auth/callback" (`app/auth/callback/route.ts`): Route Handler
 *   que faz sua PRÓPRIA troca de código por sessão e grava seus
 *   próprios cookies — ao contrário de um Server Component, um Route
 *   Handler consegue persistir cookie sozinho (ver o `try/catch` em
 *   `lib/supabase/server.ts`), não depende de nada que este
 *   middleware tenha feito antes.
 * - "/auth/mobile-bridge" (`app/auth/mobile-bridge/page.tsx`): Client
 *   Component que usa o cliente do NAVEGADOR e chama `setSession()`
 *   direto no armazenamento da WebView — nunca toca no cookie do lado
 *   servidor que este middleware gerencia.
 * - As 4 famílias de API antiga (`/api/tmdb/*`, `/api/anime/
 *   characters`, `/api/search`, `/api/season-recap/*`): já
 *   documentado abaixo, em `isPublicRoute` — puro repasse pro TMDB/
 *   AniList/Jikan, nenhuma leitura de sessão.
 * - "/monitoring": túnel do Sentry, só repassa telemetria do SDK.
 *
 * DELIBERADAMENTE DE FORA desta lista (continuam chamando
 * `getUser()` normalmente, sem nenhuma mudança de comportamento):
 *
 * - "/forgot-password": é pública, mas `ForgotPasswordPage`
 *   (`app/(auth)/forgot-password/page.tsx`) é um Server Component que
 *   faz sua PRÓPRIA leitura de sessão (`getUser()`) pra decidir entre
 *   mostrar o formulário de pedir recuperação ou o de definir senha
 *   nova — e o próprio comentário em `lib/supabase/server.ts` admite
 *   que um Server Component NÃO consegue persistir um cookie renovado
 *   sozinho ("pode ignorar aqui porque o middleware já cuida de
 *   renovar a sessão a cada request"). Pular a renovação aqui
 *   quebraria exatamente a premissa que hoje torna isso seguro — uma
 *   sessão de recuperação parada tempo suficiente nesta tela correria
 *   o risco de usar um token expirado na hora de `updatePassword`
 *   (Server Action). Continua verificando sessão nesta rota.
 * - "/u/*", "/r/*", "/title/*": são públicas, mas eu NÃO abri o
 *   código de cada uma nesta auditoria pra confirmar que nenhuma lê
 *   sessão do lado servidor (ex. pra mostrar algo diferente pro dono
 *   do perfil) — por precaução, ficam fora do pulo, continuam
 *   chamando `getUser()` exatamente como já faziam.
 */
const SKIP_SESSION_CHECK_ROUTES = new Set(["/", "/about", "/privacy", "/terms", "/download", "/delete-account", "/beta"]);

function skipsSessionCheck(pathname: string): boolean {
  return (
    SKIP_SESSION_CHECK_ROUTES.has(pathname) ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/mobile-bridge") ||
    pathname.startsWith("/api/tmdb/") ||
    pathname.startsWith("/api/anime/characters") ||
    pathname.startsWith("/api/search") ||
    pathname.startsWith("/api/season-recap/") ||
    pathname.startsWith("/monitoring")
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (skipsSessionCheck(pathname)) {
    return NextResponse.next({ request });
  }

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

  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname === route) ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/mobile-bridge") || // TASK-079: recebe os tokens vindos do app nativo, antes de qualquer sessão existir nesse contexto de navegação
    pathname.startsWith("/u/") || // TASK-028: perfil público, precisa funcionar sem login
    /**
     * BUG REAL CORRIGIDO (2026-10-09, causa raiz de "Não foi possível
     * carregar a prévia" no compartilhamento de reviews) — `/r/` (a
     * página de review compartilhada, `/r/[reviewId]/opengraph-image`
     * e `/r/[reviewId]/story-image`) nunca entrou nesta lista, mesmo
     * essas três rotas existindo justamente pra funcionar SEM login
     * (compartilhamento público — mesmo motivo do `/u/` logo acima).
     * Resultado: qualquer requisição sem cookie de sessão — o
     * rastreador do WhatsApp/X, o Google, e principalmente o PRÓPRIO
     * APP NATIVO (a sessão do app mobile vive em `AsyncStorage`, nunca
     * em cookie de navegador — mesmo motivo já documentado abaixo pra
     * `/api/tmdb/*` e `/api/season-recap/*`) — recebia um redirect 307
     * pro HTML da tela de login em vez do PNG/página real. No app, o
     * decodificador nativo de imagem tentava interpretar esse HTML
     * como PNG e falhava ("Downloaded image decode failed") — o
     * download "funcionava", só que o conteúdo nunca era uma imagem.
     * Confirmado via inspeção direta da resposta HTTP (HTML de login,
     * não PNG) antes da correção.
     */
    pathname.startsWith("/r/") ||
    /**
     * A PEDIDO (2026-10-09 — SEO Fase 2, "Opção A": páginas públicas
     * de filme/série independentes de `/movies/[id]`/`/series/[id]`,
     * que CONTINUAM exigindo login, sem nenhuma mudança). Mesmo motivo
     * do `/u/`/`/r/` acima: sem esta exceção, o Googlebot (e qualquer
     * visitante sem sessão) cairia em `/login` ao abrir
     * `/title/movie/[id]`/`/title/series/[id]`, impedindo a indexação
     * que é o objetivo inteiro dessas rotas existirem.
     */
    pathname.startsWith("/title/") ||
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
    /**
     * A PEDIDO (2026-10-09 — SEO Fase 2, achado validando `/title/movie|
     * series/[id]` em produção) — `CastCarousel` (rodando como Client
     * Component em QUALQUER página, incluindo as públicas novas) chama
     * esta rota pra trocar foto de dublador por foto de personagem em
     * animes; sem esta exceção, visitante sem sessão (incluindo o
     * Googlebot) recebia 401 aqui. Não quebrava nada visualmente — o
     * próprio `useAnimeCharacters` já trata falha de rede/autorização
     * caindo pro elenco normal do TMDB (`searchFailed: true`) — mas
     * fichas públicas de anime nunca mostravam a foto certa do
     * personagem pra quem não tem conta.
     *
     * Auditoria antes de liberar (pedido explícito do usuário):
     * `app/api/anime/characters/route.ts` só lê os parâmetros `title`/
     * `year` da própria URL e repassa pro AniList/Jikan (bancos de
     * dados públicos de anime) — nenhuma leitura de sessão, cookie,
     * Supabase ou qualquer dado do usuário em nenhum dos três arquivos
     * (`route.ts`, `lib/anime/jikan.ts`, `lib/anime/anilist.ts`).
     * Controle de abuso: esta rota NÃO tem rate-limit próprio — mas
     * nenhuma outra rota pública já existente tem (`/api/search`,
     * `/api/tmdb/*`, ambas já expostas sem autenticação, mesmo
     * repassando texto livre de busca pra fora) — abrir esta aqui
     * mantém exatamente a mesma postura de risco já aceita pra elas,
     * não introduz uma categoria nova. Mitigações que já existem:
     * `useAnimeCharacters` cacheia por 30 dias por título+ano no
     * navegador (não repete a mesma busca), e `fetchJikan` limita a
     * no máximo 3 tentativas por requisição.
     */
    pathname.startsWith("/api/anime/characters") ||
    // TASK-094 (app nativo — Explorar) — mesma razão do /api/tmdb/*
    // acima: só repassa busca ao TMDB, nenhum dado de usuário.
    pathname.startsWith("/api/search") ||
    /**
     * TASK (Resumo da Temporada) — BUG REAL encontrado em teste real no
     * celular (print de log da Vercel, 2026-10-07): `GET
     * /api/season-recap/[seriesId]/[season]` voltava 401 direto do
     * middleware, antes mesmo de chegar no handler da rota — EXATAMENTE
     * o mesmo bug do TASK-091 acima (`/api/tmdb/*`), que eu deveria ter
     * replicado desde o início e esqueci: o app nativo não manda cookie
     * de sessão nenhum (a sessão dele vive no AsyncStorage, não em
     * cookie de navegador), então toda rota de API chamada pelo mobile
     * sem dado de usuário nenhum precisa dessa exceção explícita. Esta
     * rota só repassa overview do TMDB + texto gerado por IA a partir
     * dele — nenhum dado de usuário entra ou sai daqui (ver
     * `SeasonRecapAiInput` em `lib/ai/types.ts`).
     */
    pathname.startsWith("/api/season-recap/") ||
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
    // FASE 2 (2026-10-21) — "/series" está sendo descontinuado; quem já
    // está logado e tenta abrir /login ou /register agora cai em
    // /download em vez de numa página que vai deixar de existir.
    return NextResponse.redirect(new URL("/download", request.url));
  }

  return response;
}
