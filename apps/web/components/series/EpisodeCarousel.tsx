"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Clapperboard } from "lucide-react";
import type { SeasonWithEpisodes, Episode } from "@seenlist/types";
import { useWatchedEpisodes, useToggleEpisodeWatched, isEpisodeWatched, type WatchedEpisodeKey } from "@/lib/queries/watched-episodes";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";

interface EpisodeRef {
  seasonNumber: number;
  episode: Episode;
}

function isAired(episode: Episode, today: Date): boolean {
  if (!episode.airDate) return false;
  return new Date(`${episode.airDate}T00:00:00`) <= today;
}

/**
 * TASK-057 — episódios já lançados e ainda não assistidos, em ordem
 * (temporada, episódio). Mesma noção de "pendente" já usada em
 * outros lugares do app (ex.: ContinueWatchingCard) — sem inventar
 * uma regra nova.
 */
function getPendingEpisodes(seasons: SeasonWithEpisodes[], watched: Set<WatchedEpisodeKey> | undefined): EpisodeRef[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: EpisodeRef[] = [];

  for (const season of [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
    for (const episode of [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      if (isEpisodeWatched(watched, season.seasonNumber, episode.episodeNumber)) continue;
      if (!isAired(episode, today)) continue;
      result.push({ seasonNumber: season.seasonNumber, episode });
    }
  }
  return result;
}

/** O próximo episódio com data de lançamento no futuro — o mais próximo dela. */
function getNextUpcomingEpisode(seasons: SeasonWithEpisodes[]): EpisodeRef | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let best: EpisodeRef | null = null;

  for (const season of seasons) {
    for (const episode of season.episodes) {
      if (!episode.airDate) continue;
      const airDate = new Date(`${episode.airDate}T00:00:00`);
      if (airDate <= today) continue;
      if (!best || !best.episode.airDate || airDate < new Date(`${best.episode.airDate}T00:00:00`)) {
        best = { seasonNumber: season.seasonNumber, episode };
      }
    }
  }
  return best;
}

/**
 * TASK-057 — decide o conteúdo do carrossel pela categoria da série,
 * exatamente como especificado. Categorias sem fila natural de
 * episódios (Assistidas, Assistir depois, ou status desconhecido)
 * escondem o carrossel — não inventam uma fila fake.
 */
function resolveCarouselEpisodes(
  category: string | null | undefined,
  seasons: SeasonWithEpisodes[],
  watched: Set<WatchedEpisodeKey> | undefined
): EpisodeRef[] {
  if (category === "watching") {
    return getPendingEpisodes(seasons, watched);
  }
  if (category === "paused") {
    const pending = getPendingEpisodes(seasons, watched);
    const first = pending[0];
    return first ? [first] : [];
  }
  if (category === "up_to_date") {
    const next = getNextUpcomingEpisode(seasons);
    return next ? [next] : [];
  }
  // "completed" e "want_to_watch" (e qualquer status desconhecido): sem carrossel.
  return [];
}

export interface EpisodeCarouselProps {
  seriesId: number;
  seriesSlug: string;
  category: string | null | undefined;
  seasons: SeasonWithEpisodes[];
  colorClass?: string;
}

export function EpisodeCarousel({ seriesId, seriesSlug, category, seasons, colorClass }: EpisodeCarouselProps) {
  const { data: watched } = useWatchedEpisodes(seriesId);
  const toggleWatched = useToggleEpisodeWatched(seriesId);

  const items = useMemo(
    () => resolveCarouselEpisodes(category, seasons, watched),
    [category, seasons, watched]
  );

  if (items.length === 0) return null;

  function handleToggle(seasonNumber: number, episodeNumber: number, currentlyWatched: boolean) {
    hapticTick();
    toggleWatched.mutate({ seasonNumber, episodeNumber, watched: currentlyWatched });
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">Episódios</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map(({ seasonNumber, episode }) => {
          const stillUrl = tmdbImage(episode.stillPath, "w300");
          const watchedNow = isEpisodeWatched(watched, seasonNumber, episode.episodeNumber);
          const code = `S${String(seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;

          return (
            <div key={`${seasonNumber}-${episode.episodeNumber}`} className="w-36 shrink-0">
              <Link
                href={`/series/${seriesSlug}/season/${seasonNumber}/episode/${episode.episodeNumber}`}
                className="block"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface">
                  {stillUrl ? (
                    <Image src={stillUrl} alt="" fill sizes="144px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <p className="mt-1.5 truncate font-mono text-xs font-semibold text-text">{code}</p>
                <p className="truncate text-xs text-muted">{episode.name}</p>
              </Link>

              <EpisodeWatchedButton
                watched={watchedNow}
                onClick={() => handleToggle(seasonNumber, episode.episodeNumber, watchedNow)}
                disabled={toggleWatched.isPending}
                size="sm"
                className="mt-1.5"
                colorClass={colorClass}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
