import { useOptimisticMutation } from "@seenlist/hooks";
import type { LibraryItem, LibraryStatus, MediaType } from "@seenlist/types";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { LIBRARY_QUERY_KEY } from "./library-state";

interface MoveVariables {
  mediaType: MediaType;
  id: number;
  status: LibraryStatus;
}

/** Move um item entre Assistindo / Quero assistir / Concluído. */
export function useMoveLibraryItem() {
  return useOptimisticMutation<MoveVariables, LibraryItem[]>({
    queryKey: LIBRARY_QUERY_KEY,
    mutationFn: async ({ mediaType, id, status }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      if (mediaType === "movie") {
        const movieStatus = status === "completed" ? "watched" : status;
        const { error } = await supabase
          .from("movie_status")
          .upsert({ user_id: user.id, movie_id: id, status: movieStatus, updated_at: new Date().toISOString() });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("series_status")
          .upsert({ user_id: user.id, series_id: id, status, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    optimisticUpdate: (current, { mediaType, id, status }) =>
      (current ?? []).map((item) =>
        item.mediaType === mediaType && item.id === id ? { ...item, status } : item
      ),
  });
}

interface RemoveVariables {
  mediaType: MediaType;
  id: number;
}

/**
 * Filme: apaga a linha (não tem estado derivado, então apagar é
 * seguro).
 *
 * Série: apaga de vez — status E progresso de episódios assistidos.
 * Antes (TASK-007) isso só marcava "removed", preservando
 * `watched_episodes` pra caso o usuário adicionasse a série de novo
 * depois. Mudança explícita pedida nesta tarefa ("remover todos os
 * status, progresso e vínculo da biblioteca") — agora é destrutivo e
 * não tem como desfazer.
 */
export function useRemoveLibraryItem() {
  return useOptimisticMutation<RemoveVariables, LibraryItem[]>({
    queryKey: LIBRARY_QUERY_KEY,
    mutationFn: async ({ mediaType, id }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      if (mediaType === "movie") {
        const { error } = await supabase.from("movie_status").delete().match({ movie_id: id });
        if (error) throw error;
      } else {
        const { error: episodesError } = await supabase
          .from("watched_episodes")
          .delete()
          .match({ series_id: id });
        if (episodesError) throw episodesError;

        const { error: statusError } = await supabase.from("series_status").delete().match({ series_id: id });
        if (statusError) throw statusError;
      }
    },
    optimisticUpdate: (current, { mediaType, id }) =>
      (current ?? []).filter((item) => !(item.mediaType === mediaType && item.id === id)),
  });
}
