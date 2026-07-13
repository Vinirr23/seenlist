import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import { fetchLibraryItems } from "./library";

export interface UseLibraryItemsResult {
  items: LibraryItem[] | null;
  isLoading: boolean;
  isError: boolean;
  refreshing: boolean;
  refetch: () => Promise<void>;
}

/**
 * TASK-125 (correção — atualização automática) — porta de
 * `useLibraryItems` (react-query no web, que refaz a busca sozinho
 * sempre que a tela volta a ficar em foco). A versão anterior só
 * buscava uma vez, no primeiro carregamento — por isso uma série
 * marcada como "Em dia" na tela de detalhes continuava aparecendo em
 * "Continue assistindo" até a pessoa atualizar manualmente. Agora,
 * toda vez que a tela volta a ficar em foco (`useFocusEffect`,
 * reexportado pelo próprio `expo-router` — nenhuma dependência
 * nova), busca de novo sozinho. A primeira busca (no mount) continua
 * mostrando o indicador de carregamento normal; buscas de foco
 * seguintes acontecem em silêncio, sem piscar a tela.
 */
export function useLibraryItems(): UseLibraryItemsResult {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else if (!hasLoadedOnce.current) setIsLoading(true);
    setIsError(false);

    try {
      const data = await fetchLibraryItems();
      setItems(data);
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error("[useLibraryItems] Falha ao buscar a biblioteca", error);
      setIsError(true);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current) load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  return { items, isLoading, isError, refreshing, refetch: () => load(true) };
}
