import { useOptimisticMutation } from "@seenlist/hooks";
import { createClient } from "@/lib/supabase/client";
import { episodeKey, watchedEpisodesQueryKey, type WatchedEpisodeKey } from "./watched-episodes-state";

interface ToggleVariables {
  seasonNumber: number;
  episodeNumber: number;
  watched: boolean;
}

/**
 * "Ao clicar: salvar no Supabase, atualizar imediatamente a
 * interface" — a atualização otimista do cache é o que faz a
 * interface reagir na hora, sem esperar a resposta do Supabase.
 */
export function useToggleEpisodeWatched(seriesId: number) {
  return useOptimisticMutation<ToggleVariables, Set<WatchedEpisodeKey>>({
    queryKey: watchedEpisodesQueryKey(seriesId),
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
    optimisticUpdate: (current, { seasonNumber, episodeNumber, watched }) => {
      const next = new Set(current ?? []);
      const key = episodeKey(seasonNumber, episodeNumber);
      if (watched) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    },
  });
}
