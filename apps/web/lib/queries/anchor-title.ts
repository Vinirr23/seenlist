"use client";

import { useMemo } from "react";
import type { MediaType } from "@seenlist/types";
import { useLibraryItems } from "@/lib/queries/library";

export interface AnchorTitle {
  id: number;
  title: string;
}

/**
 * Fase D da reformulação da Explorar (2026-08-22) — "Porque você
 * assistiu a [X]": escolhe o TÍTULO-ÂNCORA usado pra buscar
 * recomendações do TMDB. Pergunta feita ao usuário (AskUserQuestion,
 * 2026-08-22) sobre 2 decisões de escopo, ambas confirmadas:
 *
 * 1. Só 1 âncora por aba (não múltiplos carrosséis "Porque você
 *    assistiu a X"/"Porque você assistiu a Y" simultâneos, mesmo o
 *    wireframe original do usuário citando mais de um exemplo).
 * 2. Critério: o título com atividade mais RECENTE (`lastActivityAt`,
 *    já documentado em `LibraryItem` — pra série, inclui marcar
 *    episódio, não só mudar de status) entre os itens
 *    "completed"/"up_to_date" — mesma definição de "concluído" já
 *    usada por `useFavoriteGenres` (`completedIds`), pra manter as
 *    duas seções ("Para você" e "Porque você assistiu a X")
 *    consistentes sobre o que conta como "eu já vi isso".
 *
 * Separado por `mediaType` (não um único ranking filme+série
 * misturado) — mesmo motivo de `topMovieGenres`/`topSeriesGenres`
 * serem calculados à parte em `favorite-genres.ts`: cada aba
 * (Filmes/Séries) só deve mostrar um âncora do seu próprio tipo.
 * Não depende de nenhuma chamada de rede nova — `useLibraryItems` já
 * é buscado por `useFavoriteGenres` na mesma tela (cache do React
 * Query compartilhado, sem busca duplicada).
 */
export function useAnchorTitle(mediaType: MediaType): { anchor: AnchorTitle | null; isLoading: boolean } {
  const { data: libraryItems, isLoading } = useLibraryItems();

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
