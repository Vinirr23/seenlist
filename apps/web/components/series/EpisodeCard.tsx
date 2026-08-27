"use client";

import Image from "next/image";
import Link from "next/link";
import type { Episode } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useTranslation();

  return (
    // "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — "glass-row".
    <Link
      href={`/series/${seriesId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
      className="flex items-center gap-3 rounded-2xl border border-white/10 p-2 backdrop-blur-[18px] backdrop-saturate-[180%] transition-colors hover:border-primary/40"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-background">
        {stillUrl ? (
          <Image src={stillUrl} alt={episode.name} fill sizes="96px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">{t("episode.noImage")}</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{t("series.episodeNumber", { number: episode.episodeNumber })}</p>
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
