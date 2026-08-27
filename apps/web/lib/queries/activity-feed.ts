import { useQuery } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { fetchDisplaySummaries } from "./library-state";
import { STALE_TIME_FEED } from "@/lib/queryStaleTimes";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

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

// CORREÇÃO (a pedido — Fase E da reformulação da Explorar, 2026-08-22)
// — antes o feed misturava sua própria atividade com a de QUALQUER
// usuário de perfil público (mais quem você segue, se o perfil dele
// fosse "somente seguidores") — comportamento confirmado lendo as
// policies reais em `20260720000000_social_profile.sql`, não só o
// comentário antigo daqui (que dizia "só perfis públicos", impreciso).
// Perguntado ao usuário (AskUserQuestion) e confirmado: o feed deve
// mostrar SÓ quem você segue (nem estranhos com perfil público, nem
// sua própria atividade). `followingCount` viaja junto do resultado
// pra `ExploreActivityTab.tsx` conseguir diferenciar "você ainda não
// segue ninguém" de "quem você segue não teve atividade recente".
export interface ActivityFeedResult {
  items: ActivityItem[];
  followingCount: number;
}

const ACTIVITY_WINDOW_DAYS = 7;
const LIMIT_PER_SOURCE = 15;

/**
 * TASK-058 — "feed de atividades recentes". Dado REAL (diferente dos
 * Grupos, que são mock por autorização explícita da tarefa): deriva
 * de `series_status`/`movie_status`/`reviews`/`watched_episodes`, que
 * já existiam — nenhuma tabela de "activity" nova.
 *
 * Limitação honesta: não existe histórico de transição de status
 * (não dá pra saber com certeza "começou hoje" vs "só atualizou
 * agora") — a ação é inferida do status ATUAL + `updated_at` recente,
 * não de um evento discreto registrado. É uma aproximação razoável,
 * não um dado inventado do zero.
 */
export function useActivityFeed() {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["activity-feed", locale],
    queryFn: async (): Promise<ActivityFeedResult> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return { items: [], followingCount: 0 };

      const { data: followRows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      const followingIds = [...new Set((followRows ?? []).map((r) => r.following_id))];
      // Sem ninguém seguido ainda — nem vale a pena consultar as 4
      // tabelas de origem, o resultado seria vazio de qualquer jeito.
      if (followingIds.length === 0) return { items: [], followingCount: 0 };

      const since = new Date();
      since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);
      const sinceIso = since.toISOString();

      const [seriesStatusRows, movieStatusRows, reviewRows, episodeRows] = await Promise.all([
        supabase
          .from("series_status")
          .select("user_id, series_id, status, updated_at")
          .in("user_id", followingIds)
          .gte("updated_at", sinceIso)
          .order("updated_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE),
        supabase
          .from("movie_status")
          .select("user_id, movie_id, status, updated_at")
          .in("user_id", followingIds)
          .gte("updated_at", sinceIso)
          .order("updated_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE),
        supabase
          .from("reviews")
          .select("user_id, media_type, media_id, rating, created_at")
          .in("user_id", followingIds)
          .is("deleted_at", null)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE),
        // CORREÇÃO (bug real reportado — "duas crianças com a mesma
        // key" no console, em ExploreActivityTab.tsx) — causa raiz:
        // marcar VÁRIOS episódios de uma vez (ex.: "temporada inteira")
        // grava todos com o MESMO `watched_at` até o microssegundo
        // (mesmo padrão já visto antes nesta investigação da série,
        // ver seção "Rede de segurança" no handoff). O `id` do item do
        // feed era montado só com `user_id-series_id-watched_at` — sem
        // nada que diferencie QUAL episódio, dois desses marcados
        // juntos viravam itens com o id idêntico. A chave primária real
        // da tabela (`20260705000000_watched_episodes.sql`) é
        // `(user_id, series_id, season_number, episode_number)` — únicos
        // por definição do banco — então incluir os dois campos que
        // faltavam aqui garante um id sempre único, sem depender de
        // sorte no timestamp. O app mobile (`activityFeed.ts`) já fazia
        // isso certinho desde o início; só o web tinha ficado pra trás.
        supabase
          .from("watched_episodes")
          .select("user_id, series_id, season_number, episode_number, watched_at")
          .in("user_id", followingIds)
          .gte("watched_at", sinceIso)
          .order("watched_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE),
      ]);

      const userIds = new Set<string>();
      [seriesStatusRows.data, movieStatusRows.data, reviewRows.data, episodeRows.data].forEach((rows) =>
        (rows ?? []).forEach((r) => userIds.add(r.user_id))
      );

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", [...userIds]);
      const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      const movieIds = [...new Set((movieStatusRows.data ?? []).map((r) => r.movie_id))];
      const seriesIds = [
        ...new Set([...(seriesStatusRows.data ?? []).map((r) => r.series_id), ...(episodeRows.data ?? []).map((r) => r.series_id)]),
      ];
      const reviewMovieIds = [...new Set((reviewRows.data ?? []).filter((r) => r.media_type === "movie").map((r) => r.media_id))];
      const reviewSeriesIds = [...new Set((reviewRows.data ?? []).filter((r) => r.media_type === "series").map((r) => r.media_id))];

      const summaries = await fetchDisplaySummaries([...movieIds, ...reviewMovieIds], [...seriesIds, ...reviewSeriesIds], locale);

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
          id: `episode-${row.user_id}-${row.series_id}-${row.season_number}-${row.episode_number}-${row.watched_at}`,
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

      return {
        items: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40),
        followingCount: followingIds.length,
      };
    },
    staleTime: STALE_TIME_FEED,
  });
}
