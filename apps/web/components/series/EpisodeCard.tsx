"use client";

import Image from "next/image";
import Link from "next/link";
import type { Episode } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";

export interface EpisodeCardProps {
  seriesId: number;
  episode: Episode;
  watched: boolean;
  onToggleWatched: () => void;
  pending?: boolean;
  colorClass?: string;
}

/**
 * TASK-030 — "ao abrir um episódio: não abrir modal, abrir uma
 * página dedicada". A linha inteira agora é um `Link` pra
 * `/series/[id]/season/[s]/episode/[e]` — o botão de marcar como
 * assistido continua funcionando direto na lista (sem precisar abrir
 * a página), via `stopPropagation` pra não disparar a navegação
 * junto.
 */
export function EpisodeCard({ seriesId, episode, watched, onToggleWatched, pending, colorClass }: EpisodeCardProps) {
  const stillUrl = tmdbImage(episode.stillPath, "w300");

  return (
    <Link
      href={`/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2 transition-colors hover:border-primary/40"
    >
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-background">
        {stillUrl ? (
          <Image src={stillUrl} alt={episode.name} fill sizes="96px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">Sem imagem</div>
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

      <EpisodeWatchedButton watched={watched} onClick={onToggleWatched} disabled={pending} colorClass={colorClass} />
    </Link>
  );
}
