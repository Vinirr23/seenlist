import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type WatchedEpisodeKey = `${number}-${number}`; // `${seasonNumber}-${episodeNumber}`

export function episodeKey(seasonNumber: number, episodeNumber: number): WatchedEpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

export function watchedEpisodesQueryKey(seriesId: number) {
  return ["watched-episodes", seriesId] as const;
}

/** RLS já restringe a linhas do usuário logado — não precisa filtrar por user_id aqui. */
async function fetchWatchedEpisodes(seriesId: number): Promise<Set<WatchedEpisodeKey>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId);

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
  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
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
