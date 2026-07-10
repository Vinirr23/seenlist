"use client";

import { Plus, Check } from "lucide-react";
import { useSeriesStatus } from "@/lib/queries/series-status-state";
import { useSetSeriesStatus } from "@/lib/queries/series-status-mutations";
import { useMovieStatus } from "@/lib/queries/movie-status-state";
import { useSetMovieStatus } from "@/lib/queries/movie-status-mutations";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@seenlist/utils";

export interface AddToLibraryButtonProps {
  mediaType: "movie" | "series";
  mediaId: number;
  className?: string;
}

/**
 * TASK-058 — botão "+" dos cards de descoberta. Reaproveita
 * useSetSeriesStatus/useSetMovieStatus (já existiam, usados em toda
 * a Biblioteca) — "adicionar" aqui é só marcar como "Assistir
 * depois", a mesma ação que qualquer outro "+" do app já faz.
 */
export function AddToLibraryButton({ mediaType, mediaId, className }: AddToLibraryButtonProps) {
  const seriesStatus = useSeriesStatus(mediaType === "series" ? mediaId : -1);
  const movieStatus = useMovieStatus(mediaType === "movie" ? mediaId : -1);
  const setSeriesStatus = useSetSeriesStatus(mediaId);
  const setMovieStatus = useSetMovieStatus(mediaId);

  const currentStatus = mediaType === "series" ? seriesStatus.data : movieStatus.data;
  const isAdded = currentStatus != null;
  const isPending = mediaType === "series" ? setSeriesStatus.isPending : setMovieStatus.isPending;

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    hapticTick();
    if (isAdded) return; // já está na biblioteca — "+" não remove, só adiciona (mesmo padrão do TV Time)
    if (mediaType === "series") {
      setSeriesStatus.mutate({ status: "want_to_watch", currentStatus: null });
    } else {
      setMovieStatus.mutate({ status: "want_to_watch", currentStatus: null });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isAdded ? "Já está na biblioteca" : "Adicionar à biblioteca"}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded border-2 border-primary bg-background/80 text-primary backdrop-blur-sm transition-transform active:scale-90 disabled:opacity-60",
        className
      )}
    >
      {isAdded ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
    </button>
  );
}
