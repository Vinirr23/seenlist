import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummariesCached } from "@/lib/library";
import type { VerifiedTier } from "./publicProfile";
import type { FeedScope } from "./posts";

export type ActivityType = "completed" | "rated" | "watchlist";

export interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatarUrl: string | null;
  userVerifiedTier: VerifiedTier;
  activityType: ActivityType;
  mediaTitle: string;
  mediaPosterPath: string | null;
  mediaType: "movie" | "series";
  mediaId: number;
  rating: number | null;
  createdAt: string;
}

interface SeriesStatusActivityRow {
  user_id: string;
  series_id: number;
  status: string;
  updated_at: string;
}

interface MovieStatusActivityRow {
  user_id: string;
  movie_id: number;
  status: string;
  updated_at: string;
}

interface ReviewActivityRow {
  id: string;
  user_id: string;
  media_type: "movie" | "series";
  media_id: number;
  rating: number | string;
  created_at: string;
}

interface ActivityProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_tier?: VerifiedTier;
}

const ACTIVITY_WINDOW_DAYS = 7;
const LIMIT_PER_SOURCE_FOLLOWING = 15;
const LIMIT_PER_SOURCE_GLOBAL = 25;

/**
 * ACTIVITY CARDS NO FEED (2026-10-01, a pedido, documento de UX — "o
 * que falta no Feed é parecer vivo"; opção escolhida entre as
 * apresentadas: reaproveitar esta função em vez de criar posts de
 * verdade na tabela `posts`) — até aqui, isto alimentava SÓ a sub-aba
 * "Atividade" de Explorar (removida junto desta mudança, decisão
 * também explícita — ver `app/(tabs)/explore.tsx`), sempre filtrada
 * por quem o usuário segue, com TODOS os tipos de evento (status
 * começou/terminou/adicionou, avaliação, episódio assistido).
 *
 * MUDANÇAS, nesta ordem (todas decisões explícitas, não suposição):
 *
 * 1. `scope` novo parâmetro (mesmo tipo `FeedScope` de `lib/posts.ts`)
 *    — "following" mantém o comportamento de sempre (só quem você
 *    segue); "forYou" busca de QUALQUER usuário (sem filtro de
 *    `follows`) — só pra esta tela, a aba "Para você" do Feed.
 * 2. Só 3 tipos de evento viram card (decisão explícita: sem card por
 *    episódio assistido, aconteceria demais vezes por dia): série/
 *    filme TERMINADO, avaliação nova, e adicionado à watchlist
 *    ("want_to_watch"). A consulta de `watched_episodes` saiu inteira.
 * 3. BUG REAL CORRIGIDO (achado ao mexer aqui, não pedido original) —
 *    o branch de filme comparava `row.status === "completed"`, mas o
 *    enum de `movie_status.status` é `"watched" | "want_to_watch" |
 *    "watching"` — valor DIFERENTE do de série (`LibraryStatus`, que
 *    usa `"completed"`). Essa comparação nunca batia: todo filme
 *    assistido até agora virava "adicionou" por engano, tanto aqui
 *    quanto na aba Atividade antiga. Corrigido comparando com
 *    `"watched"` (valor real do enum de filme).
 * 4. `fetchDisplaySummaries` → `fetchDisplaySummariesCached` (mesmo
 *    cache com TTL já usado por outras telas de biblioteca) — Feed
 *    busca isso toda vez que troca de aba sem cache ainda (ver
 *    `useFeedEntries.ts`), então vale evitar bater 2x no TMDB pros
 *    mesmos títulos que outra tela já buscou há pouco.
 * 5. `userVerifiedTier` novo campo (mesmo padrão de `lib/posts.ts`) —
 *    o card rico mostra o selo de verificado igual ao post normal.
 */
