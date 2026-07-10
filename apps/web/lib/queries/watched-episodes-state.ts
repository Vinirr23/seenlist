import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type WatchedEpisodeKey = `${number}-${number}`; // `${seasonNumber}-${episodeNumber}`

export function episodeKey(seasonNumber: number, episodeNumber: number): WatchedEpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

export function watchedEpisodesQueryKey(seriesId: number) {
  return ["watched-episodes", seriesId] as const;
}

/**
 * CORREÇÃO — mesma causa do erro relatado em series-status: a
 * política de biblioteca pública permite ver watched_episodes de
 * OUTROS usuários com perfil público/seguido. Sem filtrar por
 * user_id aqui, esta consulta (que deveria trazer só os MEUS
 * episódios assistidos) podia silenciosamente misturar episódios de
 * outra pessoa no mesmo Set — sem nem gerar erro, só progresso
 * errado. Isso é provavelmente a explicação real de "mesclou".
 */
async function fetchWatchedEpisodes(seriesId: number): Promise<Set<WatchedEpisodeKey>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id);

  if (error) throw error;

  return new Set(data.map((row) => episodeKey(row.season_number, row.episode_number)));
}

export function useWatchedEpisodes(seriesId: number) {
  return useQuery({
    queryKey: watchedEpisodesQueryKey(seriesId),
    queryFn: () => fetchWatchedEpisodes(seriesId),
  });
}

export function isEpisodeWatched(
  watched: Set<WatchedEpisodeKey> | undefined,
  seasonNumber: number,
  episodeNumber: number
): boolean {
  return watched?.has(episodeKey(seasonNumber, episodeNumber)) ?? false;
}

export interface MostRecentWatchedEpisode {
  seasonNumber: number;
  episodeNumber: number;
}

async function fetchMostRecentWatchedEpisode(
  seriesId: number
): Promise<MostRecentWatchedEpisode | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .order("watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return { seasonNumber: data.season_number, episodeNumber: data.episode_number };
}

/** Usado só pelo card "Continuar assistindo" — separado da lista completa pra não acoplar as duas necessidades num hook só. */
export function useMostRecentWatchedEpisode(seriesId: number) {
  return useQuery({
    queryKey: ["watched-episodes", seriesId, "most-recent"],
    queryFn: () => fetchMostRecentWatchedEpisode(seriesId),
  });
}
