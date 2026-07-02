import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MovieWatchStatus } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";

function movieStatusQueryKey(movieId: number) {
  return ["movie-status", movieId] as const;
}

/** RLS já restringe à linha do usuário logado. */
async function fetchMovieStatus(movieId: number): Promise<MovieWatchStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movie_status")
    .select("status")
    .eq("movie_id", movieId)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as MovieWatchStatus | undefined) ?? null;
}

export function useMovieStatus(movieId: number) {
  return useQuery({
    queryKey: movieStatusQueryKey(movieId),
    queryFn: () => fetchMovieStatus(movieId),
  });
}

interface SetStatusVariables {
  status: MovieWatchStatus;
  currentStatus: MovieWatchStatus | null;
}

interface SetStatusContext {
  previous: MovieWatchStatus | null | undefined;
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
  const queryClient = useQueryClient();
  const queryKey = movieStatusQueryKey(movieId);

  return useMutation<void, Error, SetStatusVariables, SetStatusContext>({
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
    onMutate: async ({ status, currentStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MovieWatchStatus | null>(queryKey);
      queryClient.setQueryData(queryKey, currentStatus === status ? null : status);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
