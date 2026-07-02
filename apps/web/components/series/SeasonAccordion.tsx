"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SeasonWithEpisodes } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { EpisodeCard } from "./EpisodeCard";
import { EmptyState } from "../search/EmptyState";
import {
  isEpisodeWatched,
  useToggleEpisodeWatched,
  type WatchedEpisodeKey,
} from "@/lib/queries/watched-episodes";

export interface SeasonAccordionProps {
  seriesId: number;
  season: SeasonWithEpisodes;
  watchedEpisodes: Set<WatchedEpisodeKey> | undefined;
  defaultOpen?: boolean;
}

export function SeasonAccordion({
  seriesId,
  season,
  watchedEpisodes,
  defaultOpen = false,
}: SeasonAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggleWatched = useToggleEpisodeWatched(seriesId);

  const watchedCount = season.episodes.filter((episode) =>
    isEpisodeWatched(watchedEpisodes, episode.seasonNumber, episode.episodeNumber)
  ).length;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-text">{season.name}</p>
          <p className="text-xs text-muted">
            {watchedCount}/{season.episodes.length} episódios assistidos
          </p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-border p-3">
          {season.episodes.length === 0 ? (
            <EmptyState message="Nenhum episódio encontrado para esta temporada." />
          ) : (
            season.episodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                watched={isEpisodeWatched(
                  watchedEpisodes,
                  episode.seasonNumber,
                  episode.episodeNumber
                )}
                pending={toggleWatched.isPending}
                onToggleWatched={() =>
                  toggleWatched.mutate({
                    seasonNumber: episode.seasonNumber,
                    episodeNumber: episode.episodeNumber,
                    watched: isEpisodeWatched(
                      watchedEpisodes,
                      episode.seasonNumber,
                      episode.episodeNumber
                    ),
                  })
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
