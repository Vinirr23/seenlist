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

  return { posts, isLoading, isError, refreshing, refetch: () => load(true) };
}
