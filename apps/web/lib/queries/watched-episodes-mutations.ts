import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptimisticMutation } from "@seenlist/hooks";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { episodeKey, watchedEpisodesQueryKey, type WatchedEpisodeKey } from "./watched-episodes-state";
import { LIBRARY_QUERY_KEY } from "./library-state";
import { recalculateSeriesCategoryAfterEpisodeChange } from "./seriesCategoryRecalc";

interface ToggleVariables {
  seasonNumber: number;
  episodeNumber: number;
  watched: boolean;
}

/**
 * TASK-030 (correção) — antes só invalidava o próprio cache de
 * episódios assistidos dessa série. `useMarkEpisodesWatched` e
 * `useUnmarkSeasonWatched` (mesma família de mutations) já
 * invalidavam `LIBRARY_QUERY_KEY` também — esta aqui tinha ficado de
 * fora, então marcar UM episódio (o caso mais comum, pela tela de
 * episódio dedicada) nunca atualizava progresso da série, próximo
 * episódio, "Em dia" ou as estatísticas do Perfil sem recarregar a
 * página. `useProfileStats`/`useLibraryItems` leem da MESMA chave, então
 * invalidar uma vez já cobre biblioteca e perfil juntos.
 */
export function useToggleEpisodeWatched(seriesId: number) {
  const queryClient = useQueryClient();
  const mutation = useOptimisticMutation<ToggleVariables, Set<WatchedEpisodeKey>>({
    queryKey: watchedEpisodesQueryKey(seriesId),
    mutationFn: async ({ seasonNumber, episodeNumber, watched }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
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

  return {
    ...mutation,
    mutate: (variables: ToggleVariables, options?: Parameters<typeof mutation.mutate>[1]) => {
      mutation.mutate(variables, {
        ...options,
        onSettled: (...args) => {
          void recalculateSeriesCategoryAfterEpisodeChange(seriesId).finally(() => {
            queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
          });
          options?.onSettled?.(...args);
        },
      });
    },
  };
}

interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/**
 * TASK-025 — marca vários episódios de uma vez (usado tanto por
 * "marcar episódios anteriores?" quanto por "marcar temporada
 * inteira"). Um INSERT só, não um por episódio — "não animar episódio
 * por episódio" (item 5) já sai de graça disso: o cache muda uma vez,
 * a interface re-renderiza uma vez, não em sequência.
 *
 * Não usa `useOptimisticMutation` porque também precisa invalidar
 * `['library']` — sem isso, as estatísticas do Perfil e as
 * categorias da Biblioteca (Assistindo/Em dia/Concluída) só
 * atualizariam na próxima navegação, não "imediatamente" como pedido.
 */
export function useMarkEpisodesWatched(seriesId: number) {
  const queryClient = useQueryClient();
  const queryKey = watchedEpisodesQueryKey(seriesId);

  return useMutation<void, Error, EpisodeRef[], { previous: Set<WatchedEpisodeKey> | undefined }>({
    mutationFn: async (episodes) => {
      if (episodes.length === 0) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const rows = episodes.map((e) => ({
        user_id: user.id,
        series_id: seriesId,
        season_number: e.seasonNumber,
        episode_number: e.episodeNumber,
      }));

      // ignoreDuplicates: alguns dos episódios do intervalo já podem
      // estar assistidos — upsert evita erro de chave duplicada nesses.
      const { error } = await supabase
        .from("watched_episodes")
        .upsert(rows, { onConflict: "user_id,series_id,season_number,episode_number", ignoreDuplicates: true });
      if (error) throw error;
    },
    onMutate: async (episodes) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<WatchedEpisodeKey>>(queryKey);
      const next = new Set(previous ?? []);
      for (const e of episodes) next.add(episodeKey(e.seasonNumber, e.episodeNumber));
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void recalculateSeriesCategoryAfterEpisodeChange(seriesId).finally(() => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      });
    },
  });
}

/**
 * TASK-047 — "Reassistido" (bottom sheet igual TV Time, ao tocar num
 * episódio já assistido). Incrementa `rewatch_count` na MESMA linha
 * (nunca cria outra) e `total_watch_events` em `series_status` (é
 * essa coluna que profile-stats.ts já usa pras estatísticas de
 * "eventos assistidos", incluindo reassistidas). Não mexe no Set de
 * episódios assistidos (o episódio já estava lá, continua) nem chama
 * recalculo de categoria — reassistir não muda progresso nem status.
 */
export function useIncrementEpisodeRewatch(seriesId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, EpisodeRef>({
    mutationFn: async ({ seasonNumber, episodeNumber }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { data: episodeRow, error: readError } = await supabase
        .from("watched_episodes")
        .select("rewatch_count")
        .eq("user_id", user.id)
        .eq("series_id", seriesId)
        .eq("season_number", seasonNumber)
        .eq("episode_number", episodeNumber)
        .maybeSingle();
      if (readError) throw readError;
      if (!episodeRow) throw new Error("Episódio não está marcado como assistido — não dá pra reassistir.");

      const { error: updateError } = await supabase
        .from("watched_episodes")
        .update({ rewatch_count: (episodeRow.rewatch_count ?? 0) + 1 })
        .eq("user_id", user.id)
        .eq("series_id", seriesId)
        .eq("season_number", seasonNumber)
        .eq("episode_number", episodeNumber);
      if (updateError) throw updateError;

      const { data: statusRow, error: statusReadError } = await supabase
        .from("series_status")
        .select("total_watch_events")
        .eq("user_id", user.id)
        .eq("series_id", seriesId)
        .maybeSingle();
      if (statusReadError) throw statusReadError;
      if (statusRow) {
        const { error: statusUpdateError } = await supabase
          .from("series_status")
          .update({ total_watch_events: (statusRow.total_watch_events ?? 0) + 1 })
          .eq("user_id", user.id)
          .eq("series_id", seriesId);
        if (statusUpdateError) throw statusUpdateError;
      }
    },
    onSettled: () => {
      // Só estatísticas — nunca o Set de assistidos nem categoria (por isso não invalida watchedEpisodesQueryKey nem chama recalculateSeriesCategoryAfterEpisodeChange).
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
    },
  });
}

/**
 * TASK-025 — desmarcar a temporada inteira. Um DELETE só (por
 * series_id + season_number), não um por episódio.
 */
export function useUnmarkSeasonWatched(seriesId: number) {
  const queryClient = useQueryClient();
  const queryKey = watchedEpisodesQueryKey(seriesId);

  return useMutation<void, Error, number, { previous: Set<WatchedEpisodeKey> | undefined }>({
    mutationFn: async (seasonNumber) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("watched_episodes")
        .delete()
        .match({ series_id: seriesId, season_number: seasonNumber });
      if (error) throw error;
    },
    onMutate: async (seasonNumber) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<WatchedEpisodeKey>>(queryKey);
      const prefix = `${seasonNumber}-`;
      const next = new Set([...(previous ?? [])].filter((key) => !key.startsWith(prefix))) as Set<WatchedEpisodeKey>;
      queryClient.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void recalculateSeriesCategoryAfterEpisodeChange(seriesId).finally(() => {
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      });
    },
  });
}
