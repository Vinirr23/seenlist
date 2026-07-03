import { useOptimisticMutation } from "@seenlist/hooks";
import type { LibraryItem, LibraryStatus, MediaType } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";
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
      } = await supabase.auth.getUser();
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
 * seguro). Série: marca como "removed" em vez de apagar, porque
 * apagar não existiria — o progresso de episódios assistidos
 * continua em watched_episodes (não mexemos nisso aqui), então
 * "remover" só esconde da Biblioteca.
 */
export function useRemoveLibraryItem() {
  return useOptimisticMutation<RemoveVariables, LibraryItem[]>({
    queryKey: LIBRARY_QUERY_KEY,
    mutationFn: async ({ mediaType, id }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      if (mediaType === "movie") {
        const { error } = await supabase.from("movie_status").delete().match({ movie_id: id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("series_status")
          .upsert({ user_id: user.id, series_id: id, status: "removed", updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    optimisticUpdate: (current, { mediaType, id }) =>
      (current ?? []).filter((item) => !(item.mediaType === mediaType && item.id === id)),
  });
}
