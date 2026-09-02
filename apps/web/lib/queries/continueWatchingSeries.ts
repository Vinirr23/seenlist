"use client";

import { useCallback, useMemo, useState } from "react";
import { useLibraryItems } from "./library";

export interface UseContinueWatchingSeriesOptions {
  /**
   * Teto opcional de quantas séries entram na lista final (aplicado
   * ANTES da confirmação de pendência — ver comentário completo
   * abaixo). Omitido = sem corte, lista completa.
   */
  limit?: number;
}

/**
 * "Faz um tempo que você não assiste" — série em "Assistindo" sem
 * NENHUM episódio marcado há 2 semanas desce automaticamente de
 * "Continue assistindo" pra essa seção separada. Movido pra cá
 * junto com o resto (antes vivia só em `MinhaListaSection.tsx`) —
 * "Ver tudo" precisa da MESMA exclusão, senão uma série parada
 * apareceria em dois lugares ao mesmo tempo (Home E "Ver tudo").
 */
const STALE_AFTER_DAYS = 14;

/**
 * A PEDIDO (2026-09-01 — "sobre o limite de 8 cards na home, me
 * relembra a solução") — hook NOVO, extraído de dentro de
 * `MinhaListaSection.tsx` pra ser reaproveitado também pela tela
 * "Ver tudo" (`ContinueWatchingAllView.tsx`), sem duplicar a regra
 * num segundo lugar.
 *
 * PORQUÊ EXTRAIR (não é só organização) — essa MESMA duplicação já
 * causou um bug real nesta base (ver `SEENLIST-HANDOFF.md`, "Bleach
 * aparece na lista e não na grade"): duas cópias manuais da mesma
 * lógica de filtro/confirmação divergiam sem ninguém perceber.
 * Home (com `limit: CONTINUE_ASSISTINDO_LIMIT`) e "Ver tudo" (sem
 * `limit`) precisam do EXATO mesmo filtro, ordenação e confirmação
 * assíncrona de pendência — só o corte final muda.
 *
 * SEM CONSULTA NOVA AO BANCO (achado real, conferido antes de
 * implementar, respondendo à preocupação do usuário) — `useLibraryItems()`
 * já busca a biblioteca INTEIRA de uma vez (não é paginado por
 * `limit` nenhum na consulta em si), porque essa mesma busca também
 * alimenta "Faz um tempo que você não assiste" e outras seções da
 * Home. `limit` aqui só corta o que é EXIBIDO, depois que o dado
 * completo já está em memória/cache do React Query — abrir "Ver
 * tudo" (sem `limit`) reaproveita o MESMO cache, sem round-trip
 * novo, mesmo se aberto direto (sem passar pela Home antes) — o
 * `useLibraryItems()` de lá dispara a mesma busca sozinho.
 *
 * `limit` corta ANTES da confirmação de pendência (mesma ordem de
 * sempre — ver "BUG REAL CORRIGIDO NA RAIZ" no histórico de
 * `MinhaListaSection.tsx`) — de propósito: só as candidatas que vão
 * de fato aparecer precisam pagar o custo de checar no TMDB se têm
 * episódio pendente de verdade. Na Home (8 candidatas no máximo),
 * isso mantém o número de checagens baixo; em "Ver tudo" (sem
 * `limit`), TODAS as séries "em dia" da pessoa passam por essa
 * checagem — mais chamadas ao TMDB que a Home, mas ainda client-side,
 * sem rota de API nova.
 */
export function useContinueWatchingSeries({ limit }: UseContinueWatchingSeriesOptions = {}) {
  const { data: items, isLoading, isError, error, refetch } = useLibraryItems();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  // Corte por `lastActivityAt` (episódio realmente assistido), 14
  // dias — feito ANTES do filtro de "Continue assistindo" porque as
  // duas listas não podem mostrar a mesma série ao mesmo tempo.
  const { recentSeries, staleSeries } = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const recent: typeof series = [];
    const stale: typeof series = [];

    for (const item of series) {
      // Só "watching" pode ficar parada — "Em dia" não tem nada
      // pendente pra assistir, então não faz sentido cobrar.
      const isStale = item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff;
      (isStale ? stale : recent).push(item);
    }

    stale.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return { recentSeries: recent, staleSeries: stale };
  }, [series]);

  // Mesmo filtro + mesma ordenação em duas camadas de sempre
  // (watching sempre antes de up_to_date, dentro de cada grupo por
  // `updatedAt`) — ver histórico completo em `MinhaListaSection.tsx`.
  const continueWatchingCandidates = useMemo(() => {
    const sorted = recentSeries
      .filter((item) => item.status === "watching" || item.status === "up_to_date")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
    const limited = typeof limit === "number" ? sorted.slice(0, limit) : sorted;

    /**
     * TEMPORÁRIO (diagnóstico, 2026-09-02 — "ainda só aparece reacher
     * na home... não tente adivinhar, procure a fundo") — hipótese
     * sendo testada: o corte de `limit` (8, só na Home) acontece ANTES
     * de saber quais candidatas "em dia" realmente têm episódio
     * pendente de verdade (isso só é confirmado depois, pelo
     * `UpToDatePendingGate`, um nível acima). Se o usuário tiver mais
     * de 8 séries "watching"/"em dia" no total, séries "em dia" sem
     * nada pendente (que vão ser escondidas de qualquer jeito) podem
     * estar ocupando vaga no top-8 e empurrando pra fora da janela uma
     * série que TEM episódio pendente de verdade — "Ver tudo" (sem
     * limit) nunca teria esse problema, porque avalia todo mundo.
     * Só loga quando `limit` está definido (só a Home chama assim;
     * "Ver tudo" não passa `limit`) — remover depois de confirmado.
     */
    if (typeof limit === "number" && typeof window !== "undefined") {
      console.log(
        `[DIAGNÓSTICO continue-watching] total de candidatas watching/em-dia: ${sorted.length} | limite: ${limit} | cortadas pelo limite (nunca chegam a ser avaliadas): ${Math.max(0, sorted.length - limit)}`
      );
      console.table(
        sorted.map((item, index) => ({
          posicao: index + 1,
          dentroDoTop8: index < limit,
          id: item.id,
          titulo: item.title,
          status: item.status,
          updatedAt: item.updatedAt,
        }))
      );
    }

    return limited;
  }, [recentSeries, limit]);

  const [confirmedPending, setConfirmedPending] = useState<Record<number, boolean>>({});
  const handlePendingResolved = useCallback((seriesId: number, hasPending: boolean) => {
    setConfirmedPending((current) => (current[seriesId] === hasPending ? current : { ...current, [seriesId]: hasPending }));
  }, []);

  const upToDateCandidateIds = useMemo(
    () => continueWatchingCandidates.filter((item) => item.status === "up_to_date").map((item) => item.id),
    [continueWatchingCandidates]
  );

  // "watching" sempre conta; "em dia" só conta depois que
  // `UpToDatePendingGate` (montado pelo chamador, um por id em
  // `upToDateCandidateIds`) confirmar `true`.
  const visibleContinueWatching = useMemo(
    () => continueWatchingCandidates.filter((item) => item.status === "watching" || confirmedPending[item.id] === true),
    [continueWatchingCandidates, confirmedPending]
  );

  const stillResolvingPending =
    visibleContinueWatching.length === 0 && upToDateCandidateIds.some((id) => confirmedPending[id] === undefined);

  return {
    series,
    staleSeries,
    isLoading,
    isError,
    error,
    refetch,
    visibleContinueWatching,
    upToDateCandidateIds,
    handlePendingResolved,
    stillResolvingPending,
  };
}
