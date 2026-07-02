"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import type { Episode } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { cn } from "@seenlist/utils";

export interface EpisodeCardProps {
  episode: Episode;
  watched: boolean;
  onToggleWatched: () => void;
  pending?: boolean;
}

export function EpisodeCard({ episode, watched, onToggleWatched, pending }: EpisodeCardProps) {
  const stillUrl = tmdbImage(episode.stillPath, "w300");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2">
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-background">
        {stillUrl ? (
          <Image src={stillUrl} alt={episode.name} fill sizes="96px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">
            Sem imagem
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Episódio {episode.episodeNumber}</p>
        <p className="truncate text-sm font-medium text-text">{episode.name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {episode.runtimeMinutes ? `${episode.runtimeMinutes} min` : null}
          {episode.runtimeMinutes && episode.airDate ? " · " : null}
          {episode.airDate ?? null}
        </p>
      </div>

      <button
        type="button"
        onClick={onToggleWatched}
        disabled={pending}
        aria-pressed={watched}
        aria-label={watched ? "Marcar como não assistido" : "Marcar como assistido"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
          watched
            ? "border-primary bg-primary text-background"
            : "border-border text-muted hover:border-primary hover:text-primary"
        )}
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
