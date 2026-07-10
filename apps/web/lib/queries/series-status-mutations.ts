import type { LibraryStatus } from "@seenlist/types";
import { useOptimisticMutation } from "@seenlist/hooks";
import { createClient } from "@/lib/supabase/client";
import { seriesStatusQueryKey } from "./series-status-state";

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
 */
export function useSetSeriesStatus(seriesId: number) {
  return useOptimisticMutation<SetStatusVariables, LibraryStatus | null>({
    queryKey: seriesStatusQueryKey(seriesId),
    mutationFn: async ({ status, currentStatus }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
}
