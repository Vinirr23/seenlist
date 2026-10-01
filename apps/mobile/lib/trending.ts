import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummariesCached } from "@/lib/library";

export interface TrendingItem {
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  mediaPosterPath: string | null;
  watcherCount: number;
}

export interface FriendWatcher {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface FriendsWatchingItem {
  mediaId: number;
  mediaTitle: string;
  mediaPosterPath: string | null;
  watchers: FriendWatcher[];
  totalCount: number;
}

const TRENDING_WINDOW_DAYS = 7;
const TRENDING_ROW_LIMIT = 300;
const TRENDING_RESULT_LIMIT = 6;

interface StatusRow {
  user_id: string;
  media_id: number;
}

/**
 * "EM ALTA NO SEENLIST" (2026-10-01, documento de UX — módulo de
 * "quebra de padrão" a cada alguns posts) — GLOBAL de propósito (ao
 * contrário de `fetchActivityFeed`, que tem a opção "following"): o
 * ponto de "em alta" é mostrar o que a comunidade INTEIRA está
 * assistindo, não só quem você segue — mesma régua já usada pra
 * `fetchActivityFeed(scope: "forYou")`. Sem tabela nova: conta
 * linhas de `series_status`/`movie_status` com status "watching" ou
 * "terminado" (`completed`/`watched`, enums diferentes por mídia —
 * mesmo detalhe corrigido em `lib/activityFeed.ts`) atualizadas nos
 * últimos 7 dias — cada linha já é 1 usuário por mídia (chave
 * primária composta), então contar linhas = contar pessoas, sem
 * precisar de `DISTINCT` nem de buscar o `user_id` de cada uma.
 * `TRENDING_ROW_LIMIT` (300 por tabela) é generoso pro tamanho atual
 * do app (base de ~383 usuários, ver comentário em
 * `lib/activityFeed.ts` antigo) — revisar se a base crescer muito.
 */
export async function fetchTrendingMedia(language = "pt-BR"): Promise<TrendingItem[]> {
  const since = new Date();
  since.setDate(since.getDate() - TRENDING_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const [seriesResult, movieResult] = await Promise.all([
    supabase
      .from("series_status")
      .select("user_id, series_id")
      .in("status", ["watching", "completed"])
      .gte("updated_at", sinceIso)
      .limit(TRENDING_ROW_LIMIT),
    supabase
      .from("movie_status")
      .select("user_id, movie_id")
      .in("status", ["watching", "watched"])
      .gte("updated_at", sinceIso)
      .limit(TRENDING_ROW_LIMIT),
  ]);
  if (seriesResult.error) throw seriesResult.error;
  if (movieResult.error) throw movieResult.error;

  const seriesCounts = countByMediaId((seriesResult.data ?? []).map((r) => ({ user_id: r.user_id, media_id: r.series_id })));
  const movieCounts = countByMediaId((movieResult.data ?? []).map((r) => ({ user_id: r.user_id, media_id: r.movie_id })));

  const topSeriesIds = topEntries(seriesCounts, TRENDING_RESULT_LIMIT);
  const topMovieIds = topEntries(movieCounts, TRENDING_RESULT_LIMIT);

  const summaries = await fetchDisplaySummariesCached(
    topMovieIds.map(([id]) => id),
    topSeriesIds.map(([id]) => id),
    language
  );

  const items: TrendingItem[] = [];
  for (const [id, count] of topSeriesIds) {
    const summary = summaries.series[id];
    if (!summary) continue;
    items.push({ mediaType: "series", mediaId: id, mediaTitle: summary.title, mediaPosterPath: summary.posterPath, watcherCount: count });
  }
  for (const [id, count] of topMovieIds) {
    const summary = summaries.movies[id];
    if (!summary) continue;
    items.push({ mediaType: "movie", mediaId: id, mediaTitle: summary.title, mediaPosterPath: summary.posterPath, watcherCount: count });
  }

  return items.sort((a, b) => b.watcherCount - a.watcherCount).slice(0, TRENDING_RESULT_LIMIT);
}

function countByMediaId(rows: StatusRow[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.media_id, (counts.get(row.media_id) ?? 0) + 1);
  return counts;
}

function topEntries(counts: Map<number, number>, limit: number): [number, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

const FRIENDS_WATCHING_WINDOW_DAYS = 14;
// BUG REAL CORRIGIDO (2026-10-01, feedback de design — "parece que faltou
// carregar conteúdo") — era 5 (empilhado largo, card único). O card ficou
// mais estreito (3 em scroll horizontal, igual ao `FeedTrendingModule`),
// então o empilhado também encolheu — 3 avatares cabem sem espremer.
const FRIENDS_WATCHING_AVATAR_LIMIT = 3;
const FRIENDS_WATCHING_RESULT_LIMIT = 3;

interface FriendsStatusRow {
  user_id: string;
  series_id: number;
}

interface FriendsProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * "SEUS AMIGOS ESTÃO ASSISTINDO" (2026-10-01, documento de UX; layout
 * revisado no mesmo dia por feedback de design — "parece que faltou
 * carregar conteúdo", card único largo com 1 pôster pequeno "tinha
 * espaço demais pra pouca informação") — só SÉRIES (igual ao mockup
 * original — "assistindo" não faz tanto sentido pra filme, que não
 * tem episódio em andamento), só quem o usuário SEGUE, status
 * "watching" (em andamento, não terminado). Agrupa por série, ordena
 * pela que tem MAIS seguidos assistindo primeiro, devolve até
 * `FRIENDS_WATCHING_RESULT_LIMIT` séries (era só a primeira, 1 card) —
 * mesma régua do `fetchTrendingMedia`, pra caber num scroll horizontal
 * de verdade em `FeedFriendsWatchingModule.tsx`, não um card único.
 * `[]` quando o usuário não segue ninguém, ou ninguém que segue está
 * assistindo nada recente — módulo simplesmente não aparece (ver
 * `lib/useFeedEntries.ts`).
 */
export async function fetchFriendsWatching(): Promise<FriendsWatchingItem[]> {
  const {
    data: { user: viewer },
  } = await getCurrentAuthUser();
  if (!viewer) return [];

  const { data: followRows, error: followError } = await supabase.from("follows").select("following_id").eq("follower_id", viewer.id);
  if (followError) throw followError;
  const followedIds = (followRows ?? []).map((r) => r.following_id);
  if (followedIds.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - FRIENDS_WATCHING_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const { data, error } = await supabase
    .from("series_status")
    .select("user_id, series_id")
    .in("user_id", followedIds)
    .eq("status", "watching")
    .gte("updated_at", sinceIso)
    .limit(TRENDING_ROW_LIMIT);
  if (error) throw error;

  const rows = (data ?? []) as FriendsStatusRow[];
  if (rows.length === 0) return [];

  const bySeries = new Map<number, string[]>();
  for (const row of rows) {
    const list = bySeries.get(row.series_id) ?? [];
    list.push(row.user_id);
    bySeries.set(row.series_id, list);
  }

  const topSeries = [...bySeries.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, FRIENDS_WATCHING_RESULT_LIMIT);
  if (topSeries.length === 0) return [];

  const allAvatarUserIds = [...new Set(topSeries.flatMap(([, userIds]) => userIds.slice(0, FRIENDS_WATCHING_AVATAR_LIMIT)))];

  const [summaries, profilesResult] = await Promise.all([
    fetchDisplaySummariesCached(
      [],
      topSeries.map(([seriesId]) => seriesId)
    ),
    supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", allAvatarUserIds),
  ]);

  const profileById = new Map(((profilesResult.data ?? []) as FriendsProfileRow[]).map((p) => [p.user_id, p]));

  const items: FriendsWatchingItem[] = [];
  for (const [seriesId, userIds] of topSeries) {
    const summary = summaries.series[seriesId];
    if (!summary) continue;
    const watchers: FriendWatcher[] = userIds
      .slice(0, FRIENDS_WATCHING_AVATAR_LIMIT)
      .map((userId) => profileById.get(userId))
      .filter((p): p is FriendsProfileRow => !!p)
      .map((p) => ({ userId: p.user_id, name: p.display_name || p.username, avatarUrl: p.avatar_url }));
    items.push({ mediaId: seriesId, mediaTitle: summary.title, mediaPosterPath: summary.posterPath, watchers, totalCount: userIds.length });
  }
  return items;
}
