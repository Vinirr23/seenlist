import { useEffect, useState } from "react";
import { useDebouncedValue } from "@seenlist/hooks";
import { fetchFollowList, type FollowDirection, type FollowListUser } from "./followList";

export function useFollowList(userId: string, direction: FollowDirection, search: string) {
  const [users, setUsers] = useState<FollowListUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchFollowList(userId, direction, debouncedSearch)
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((error) => {
        console.error("[useFollowList] Falha ao buscar lista", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, direction, debouncedSearch]);

  return { users, isLoading, isError };
}
