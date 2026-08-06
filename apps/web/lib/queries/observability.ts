import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A PEDIDO — dashboard de observabilidade. Coleta as métricas
 * direto das tabelas que o app JÁ tem, sem depender de nenhuma
 * ferramenta externa (Sentry/PostHog seguem valendo pro que este
 * dashboard não cobre: erro de runtime e crash nativo).
 *
 * Roda só no servidor, com a chave de serviço (ignora RLS, porque
 * precisa contar linha de todo mundo, não só do admin logado). A
 * página que chama isto já checa `ADMIN_EMAIL` antes.
 *
 * Todas as consultas usam `head: true` + `count: "exact"` — o
 * Postgres devolve só o NÚMERO, nunca as linhas. Mesmo com a base
 * crescendo, o custo continua baixo e nenhum dado pessoal trafega.
 */
export interface ObservabilityMetrics {
  users: { total: number; activeToday: number; active7d: number; active30d: number; newLast7d: number };
  platform: { mobileInstalls: number; mobileActive30d: number; android: number; ios: number };
  activity: { episodesToday: number; episodes7d: number; reviews7d: number; posts7d: number };
  social: { follows: number; recommendations7d: number; comments7d: number };
  health: { pendingReports: number; feedbackTotal: number; feedbackLast7d: number };
  library: { seriesTracked: number; moviesTracked: number; watchedEpisodes: number };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export async function fetchObservabilityMetrics(): Promise<ObservabilityMetrics> {
  const supabase = createAdminClient();
  const today = startOfTodayIso();
  const d7 = daysAgoIso(7);
  const d30 = daysAgoIso(30);

  /**
   * "Ativo" aqui NÃO é login — é atividade de verdade (marcou
   * episódio). Login sozinho não diz muita coisa: dá pra abrir o app,
   * não fazer nada e sair. Como `watched_episodes` é a ação mais
   * comum do app, ela é o melhor sinal barato de uso real.
   *
   * Limitação conhecida, pra não interpretar errado: quem só navega e
   * avalia filme (sem marcar episódio) não conta aqui. É um piso, não
   * o número exato de usuários ativos.
   */
  /**
   * Tipo inferido do próprio cliente (em vez de `any`, que a regra de
   * lint do projeto proíbe — e com razão: `any` aqui esconderia erro
   * de digitação em nome de coluna nos filtros abaixo).
   */
  type CountQuery = ReturnType<ReturnType<typeof supabase.from>["select"]>;

  const count = (table: string, build: (q: CountQuery) => CountQuery) =>
    build(supabase.from(table).select("*", { count: "exact", head: true }));

  const [
    totalUsers,
    activeToday,
    active7d,
    active30d,
    newUsers7d,
    episodesToday,
    episodes7d,
    reviews7d,
    posts7d,
    follows,
    recommendations7d,
    comments7d,
    pendingReports,
    feedbackTotal,
    feedbackLast7d,
    seriesTracked,
    moviesTracked,
    watchedEpisodes,
    mobileInstalls,
    mobileActive30d,
    androidTokens,
    iosTokens,
  ] = await Promise.all([
    count("profiles", (q) => q),
    count("watched_episodes", (q) => q.gte("watched_at", today)),
    count("watched_episodes", (q) => q.gte("watched_at", d7)),
    count("watched_episodes", (q) => q.gte("watched_at", d30)),
    count("profiles", (q) => q.gte("created_at", d7)),
    count("watched_episodes", (q) => q.gte("watched_at", today)),
    count("watched_episodes", (q) => q.gte("watched_at", d7)),
    count("reviews", (q) => q.gte("created_at", d7).is("deleted_at", null)),
    count("posts", (q) => q.gte("created_at", d7).is("deleted_at", null)),
    count("follows", (q) => q),
    count("recommendations", (q) => q.gte("created_at", d7)),
    count("comments", (q) => q.gte("created_at", d7).is("deleted_at", null)),
    count("post_reports", (q) => q),
    count("user_feedback", (q) => q),
    count("user_feedback", (q) => q.gte("created_at", d7)),
    count("series_status", (q) => q.neq("status", "removed")),
    count("movie_status", (q) => q),
    count("watched_episodes", (q) => q),
    /**
     * Web vs mobile — o app mobile usa o MESMO banco e as mesmas
     * tabelas do site, sem marcar de onde veio a ação, então não dá
     * pra separar por ação. `push_tokens` é o melhor sinal que já
     * existe: só é gravado por quem instalou o app e permitiu
     * notificação, com `platform` e `last_seen_at` próprios.
     *
     * Limitação importante pra não interpretar errado: quem usa o
     * app mas RECUSOU notificação não aparece aqui. É um piso do
     * número de usuários mobile, não o total. Pra medir com
     * precisão seria preciso gravar a origem em cada ação (ou usar
     * uma ferramenta de produto tipo PostHog) — decisão maior, fora
     * do escopo deste painel.
     */
    count("push_tokens", (q) => q),
    count("push_tokens", (q) => q.gte("last_seen_at", d30)),
    count("push_tokens", (q) => q.eq("platform", "android")),
    count("push_tokens", (q) => q.eq("platform", "ios")),
  ]);

  const n = (r: { count: number | null }) => r.count ?? 0;

  return {
    users: {
      total: n(totalUsers),
      activeToday: n(activeToday),
      active7d: n(active7d),
      active30d: n(active30d),
      newLast7d: n(newUsers7d),
    },
    activity: {
      episodesToday: n(episodesToday),
      episodes7d: n(episodes7d),
      reviews7d: n(reviews7d),
      posts7d: n(posts7d),
    },
    social: {
      follows: n(follows),
      recommendations7d: n(recommendations7d),
      comments7d: n(comments7d),
    },
    health: {
      pendingReports: n(pendingReports),
      feedbackTotal: n(feedbackTotal),
      feedbackLast7d: n(feedbackLast7d),
    },
    platform: {
      mobileInstalls: n(mobileInstalls),
      mobileActive30d: n(mobileActive30d),
      android: n(androidTokens),
      ios: n(iosTokens),
    },
    library: {
      seriesTracked: n(seriesTracked),
      moviesTracked: n(moviesTracked),
      watchedEpisodes: n(watchedEpisodes),
    },
  };
}