export async function fetchActivityFeed(scope: FeedScope = "following", language = "pt-BR"): Promise<ActivityItem[]> {
  const {
    data: { user: viewer },
  } = await getCurrentAuthUser();
  if (!viewer) return [];

  let followedIds: string[] | null = null;
  if (scope === "following") {
    const { data: followRows, error: followError } = await supabase.from("follows").select("following_id").eq("follower_id", viewer.id);
    if (followError) throw followError;
    followedIds = (followRows ?? []).map((r) => r.following_id);
    if (followedIds.length === 0) return []; // não segue ninguém ainda
  }

  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);
  const sinceIso = since.toISOString();
  const limit = scope === "following" ? LIMIT_PER_SOURCE_FOLLOWING : LIMIT_PER_SOURCE_GLOBAL;

  let seriesQuery = supabase
    .from("series_status")
    .select("user_id, series_id, status, updated_at")
    .in("status", ["completed", "want_to_watch"])
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (followedIds) seriesQuery = seriesQuery.in("user_id", followedIds);

  let movieQuery = supabase
    .from("movie_status")
    .select("user_id, movie_id, status, updated_at")
    .in("status", ["watched", "want_to_watch"])
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (followedIds) movieQuery = movieQuery.in("user_id", followedIds);

  /*
   * BUG REAL CORRIGIDO (2026-10-01, reportado — "avaliação da Irly não
   * pegou, aparece sem estrelas marcadas") — `reviews.rating` é
   * opcional DE PROPÓSITO desde a migration `20260810000000_episode_
   * reactions.sql`: a linha de review de um EPISÓDIO é criada já na
   * primeira interação pós-"assistido" (onde assistiu / humor /
   * personagem favorito), mesmo sem nota nenhuma ainda ("precisa
   * poder existir sem nota ainda", comentário da própria migration).
   * Esta consulta pegava TODAS as linhas de `reviews` sem filtrar
   * `rating`/`season_number`/`episode_number` — uma reação de episódio
   * sem nota virava card "avaliou [a série inteira]" com `Number(null)
   * = 0`, mostrando 5 estrelas vazias como se a nota tivesse "falhado
   * ao salvar", quando na real nunca existiu nota nenhuma ali. Dois
   * filtros novos: só linha com nota de verdade (`rating` não nulo) E
   * só review de SÉRIE/FILME INTEIRO (`season_number`/`episode_number`
   * nulos) — nota de episódio específico não vira "avaliou a série"
   * (seria impreciso mesmo com nota real).
   */
  let reviewQuery = supabase
    .from("reviews")
    .select("id, user_id, media_type, media_id, rating, created_at")
    .is("deleted_at", null)
    .not("rating", "is", null)
    .is("season_number", null)
    .is("episode_number", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (followedIds) reviewQuery = reviewQuery.in("user_id", followedIds);

  const [seriesStatusRows, movieStatusRows, reviewRows] = await Promise.all([seriesQuery, movieQuery, reviewQuery]);
  if (seriesStatusRows.error) throw seriesStatusRows.error;
  if (movieStatusRows.error) throw movieStatusRows.error;
  if (reviewRows.error) throw reviewRows.error;

  const typedSeriesRows = (seriesStatusRows.data ?? []) as SeriesStatusActivityRow[];
  const typedMovieRows = (movieStatusRows.data ?? []) as MovieStatusActivityRow[];
  const typedReviewRows = (reviewRows.data ?? []) as ReviewActivityRow[];

  const userIds = new Set<string>();
  [typedSeriesRows, typedMovieRows, typedReviewRows].forEach((rows) => rows.forEach((r) => userIds.add(r.user_id)));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, verified_tier")
    .in("user_id", [...userIds]);
  const profileById = new Map(((profiles ?? []) as ActivityProfileRow[]).map((p) => [p.user_id, p]));

  const movieIds = [
    ...new Set([
      ...typedMovieRows.map((r) => r.movie_id),
      ...typedReviewRows.filter((r) => r.media_type === "movie").map((r) => r.media_id),
    ]),
  ];
  const seriesIds = [
    ...new Set([
      ...typedSeriesRows.map((r) => r.series_id),
      ...typedReviewRows.filter((r) => r.media_type === "series").map((r) => r.media_id),
    ]),
  ];

  const summaries = await fetchDisplaySummariesCached(movieIds, seriesIds, language);

  const items: ActivityItem[] = [];

  for (const row of typedSeriesRows) {
    const profile = profileById.get(row.user_id);
    const summary = summaries.series[row.series_id];
    if (!profile || !summary) continue;
    items.push({
      id: `series-status-${row.user_id}-${row.series_id}-${row.updated_at}`,
      userId: row.user_id,
      userName: profile.display_name || profile.username,
      userUsername: profile.username,
      userAvatarUrl: profile.avatar_url,
      userVerifiedTier: profile.verified_tier ?? null,
      activityType: row.status === "completed" ? "completed" : "watchlist",
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: "series",
      mediaId: row.series_id,
      rating: null,
      createdAt: row.updated_at,
    });
  }

  for (const row of typedMovieRows) {
    const profile = profileById.get(row.user_id);
    const summary = summaries.movies[row.movie_id];
    if (!profile || !summary) continue;
    items.push({
      id: `movie-status-${row.user_id}-${row.movie_id}-${row.updated_at}`,
      userId: row.user_id,
      userName: profile.display_name || profile.username,
      userUsername: profile.username,
      userAvatarUrl: profile.avatar_url,
      userVerifiedTier: profile.verified_tier ?? null,
      // Bug corrigido (ver comentário grande acima, item 3): "watched", não "completed".
      activityType: row.status === "watched" ? "completed" : "watchlist",
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: "movie",
      mediaId: row.movie_id,
      rating: null,
      createdAt: row.updated_at,
    });
  }

  for (const row of typedReviewRows) {
    const profile = profileById.get(row.user_id);
    const summary = row.media_type === "movie" ? summaries.movies[row.media_id] : summaries.series[row.media_id];
    if (!profile || !summary) continue;
    items.push({
      id: `review-${row.id}`,
      userId: row.user_id,
      userName: profile.display_name || profile.username,
      userUsername: profile.username,
      userAvatarUrl: profile.avatar_url,
      userVerifiedTier: profile.verified_tier ?? null,
      activityType: "rated",
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: row.media_type as "movie" | "series",
      mediaId: row.media_id,
      rating: Number(row.rating),
      createdAt: row.created_at,
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);
}
