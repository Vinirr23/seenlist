import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type WatchedEpisodeKey = `${number}-${number}`; // `${seasonNumber}-${episodeNumber}`

function episodeKey(seasonNumber: number, episodeNumber: number): WatchedEpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

function watchedEpisodesQueryKey(seriesId: number) {
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

interface ToggleVariables {
  seasonNumber: number;
  episodeNumber: number;
  watched: boolean;
}

interface ToggleContext {
  previous: Set<WatchedEpisodeKey> | undefined;
}

/**
 * "Ao clicar: salvar no Supabase, atualizar imediatamente a
 * interface" — a atualização otimista do cache (`onMutate`) é o que
 * faz a interface reagir na hora, sem esperar a resposta do
 * Supabase.
 */
export function useToggleEpisodeWatched(seriesId: number) {
  const queryClient = useQueryClient();
  const queryKey = watchedEpisodesQueryKey(seriesId);

  return useMutation<void, Error, ToggleVariables, ToggleContext>({
    mutationFn: async ({ seasonNumber, episodeNumber, watched }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      if (watched) {
        const { error } = await supabase
          .from("watched_episodes")
          .delete()
          .match({ series_id: seriesId, season_number: seasonNumber, episode_number: episodeNumber });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("watched_episodes").insert({
          user_id: user.id,
          series_id: seriesId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ seasonNumber, episodeNumber, watched }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<WatchedEpisodeKey>>(queryKey);

      const next = new Set(previous ?? []);
      const key = episodeKey(seasonNumber, episodeNumber);
      if (watched) {
        next.delete(key);
      } else {
        next.add(key);
      }
      queryClient.setQueryData(queryKey, next);

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
