"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LibraryItem } from "@seenlist/types";
import { useSeriesEpisodesLight, groupBySeason } from "@/lib/queries/seriesEpisodesLight";
import { useWatchedEpisodes, useWatchedEpisodeIds } from "@/lib/queries/watched-episodes-state";
import { findPendingEpisodes } from "./ContinueWatchingCard";
import { PosterGrid } from "../profile/PosterGrid";

/**
 * BUG REAL (reportado — "Bleach aparece na lista e não na grade em
 * Minha Lista/Séries") — causa raiz: o modo lista sempre incluiu
 * séries "em dia" (`up_to_date`) na seção "Continue assistindo", mas
 * só mostra o card de verdade quando `ContinueWatchingCard` confirma
 * que ela tem episódio pendente (ele mesmo decide isso sozinho — se
 * não achar nada pendente, retorna `null`, nada aparece). O modo
 * grade (`PosterGrid`) nunca fez essa checagem: ele é um componente
 * burro e genérico, reaproveitado em várias telas (Perfil, perfil
 * público, Favoritos etc.) — nunca teve, nem devia ganhar, lógica de
 * "tem episódio pendente" embutida nele, porque isso quebraria essas
 * outras telas. Por isso a grade sempre excluiu QUALQUER série "em
 * dia" de propósito (decisão antiga, documentada em
 * `MinhaListaSection.tsx`) — mesmo uma com episódio pendente de
 * verdade, como o Bleach.
 *
 * A PEDIDO (2026-08-25, unificar os dois modos) — este componente
 * fecha essa lacuna sem mexer no `PosterGrid` genérico: cada série
 * "em dia" passa por um "portão" (`UpToDateGate`, abaixo) que faz a
 * MESMA checagem que o `ContinueWatchingCard` já faz
 * (`findPendingEpisodes`, reaproveitada de lá, sem duplicar a regra)
 * e só libera a série pra entrar na grade quando confirma que ela
 * tem episódio pendente de verdade. Séries "assistindo" (`watching`)
 * sempre entram direto, sem checagem — só "em dia" precisa da
 * confirmação. Enquanto a checagem de uma série "em dia" ainda não
 * resolveu, ela fica de fora (mesmo comportamento do modo lista
 * antes de `ContinueWatchingCard` terminar de carregar).
 */
export function ContinueWatchingPosterGrid({ items }: { items: LibraryItem[] }) {
  const upToDateIds = useMemo(
    () => items.filter((item) => item.status === "up_to_date").map((item) => item.id),
    [items]
  );

  const [confirmedPending, setConfirmedPending] = useState<Record<number, boolean>>({});

  const handleResolved = useCallback((seriesId: number, hasPending: boolean) => {
    setConfirmedPending((current) =>
      current[seriesId] === hasPending ? current : { ...current, [seriesId]: hasPending }
    );
  }, []);

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.status !== "up_to_date") return true;
        return confirmedPending[item.id] === true;
      }),
    [items, confirmedPending]
  );

  return (
    <>
      {upToDateIds.map((seriesId) => (
        <UpToDateGate key={seriesId} seriesId={seriesId} onResolved={handleResolved} />
      ))}
      <PosterGrid items={visibleItems} />
    </>
  );
}

/** Não renderiza nada visível — só resolve, em segundo plano, se `seriesId` tem episódio pendente de verdade, e avisa o componente pai por `onResolved`. */
function UpToDateGate({
  seriesId,
  onResolved,
}: {
  seriesId: number;
  onResolved: (seriesId: number, hasPending: boolean) => void;
}) {
  const { data: episodes } = useSeriesEpisodesLight(seriesId);
  const { data: watched } = useWatchedEpisodes(seriesId);
  // CORREÇÃO (2026-08-26 — "motor resistente") — ver isEpisodeWatched (watched-episodes-state.ts).
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
