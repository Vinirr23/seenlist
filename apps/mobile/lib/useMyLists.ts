import { useCallback, useEffect, useState } from "react";
import { createList, fetchMyLists, peekCachedMyLists, type UserList } from "./lists";
import { useAuth } from "./auth/AuthProvider";

export function useMyLists() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [lists, setLists] = useState<UserList[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
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

  /*
   * CORREÇÃO DE CAUSA RAIZ (2026-09-27, Etapa 3) — ver comentário
   * completo em `lib/lists.ts` (`peekCachedMyLists`). Mesmo padrão do
   * `useMovieDetails`/`useSeriesDetails`: espia o cache ANTES de
   * decidir se mostra esqueleto — se já tiver algo, mostra na hora e
   * busca fresco por trás, sem esconder a lista que já estava na tela.
   */
  useEffect(() => {
    const cached = userId ? peekCachedMyLists(userId) : null;
    if (cached) {
      setLists(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    load();
  }, [load, userId]);

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
