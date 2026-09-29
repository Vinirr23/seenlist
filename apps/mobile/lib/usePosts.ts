import { useCallback, useEffect, useState } from "react";
import type { Post } from "./posts";
import { fetchPosts } from "./posts";

export function usePosts() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);
    setIsError(false);

    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch (error) {
      console.error("[usePosts] Falha ao buscar posts", error);
      setIsError(true);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-29, "a rolagem do feed está
   * travando") — `refetch: () => load(true)` inline devolvia uma
   * função NOVA a cada chamada de `usePosts()` (ou seja, a cada render
   * de `FeedScreen`). `feed.tsx` passa isso como `onDeleted` pro
   * `PostCard` — com uma referência nova toda hora, o `memo` novo do
   * `PostCard` (ver o comentário lá) nunca bateria "igual", e a
   * otimização inteira seria inútil. `useCallback` aqui é o que faz o
   * `memo` de lá funcionar de verdade.
   */
  const refetch = useCallback(() => load(true), [load]);

  return { posts, isLoading, isError, refreshing, refetch };
}
