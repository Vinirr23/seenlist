"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
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
 * TASK-170 (trazido do mobile, a pedido — "deixa a versão web desse
 * mesmo jeito") — episódios já lançados EM ORDEM, estejam assistidos
 * ou não (antes só trazia os pendentes). Mesma função e mesmo nome
 * do mobile (`lib/seriesDetails.ts`), só que em TS puro pro web.
 */
function getPendingEpisodes(seasons: SeasonWithEpisodes[], _watched: Set<WatchedEpisodeKey> | undefined): EpisodeRef[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: EpisodeRef[] = [];

  for (const season of [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
    for (const episode of [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      if (!isAired(episode, today)) continue;
      result.push({ seasonNumber: season.seasonNumber, episode });
    }
  }
  return result;
}

/**
 * TASK-170 (trazido do mobile) — não depende mais da categoria.
 * Sempre mostra todos os episódios já lançados, em qualquer status
 * de biblioteca — antes ficava vazio bem nas categorias "Em dia"/
 * "Concluída"/"Assistir depois", que era exatamente quando um
 * histórico completo fazia mais sentido de ver.
 */
function resolveCarouselEpisodes(
  _category: string | null | undefined,
  seasons: SeasonWithEpisodes[],
  watched: Set<WatchedEpisodeKey> | undefined
): EpisodeRef[] {
  return getPendingEpisodes(seasons, watched);
}

export interface EpisodeCarouselProps {
  seriesId: number;
  seriesSlug: string;
  category: string | null | undefined;
  seasons: SeasonWithEpisodes[];
  colorClass?: string;
}

const ITEM_WIDTH = 144; // w-36 (9rem)
const ITEM_GAP = 12; // gap-3 (0.75rem)

export function EpisodeCarousel({ seriesId, seriesSlug, category, seasons, colorClass }: EpisodeCarouselProps) {
  const { data: watched } = useWatchedEpisodes(seriesId);
  const toggleWatched = useToggleEpisodeWatched(seriesId);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasUserScrolledRef = useRef(false);

  const items = useMemo(
    () => resolveCarouselEpisodes(category, seasons, watched),
    [category, seasons, watched]
  );

  /**
   * TASK-170 (trazido do mobile) — rolagem automática pro primeiro
   * episódio ainda não assistido; se não sobrar nenhum (série "Em
   * dia"/"Concluída"), rola pro FINAL da lista (onde fica o episódio
   * mais recente), em vez de ficar parada no episódio 1. Web nunca
   * teve essa rolagem — sempre abria no início, mesmo fundo de uma
   * lista de 80+ episódios.
   */
  useEffect(() => {
    if (hasUserScrolledRef.current || !containerRef.current || items.length === 0) return;
    const firstUnwatchedIndex = items.findIndex(
      ({ seasonNumber, episode }) => !isEpisodeWatched(watched, seasonNumber, episode.episodeNumber)
    );
    const targetIndex = firstUnwatchedIndex === -1 ? items.length - 1 : firstUnwatchedIndex;
    if (targetIndex > 0) {
      containerRef.current.scrollLeft = targetIndex * (ITEM_WIDTH + ITEM_GAP);
    }
  }, [items, watched]);

  if (items.length === 0) return null;

  function handleToggle(seasonNumber: number, episodeNumber: number, currentlyWatched: boolean) {
    hapticTick();
    toggleWatched.mutate({ seasonNumber, episodeNumber, watched: currentlyWatched });
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">Episódios</h2>
      <div
        ref={containerRef}
        onScroll={() => {
          hasUserScrolledRef.current = true;
        }}
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
      >
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
