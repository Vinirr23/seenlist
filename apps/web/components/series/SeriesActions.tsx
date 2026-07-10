"use client";

import { useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import type { LibraryStatus } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { useSeriesStatus, useSetSeriesStatus } from "@/lib/queries/series-status";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { InlineError } from "../media/InlineError";
import { FavoriteButton } from "../media/FavoriteButton";
import { SeriesQuickActionsSheet } from "../profile/SeriesQuickActionsSheet";

/**
 * TASK-044 — filosofia do TV Time: o progresso dos episódios já
 * decide se a série está "Assistindo"/"Em dia"/"Assistidas"
 * (`recalculateSeriesCategoryAfterEpisodeChange`, TASK-043) — pedir
 * pro usuário CONFIRMAR manualmente que está assistindo algo que já
 * está sendo assistido é redundante. O botão "Assistindo" saiu
 * daqui; a tela não gerencia mais status ativo/inativo, só reage ao
 * progresso real de episódios.
 *
 * "Assistir depois" continua existindo, mas só enquanto fizer
 * sentido: uma vez que a série tem status real (watching/up_to_date/
 * completed/paused — ou seja, o usuário já começou de algum jeito,
 * seja marcando episódio ou reimportando), "assistir depois" deixa
 * de ser uma opção coerente e desaparece — igual ao TV Time, que não
 * te deixa "adicionar pra depois" algo que você já está acompanhando.
 *
 * Ações manuais (Interrompidas, Remover, Lista, Compartilhar) — que
 * antes não existiam nesta tela — moraram pro menu "Mais opções",
 * reaproveitando o mesmo sheet que já existia pro long-press nos
 * pôsteres da Biblioteca (SeriesQuickActionsSheet), não duplicando
 * um segundo menu com as mesmas opções.
 */
export function SeriesActions({ seriesId, seriesTitle }: { seriesId: number; seriesTitle: string }) {
  const { data: currentStatus, isError: readFailed } = useSeriesStatus(seriesId);
  const setStatus = useSetSeriesStatus(seriesId);
  const toast = useToast();
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const hasActiveStatus = currentStatus != null && currentStatus !== "want_to_watch";
  const isInWantToWatch = currentStatus === "want_to_watch";

  function handleWantToWatch() {
    hapticTick();
    setStatus.mutate(
      { status: "want_to_watch", currentStatus: currentStatus ?? null },
      {
        onSuccess: () => toast.success(isInWantToWatch ? "Série removida" : "Série adicionada"),
        onError: () => toast.error("Erro de conexão"),
      }
    );
  }

  return (
    <div className="space-y-1.5 px-4">
      <div className="flex gap-2">
        {!hasActiveStatus && (
          <button
            type="button"
            disabled={setStatus.isPending}
            aria-pressed={isInWantToWatch}
            onClick={handleWantToWatch}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors active:scale-[0.96] disabled:opacity-50",
              isInWantToWatch
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:border-primary/50 hover:text-text"
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            {isInWantToWatch ? "Na lista" : "Assistir depois"}
          </button>
        )}
        <FavoriteButton mediaType="series" mediaId={seriesId} />
        <button
          type="button"
          aria-label="Mais opções"
          onClick={() => {
            hapticTick();
            setShowMoreOptions(true);
          }}
          className={cn(
            "flex items-center justify-center rounded-lg border border-border px-3 py-2.5 text-muted transition-colors hover:border-primary/50 hover:text-text",
            !hasActiveStatus ? "" : "flex-1"
          )}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
      <InlineError show={setStatus.isError} />
      <InlineError show={readFailed} />

      {showMoreOptions && (
        <SeriesQuickActionsSheet
          seriesId={seriesId}
          seriesTitle={seriesTitle}
          currentStatus={(currentStatus ?? "want_to_watch") as LibraryStatus}
          onClose={() => setShowMoreOptions(false)}
        />
      )}
    </div>
  );
}
