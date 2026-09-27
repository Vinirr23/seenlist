import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { deleteReview, fetchMyReview, fetchReviews, upsertReview, type Review, type ReviewTarget } from "./reviews";

export function useReviews(target: ReviewTarget) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasLoadedOnce = useRef(false);
  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-27, Etapa 2, item 2 — "Reviews:
   * paginação") — `fetchReviews` agora devolve uma PÁGINA (ver
   * `reviews.ts`), não a lista inteira. `page`/`hasMore` só
   * controlam a paginação de "carregar mais"; `load()` (foco, salvar,
   * apagar) sempre volta pra página 0 — mesmo comportamento de antes
   * pra quem só olha a tela pela primeira vez ou depois de uma
   * mudança, só que agora busca 20 de cada vez em vez de todas.
   */
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /**
   * CORREÇÃO (2026-09-27, auditoria de performance — Etapa 3, achado
   * de código durante a validação da paginação da Etapa 2) — corrida
   * real, embora estreita: se `loadMore()` (buscando a página N) ainda
   * estiver em voo quando `load()` roda de novo por outro motivo
   * (refoco da tela, ou `submit`/`remove` — os três chamam `load()`,
   * que sempre reseta pra página 0), a resposta atrasada do
   * `loadMore()` antigo caía em `setReviews((prev) => [...prev,
   * ...result.reviews])` usando um `prev` que já tinha sido
   * SUBSTITUÍDO pelo `load()` mais recente — risco de duplicar ou
   * misturar avaliações de páginas diferentes. `loadToken` é um
   * contador simples: cada chamada de `load()` incrementa e captura
   * seu próprio número; `loadMore()` também captura o número vigente
   * no início da chamada e só aplica o resultado se `loadTokenRef`
   * ainda for o mesmo — se um `load()` mais novo rodou enquanto o
   * `loadMore()` estava em voo, a resposta atrasada é descartada em
   * vez de aplicada.
   */
  const loadTokenRef = useRef(0);

  const load = useCallback(async () => {
    if (!hasLoadedOnce.current) setIsLoading(true);
    const myToken = ++loadTokenRef.current;
    try {
      const [allPage, mine] = await Promise.all([fetchReviews(target, 0), fetchMyReview(target)]);
      if (loadTokenRef.current !== myToken) return;
      setReviews(allPage.reviews);
      setHasMore(allPage.hasMore);
      setPage(0);
      setMyReview(mine);
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error("[useReviews] Falha ao buscar avaliações", error);
    } finally {
      if (loadTokenRef.current === myToken) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital: depende só dos campos primitivos de `target`, não do objeto inteiro, pra não reexecutar toda vez que o chamador recriar `target` sem memoizar (mesmo motivo do disable na linha abaixo, no useFocusEffect).
  }, [target.mediaType, target.mediaId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const myToken = loadTokenRef.current;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchReviews(target, nextPage);
      /*
       * Um `load()` mais novo rodou enquanto esta página estava a
       * caminho (refoco, submit ou remove) — o estado já foi
       * substituído do zero por ele; aplicar esta resposta atrasada em
       * cima dele duplicaria/misturaria página. Descarta.
       */
      if (loadTokenRef.current === myToken) {
        setReviews((prev) => [...prev, ...result.reviews]);
        setHasMore(result.hasMore);
        setPage(nextPage);
      }
    } catch (error) {
      console.error("[useReviews] Falha ao buscar mais avaliações", error);
    } finally {
      /*
       * SEMPRE reseta, independente do token: `loadingMore` pertence a
       * ESTA chamada de `loadMore()` (ela mesma que ligou), não ao
       * resultado ter sido aplicado ou descartado — se só resetasse
       * quando o token bate, um `load()` mais novo no meio do caminho
       * deixaria o botão "Carregar mais" travado desabilitado/girando
       * pra sempre.
       */
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mesmo motivo do `load`, acima: só os campos primitivos de `target`.
  }, [target.mediaType, target.mediaId, page, hasMore, loadingMore]);

  useEffect(() => {
    load();
  }, [load]);

  /** TASK-125 (correção) — recarrega sozinho ao voltar pra esta tela, mesmo motivo de useLibraryItems.ts. */
  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target.mediaType, target.mediaId])
  );

  const submit = useCallback(
    async (rating: number, reviewText: string | null, containsSpoiler: boolean) => {
      setSaving(true);
      try {
        await upsertReview(target, { rating, reviewText, containsSpoiler });
        await load();
        return true;
      } catch (error) {
        console.error("[useReviews] Falha ao salvar avaliação", error);
        return false;
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital: mesmo motivo do `load` acima, depende só dos campos primitivos de `target`.
    [target.mediaType, target.mediaId, load]
  );

  /**
   * FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
   * 2026-09-26) — achado real na auditoria: esta função não devolvia
   * nada e só logava no console em caso de erro — diferente de
   * `submit`, acima, que já devolve `true`/`false`. Sem retorno, quem
   * chama (`ReviewsFullView.tsx`) não tinha como saber se apagar
   * falhou pra mostrar algo à pessoa; o `Alert` de confirmação, e o
   * aviso de erro, precisam desse retorno pra existir.
   */
  const remove = useCallback(async () => {
    if (!myReview) return false;
    setSaving(true);
    try {
      await deleteReview(myReview.id);
      await load();
      return true;
    } catch (error) {
      console.error("[useReviews] Falha ao remover avaliação", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [myReview, load]);

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  return { reviews, othersReviews, myReview, isLoading, saving, submit, remove, hasMore, loadingMore, loadMore };
}
