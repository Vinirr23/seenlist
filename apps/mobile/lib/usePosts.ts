import { useCallback, useEffect, useRef, useState } from "react";
import type { Post, FeedScope } from "./posts";
import { fetchPosts } from "./posts";

/**
 * A PEDIDO (2026-10-01, header do Feed — "Para você / Seguindo") —
 * aceita o `scope` como argumento (padrão "forYou", mesmo
 * comportamento de sempre pra quem ainda não passa nada).
 *
 * CACHE POR ABA (2026-10-01, reportado — "toda vez que passo de aba,
 * recarrega") — ACHADO: antes, QUALQUER troca de `scope` mudava a
 * identidade de `load` e disparava `load(false)` de novo (`isLoading`
 * true, skeleton de volta, perde a posição de rolagem) — mesmo
 * voltando pra uma aba já vista há 2 segundos. `cacheRef` (um `Map`
 * em `useRef`, não dispara render sozinho) guarda o último resultado
 * de CADA aba separadamente. Trocar pra uma aba já cacheada troca o
 * `posts` na hora, sem bater na rede nem mostrar skeleton; trocar pra
 * uma aba nova de verdade (ainda sem cache) continua buscando com
 * loading normal, igual sempre foi.
 *
 * `scopeRef` guarda a aba "atual de verdade" pra `load`/`refetch`
 * ignorarem o resultado se a pessoa já tiver trocado de aba de novo
 * ANTES da resposta chegar (corrida comum: toca "Seguindo", toca
 * "Para você" de volta rapidinho, a resposta de "Seguindo" chegando
 * atrasada não pode sobrescrever o que já está na tela).
 *
 * Esse cache é só em memória, dura só a sessão do componente — puxar
 * pra atualizar (`refetch`, pull-to-refresh) ou um post novo via
 * Realtime (ver `feed.tsx`) sempre busca de novo e re-escreve o cache
 * da aba ATUAL; a OUTRA aba só atualiza quando você trocar pra ela de
 * novo (se já tiver cache, mostra o cache antigo até você puxar pra
 * atualizar lá também — mesma troca que o usuário escolheu, cache
 * "preguiçoso" em vez de invalidar a aba que não está na tela).
 */
export function usePosts(scope: FeedScope = "forYou") {
  const cacheRef = useRef<Map<FeedScope, Post[]>>(new Map());
  const scopeRef = useRef(scope);

  const [posts, setPosts] = useState<Post[] | null>(() => cacheRef.current.get(scope) ?? null);
  const [isLoading, setIsLoading] = useState(() => !cacheRef.current.has(scope));
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean, targetScope: FeedScope) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);
    setIsError(false);

    try {
      const data = await fetchPosts(targetScope);
      cacheRef.current.set(targetScope, data);
      if (scopeRef.current === targetScope) setPosts(data);
    } catch (error) {
      console.error("[usePosts] Falha ao buscar posts", error);
      if (scopeRef.current === targetScope) setIsError(true);
    } finally {
      if (scopeRef.current === targetScope) {
        if (isRefresh) setRefreshing(false);
        else setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    scopeRef.current = scope;
    const cached = cacheRef.current.get(scope);
    if (cached) {
      // Já visto nesta sessão — troca na hora, sem skeleton nem busca.
      setPosts(cached);
      setIsLoading(false);
      setIsError(false);
    } else {
      setPosts(null);
      load(false, scope);
    }
  }, [scope, load]);

  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-29, "a rolagem do feed está
   * travando") — `refetch: () => load(true)` inline devolvia uma
   * função NOVA a cada chamada de `usePosts()` (ou seja, a cada render
   * de `FeedScreen`). `feed.tsx` passa isso como `onDeleted` pro
   * `PostCard` — com uma referência nova toda hora, o `memo` novo do
   * `PostCard` (ver o comentário lá) nunca bateria "igual", e a
   * otimização inteira seria inútil. `useCallback` aqui é o que faz o
   * `memo` de lá funcionar de verdade — sempre busca a aba ATUAL
   * (`scopeRef.current`), não a que o hook tinha quando foi chamado.
   */
  const refetch = useCallback(() => load(true, scopeRef.current), [load]);

  return { posts, isLoading, isError, refreshing, refetch };
}
