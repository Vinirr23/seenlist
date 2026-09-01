"use client";

import { useEffect, useMemo } from "react";
import { useSeriesEpisodesLight, groupBySeason } from "@/lib/queries/seriesEpisodesLight";
import { useWatchedEpisodes, useWatchedEpisodeIds } from "@/lib/queries/watched-episodes-state";
import { findPendingEpisodes } from "./ContinueWatchingCard";

export interface UpToDatePendingGateProps {
  seriesId: number;
  onResolved: (seriesId: number, hasPending: boolean) => void;
}

/**
 * BUG REAL CORRIGIDO NA RAIZ (2026-09-01, reportado — "está tudo em
 * dia, e não apareceu nada", print mostrando "CONTINUE WATCHING" com
 * espaço em branco embaixo, sem card e sem mensagem nenhuma) — este
 * componente é a MESMA checagem que já existia (extraída, sem
 * mudança de comportamento) de dentro de `ContinueWatchingPosterGrid.tsx`
 * (onde se chamava `UpToDateGate`, só usado ali). Movida pra cá
 * (compartilhada) porque a causa raiz do bug morava um nível ACIMA
 * de onde ela já era usada:
 *
 * `MinhaListaSection.tsx` decidia "tem algo pra mostrar em Continue
 * assistindo?" olhando só o STATUS bruto de cada série (`watching`
 * ou `up_to_date`) — mas uma série "em dia" só tem episódio de
 * verdade pra mostrar quando `findPendingEpisodes` (que exige buscar
 * os episódios da série na TMDB, então é ASSÍNCRONO) confirma isso.
 * Essa confirmação só acontecia DEPOIS, escondida dentro de cada
 * card/grade — tarde demais pra influenciar a decisão de mostrar a
 * mensagem de vazio ou não. Resultado: quando TODAS as séries "em
 * dia" da pessoa não tinham episódio pendente nenhum (cenário comum
 * — "tudo em dia" de verdade), o container achava que tinha algo
 * (`continueWatching.length > 0`, contava as séries "em dia"),
 * mandava renderizar os cards, e cada card se escondia sozinho ao
 * confirmar que não tinha nada — sobrando um espaço em branco, sem
 * nenhuma mensagem, no lugar de "Continue assistindo".
 *
 * A correção sobe esta MESMA checagem pro nível do container
 * (`MinhaListaSection.tsx` monta um `UpToDatePendingGate` pra cada
 * série "em dia" candidata, ANTES de decidir qual conteúdo mostrar)
 * — só depois de saber de verdade quantas têm episódio pendente é
 * que a tela decide entre a lista/grade normal e a mensagem de
 * vazio/"tudo em dia" (+ fileira "Populares no SeenList"). O antigo
 * `ContinueWatchingPosterGrid.tsx` não precisa mais fazer essa
 * checagem sozinho — o container já filtra a lista ANTES de repassar
 * pra grade (`PosterGrid`), então esse arquivo foi removido (só
 * existia pra isso).
 *
 * Não renderiza nada visível — só resolve, em segundo plano, se
 * `seriesId` tem episódio pendente de verdade, e avisa quem chamou
 * por `onResolved`.
 */
export function UpToDatePendingGate({ seriesId, onResolved }: UpToDatePendingGateProps) {
  const { data: episodes } = useSeriesEpisodesLight(seriesId);
  const { data: watched } = useWatchedEpisodes(seriesId);
  const { data: watchedEpisodeIds } = useWatchedEpisodeIds(seriesId);

  const hasPending = useMemo(() => {
    if (!episodes) return null;
    return findPendingEpisodes(groupBySeason(episodes), watched, watchedEpisodeIds).length > 0;
  }, [episodes, watched, watchedEpisodeIds]);

  useEffect(() => {
    if (hasPending !== null) onResolved(seriesId, hasPending);
  }, [hasPending, seriesId, onResolved]);

  return null;
}
