import { useMutation } from "@tanstack/react-query";
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

/**
 * TASK-047 — "Reassistido" pra filme. Incrementa `rewatch_count` na
 * mesma linha de `movie_status`, mantém `status="watched"` intocado
 * — nunca cria outra linha, nunca muda o status.
 */
export function useIncrementMovieRewatch(movieId: number) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { data: row, error: readError } = await supabase
        .from("movie_status")
        .select("rewatch_count")
        .eq("user_id", user.id)
        .eq("movie_id", movieId)
        .maybeSingle();
      if (readError) throw readError;
      if (!row) throw new Error("Filme não está marcado como assistido — não dá pra reassistir.");

      const { error: updateError } = await supabase
        .from("movie_status")
        .update({ rewatch_count: (row.rewatch_count ?? 0) + 1 })
        .eq("user_id", user.id)
        .eq("movie_id", movieId);
      if (updateError) throw updateError;
    },
  });
}
