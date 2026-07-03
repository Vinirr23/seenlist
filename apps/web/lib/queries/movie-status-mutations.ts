import type { MovieWatchStatus } from "@seenlist/types";
import { useOptimisticMutation } from "@seenlist/hooks";
import { createClient } from "@/lib/supabase/client";
import { movieStatusQueryKey } from "./movie-status-state";

interface SetStatusVariables {
  status: MovieWatchStatus;
  currentStatus: MovieWatchStatus | null;
}

/**
 * Os três botões (Assistido / Quero assistir / Assistindo) chamam
 * este mesmo mutation — clicar no status já ativo limpa (comporta-se
 * como toggle, igual ao botão de episódio assistido do TASK-005);
 * clicar num status diferente substitui o anterior (um filme só tem
 * um status por vez). Atualiza o cache otimisticamente antes da
 * resposta do Supabase, com rollback em caso de erro.
 */
export function useSetMovieStatus(movieId: number) {
  return useOptimisticMutation<SetStatusVariables, MovieWatchStatus | null>({
    queryKey: movieStatusQueryKey(movieId),
    mutationFn: async ({ status, currentStatus }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      if (currentStatus === status) {
        const { error } = await supabase.from("movie_status").delete().match({ movie_id: movieId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("movie_status")
          .upsert({ user_id: user.id, movie_id: movieId, status, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    },
    optimisticUpdate: (_current, { status, currentStatus }) => (currentStatus === status ? null : status),
  });
}
