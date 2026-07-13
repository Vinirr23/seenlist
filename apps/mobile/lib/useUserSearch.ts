import { useEffect, useState } from "react";
import { useDebouncedValue } from "@seenlist/hooks";
import { fetchUserSearch } from "./userSearch";
import type { FollowListUser } from "./followList";

export function useUserSearch(query: string) {
  const [users, setUsers] = useState<FollowListUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchUserSearch(debouncedQuery)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((error) => {
        console.error("[useUserSearch] Falha ao buscar usuários", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return { users, isLoading, isError };
}
