import type { LibraryStatus } from "@seenlist/types";
import { useOptimisticMutation } from "@seenlist/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { seriesStatusQueryKey } from "./series-status-state";
import { LIBRARY_QUERY_KEY } from "./library-state";

interface SetStatusVariables {
  status: LibraryStatus;
  currentStatus: LibraryStatus | null;
}

/**
 * Os botões "Assistindo" / "Assistir depois" da página da série
 * chamam este mutation — mesmo padrão do `useSetMovieStatus`: clicar
 * no status já ativo apaga a linha (o que devolve a série pro status
 * *derivado* de `watched_episodes`, se houver algum episódio
 * assistido — não deixa a série "sem status" indevidamente); clicar
 * num status diferente substitui.
 *
 * TASK-061 (correção) — achado real: `useOptimisticMutation` só
 * invalida a própria chave (`seriesStatusQueryKey`, o status de UMA
 * série). Nunca invalidava `LIBRARY_QUERY_KEY` — então adicionar uma
 * série (ou mudar seu status por aqui) nunca atualizava a contagem
 * do Perfil nem a lista da Biblioteca até alguma OUTRA ação disparar
 * essa invalidação por acaso (ex.: marcar um episódio depois). Mesmo
 * padrão de correção já usado em `useToggleEpisodeWatched`: envolve
 * o `mutate` retornado pra adicionar essa invalidação extra sem
 * duplicar toda a lógica do hook genérico.
 */
export function useSetSeriesStatus(seriesId: number) {
  const queryClient = useQueryClient();
  const mutation = useOptimisticMutation<SetStatusVariables, LibraryStatus | null>({
    queryKey: seriesStatusQueryKey(seriesId),
    mutationFn: async ({ status, currentStatus }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      if (currentStatus === status) {
        const { error } = await supabase.from("series_status").delete().match({ series_id: seriesId });
        if (error) {
          console.error("[series-status] Falha ao remover status", error);
          throw error;
        }
      } else {
        const { error } = await supabase.from("series_status").upsert({
          user_id: user.id,
          series_id: seriesId,
          status,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error("[series-status] Falha ao salvar status", error);
          throw error;
        }
      }
    },
    optimisticUpdate: (_current, { status, currentStatus }) => (currentStatus === status ? null : status),
  });

  return {
    ...mutation,
    mutate: (variables: SetStatusVariables, options?: Parameters<typeof mutation.mutate>[1]) => {
      mutation.mutate(variables, {
        ...options,
        onSettled: (...args) => {
          queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
          options?.onSettled?.(...args);
        },
      });
    },
  };
}
