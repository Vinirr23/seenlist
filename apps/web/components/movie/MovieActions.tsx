"use client";

import { useState } from "react";
import { Check, Plus, Play } from "lucide-react";
import type { MovieWatchStatus } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { useMovieStatus, useSetMovieStatus, useIncrementMovieRewatch } from "@/lib/queries/movie-status";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { InlineError } from "../media/InlineError";
import { FavoriteButton } from "../media/FavoriteButton";
import { WatchedActionsBottomSheet } from "../media/WatchedActionsBottomSheet";

const OPTIONS: { status: MovieWatchStatus; label: string; icon: typeof Check }[] = [
  { status: "watched", label: "Assistido", icon: Check },
  { status: "want_to_watch", label: "Quero assistir", icon: Plus },
  { status: "watching", label: "Assistindo", icon: Play },
];

export function MovieActions({ movieId }: { movieId: number }) {
  const { data: currentStatus } = useMovieStatus(movieId);
  const setStatus = useSetMovieStatus(movieId);
  const incrementRewatch = useIncrementMovieRewatch(movieId);
  const toast = useToast();
  const [showWatchedActions, setShowWatchedActions] = useState(false);

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
        onSuccess: () => toast.success(wasActive ? "Filme removido" : "Filme adicionado"),
        onError: () => toast.error("Erro de conexão"),
      }
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        {OPTIONS.map((option) => {
          const { status, label, icon: Icon } = option;
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
              {label}
            </button>
          );
        })}
        <FavoriteButton mediaType="movie" mediaId={movieId} />
      </div>
      <InlineError show={setStatus.isError} />

      {showWatchedActions && (
        <WatchedActionsBottomSheet
          target={{
            onUnwatch: () => {
              setStatus.mutate(
                { status: "watched", currentStatus: "watched" },
                {
                  onSuccess: () => toast.success("Filme removido"),
                  onError: () => toast.error("Erro de conexão"),
                }
              );
            },
            onRewatch: () => {
              incrementRewatch.mutate(undefined, {
                onSuccess: () => toast.success("Reassistido"),
                onError: () => toast.error("Erro de conexão"),
              });
            },
          }}
          onClose={() => setShowWatchedActions(false)}
        />
      )}
    </div>
  );
}
