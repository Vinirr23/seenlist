import { useCallback, useEffect, useState } from "react";
import { createList, fetchMyLists, type UserList } from "./lists";

export function useMyLists() {
  const [lists, setLists] = useState<UserList[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await fetchMyLists();
      setLists(data);
    } catch (error) {
      console.error("[useMyLists] Falha ao buscar listas", error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (name: string) => {
      setCreating(true);
      try {
        await createList(name);
        await load();
        return true;
      } catch (error) {
        console.error("[useMyLists] Falha ao criar lista", error);
        return false;
      } finally {
        setCreating(false);
      }
    },
    [load]
  );

  return { lists, isLoading, isError, creating, create, refetch: load };
}
