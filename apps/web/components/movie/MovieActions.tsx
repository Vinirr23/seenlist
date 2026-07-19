"use client";

import { useState } from "react";
import { Check, Plus, MoreVertical } from "lucide-react";
import type { MovieWatchStatus } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { useMovieStatus, useSetMovieStatus, useIncrementMovieRewatch } from "@/lib/queries/movie-status";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { InlineError } from "../media/InlineError";
import { FavoriteButton } from "../media/FavoriteButton";
import { WatchedActionsBottomSheet } from "../media/WatchedActionsBottomSheet";
import { MovieQuickActionsSheet } from "./MovieQuickActionsSheet";

/**
 * TASK-172 (ajuste — a pedido) — só 3 botões principais, igual
 * série: Assistido, Assistir depois, e o coração de favorito (não
 * está nesta lista — é renderizado à parte, fora do `.map`).
 * "Assistindo" saiu da fileira principal — nunca fez tanto sentido
 * pra filme quanto pra série (que tem progresso de episódio de
 * verdade), e a mesma decisão já valia pra série (não é mais
 * escolhido manualmente ali também). "Recomendar" saiu da fileira
 * principal e foi pro menu "...", que ganhou junto: adicionar a
 * lista (não existia pra filme, achado real), remover, compartilhar
 * — mesmo conjunto do menu de série, sem "favoritar" (já é botão
 * principal aqui, seria redundante).
 */
const OPTIONS: { status: MovieWatchStatus; labelKey: string; icon: typeof Check }[] = [
  { status: "watched", labelKey: "action.watched", icon: Check },
  { status: "want_to_watch", labelKey: "library.tab.wantToWatch", icon: Plus },
];

export function MovieActions({ movieId, movieTitle }: { movieId: number; movieTitle: string }) {
  const { data: currentStatus } = useMovieStatus(movieId);
  const setStatus = useSetMovieStatus(movieId);
  const incrementRewatch = useIncrementMovieRewatch(movieId);
  const toast = useToast();
  const { t } = useTranslation();
  const [showWatchedActions, setShowWatchedActions] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  function handleClick(option: (typeof OPTIONS)[number]) {
    // TASK-047 — igual TV Time: tocar em "Assistido" quando já está assistido não desmarca direto, abre o "Marcar como...".
    if (option.status === "watched" && currentStatus === "watched") {
      hapticTick();
      setShowWatchedActions(true);
      return;
    }

    const wasActive = currentStatus === option.status;
    hapticTick();
    setStatus.mutate(
      { status: option.status, currentStatus: currentStatus ?? null },
      {
        onSuccess: () => toast.success(wasActive ? t("toast.movieRemoved") : t("toast.movieAdded")),
        onError: () => toast.error(t("toast.connectionError")),
      }
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {OPTIONS.map((option) => {
          const { status, labelKey, icon: Icon } = option;
          const active = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              disabled={setStatus.isPending}
              aria-pressed={active}
              onClick={() => handleClick(option)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors active:scale-[0.96] disabled:opacity-50",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted hover:border-primary/50 hover:text-text"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {t(labelKey)}
            </button>
          );
        })}
        <FavoriteButton mediaType="movie" mediaId={movieId} />
        <button
          type="button"
          aria-label={t("action.more")}
          onClick={() => {
            hapticTick();
            setShowMoreOptions(true);
          }}
          className="flex shrink-0 items-center justify-center rounded-lg border border-border px-3 text-muted transition-colors hover:border-primary/50 hover:text-text"
        >
          <MoreVertical className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
      <InlineError show={setStatus.isError} />

      {showMoreOptions && (
        <MovieQuickActionsSheet movieId={movieId} movieTitle={movieTitle} onClose={() => setShowMoreOptions(false)} />
      )}

      {showWatchedActions && (
        <WatchedActionsBottomSheet
          target={{
            onUnwatch: () => {
              setStatus.mutate(
                { status: "watched", currentStatus: "watched" },
                {
                  onSuccess: () => toast.success(t("toast.movieRemoved")),
                  onError: () => toast.error(t("toast.connectionError")),
                }
              );
            },
            onRewatch: () => {
              incrementRewatch.mutate(undefined, {
                onSuccess: () => toast.success(t("toast.rewatched")),
                onError: () => toast.error(t("toast.connectionError")),
              });
            },
          }}
          onClose={() => setShowWatchedActions(false)}
        />
      )}
    </div>
  );
}
