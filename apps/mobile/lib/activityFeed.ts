import { supabase } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

export interface ActivityItem {
  id: string;
  userName: string;
  userAvatarUrl: string | null;
  action: string;
  mediaTitle: string;
  mediaPosterPath: string | null;
  mediaType: "movie" | "series";
  mediaId: number;
  createdAt: string;
}

const ACTIVITY_WINDOW_DAYS = 7;
const LIMIT_PER_SOURCE = 15;

/**
 * TASK-109 (Atividade) — porta de `activity-feed.ts`. Feed GLOBAL de
 * atividade pública (não é "só quem eu sigo" — nome da aba engana um
 * pouco; o próprio web funciona assim). Deriva de tabelas que já
 * existiam (`series_status`/`movie_status`/`reviews`/`watched_episodes`)
 * — nenhuma tabela de "activity" nova. Só perfis públicos aparecem
 * (a RLS de `profiles` já filtra isso no join).
 *
 * Limitação honesta herdada do web: não existe histórico de
 * transição de status — a ação é inferida do status ATUAL +
 * `updated_at` recente, não de um evento discreto registrado.
 */
export async function fetchActivityFeed(): Promise<ActivityItem[]> {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const [seriesStatusRows, movieStatusRows, reviewRows, episodeRows] = await Promise.all([
    supabase.from("series_status").select("user_id, series_id, status, updated_at").gte("updated_at", sinceIso).order("updated_at", { ascending: false }).limit(LIMIT_PER_SOURCE),
    supabase.from("movie_status").select("user_id, movie_id, status, updated_at").gte("updated_at", sinceIso).order("updated_at", { ascending: false }).limit(LIMIT_PER_SOURCE),
    supabase.from("reviews").select("user_id, media_type, media_id, rating, created_at").is("deleted_at", null).gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(LIMIT_PER_SOURCE),
    supabase.from("watched_episodes").select("user_id, series_id, watched_at").gte("watched_at", sinceIso).order("watched_at", { ascending: false }).limit(LIMIT_PER_SOURCE),
  ]);

  const userIds = new Set<string>();
  [seriesStatusRows.data, movieStatusRows.data, reviewRows.data, episodeRows.data].forEach((rows) =>
    (rows ?? []).forEach((r) => userIds.add(r.user_id))
  );

  const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", [...userIds]);
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const movieIds = [...new Set((movieStatusRows.data ?? []).map((r) => r.movie_id))];
  const seriesIds = [...new Set([...(seriesStatusRows.data ?? []).map((r) => r.series_id), ...(episodeRows.data ?? []).map((r) => r.series_id)])];
  const reviewMovieIds = [...new Set((reviewRows.data ?? []).filter((r) => r.media_type === "movie").map((r) => r.media_id))];
  const reviewSeriesIds = [...new Set((reviewRows.data ?? []).filter((r) => r.media_type === "series").map((r) => r.media_id))];

  const summaries = await fetchDisplaySummaries([...movieIds, ...reviewMovieIds], [...seriesIds, ...reviewSeriesIds]);

  const items: ActivityItem[] = [];

  for (const row of seriesStatusRows.data ?? []) {
    const profile = profileById.get(row.user_id);
    const summary = summaries.series[row.series_id];
    if (!profile || !summary) continue;
    items.push({
      id: `series-status-${row.user_id}-${row.series_id}`,
      userName: profile.display_name || profile.username,
      userAvatarUrl: profile.avatar_url,
      action: row.status === "completed" ? "terminou" : row.status === "watching" ? "começou a assistir" : "adicionou",
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: "series",
      mediaId: row.series_id,
      createdAt: row.updated_at,
    });
  }

  for (const row of movieStatusRows.data ?? []) {
    const profile = profileById.get(row.user_id);
    const summary = summaries.movies[row.movie_id];
    if (!profile || !summary) continue;
    items.push({
      id: `movie-status-${row.user_id}-${row.movie_id}`,
      userName: profile.display_name || profile.username,
      userAvatarUrl: profile.avatar_url,
      action: row.status === "completed" ? "assistiu" : "adicionou",
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: "movie",
      mediaId: row.movie_id,
      createdAt: row.updated_at,
    });
  }

  for (const row of reviewRows.data ?? []) {
    const profile = profileById.get(row.user_id);
    const summary = row.media_type === "movie" ? summaries.movies[row.media_id] : summaries.series[row.media_id];
    if (!profile || !summary) continue;
    items.push({
      id: `review-${row.user_id}-${row.media_type}-${row.media_id}`,
      userName: profile.display_name || profile.username,
      userAvatarUrl: profile.avatar_url,
      action: `avaliou com ${Number(row.rating).toFixed(1)} estrelas`,
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: row.media_type as "movie" | "series",
      mediaId: row.media_id,
      createdAt: row.created_at,
    });
  }

  for (const row of episodeRows.data ?? []) {
    const profile = profileById.get(row.user_id);
    const summary = summaries.series[row.series_id];
    if (!profile || !summary) continue;
    items.push({
      id: `episode-${row.user_id}-${row.series_id}-${row.watched_at}`,
      userName: profile.display_name || profile.username,
      userAvatarUrl: profile.avatar_url,
      action: "marcou um episódio como assistido",
      mediaTitle: summary.title,
      mediaPosterPath: summary.posterPath,
      mediaType: "series",
      mediaId: row.series_id,
      createdAt: row.watched_at,
    });
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);
}
