import { useCallback, useEffect, useState } from "react";
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
 * TASK-091 (Séries nativa) — o web usa `@tanstack/react-query`
 * (`useLibraryItems` em lib/queries/library-state.ts), que não está
 * instalado no mobile. Em vez de adicionar mais uma dependência
 * nova só pra isso, um `useState`/`useEffect` simples resolve —
 * mesma forma que `refetch()` é chamado tanto no carregamento normal
 * quanto no "puxar pra atualizar" (`refreshing`, usado pelo
 * `RefreshControl` das telas).
 */
export function useLibraryItems(): UseLibraryItemsResult {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);
    setIsError(false);

    try {
      const data = await fetchLibraryItems();
      setItems(data);
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

  return { items, isLoading, isError, refreshing, refetch: () => load(true) };
}
