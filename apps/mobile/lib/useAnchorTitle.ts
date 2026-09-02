import { useMemo } from "react";
import type { MediaType } from "@seenlist/types";
import { useLibraryItems } from "./useLibraryItems";

export interface AnchorTitle {
  id: number;
  title: string;
}

/**
 * PORTE DO WEB (2026-09-02 — "vamos implementar as mudanças que
 * foram feitas no web", reformulação completa da Explorar) — mesma
 * lógica exata de `apps/web/lib/queries/anchor-title.ts` ("Porque
 * você assistiu a [X]"): escolhe o título "completed"/"up_to_date"
 * com atividade mais recente (`lastActivityAt`) DAQUELE tipo de
 * mídia — separado por `mediaType`, mesmo motivo de
 * `topMovieGenres`/`topSeriesGenres` serem calculados à parte em
 * `useFavoriteGenres.ts` (cada aba só deve mostrar um âncora do
 * próprio tipo). Não dispara busca de rede nova — `useLibraryItems`
 * já é usado por `useFavoriteGenres` na mesma tela.
 */
export function useAnchorTitle(mediaType: MediaType): { anchor: AnchorTitle | null; isLoading: boolean } {
  const { items: libraryItems, isLoading } = useLibraryItems();

  const anchor = useMemo(() => {
    let best: AnchorTitle | null = null;
    let bestActivityAt = "";
    for (const item of libraryItems ?? []) {
      if (item.mediaType !== mediaType) continue;
      if (item.status !== "completed" && item.status !== "up_to_date") continue;
      if (item.lastActivityAt > bestActivityAt) {
        bestActivityAt = item.lastActivityAt;
        best = { id: item.id, title: item.title };
      }
    }
    return best;
  }, [libraryItems, mediaType]);

  return { anchor, isLoading };
}
