"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { ChevronRight, Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { useSeriesDetails } from "@/lib/queries/series";
import { useWatchedEpisodes, isEpisodeWatched, type WatchedEpisodeKey } from "@/lib/queries/watched-episodes-state";
import { useToggleEpisodeWatched } from "@/lib/queries/watched-episodes-mutations";
import { computeBadge, hasEpisodeAired, type UpcomingBadge } from "@/lib/queries/upcoming-episodes";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@seenlist/utils";
import { EpisodeWatchedButton } from "../series/EpisodeWatchedButton";

const BADGE_CONFIG: Record<Exclude<UpcomingBadge, null>, { label: string; className: string }> = {
  premiere: { label: "PREMIERE", className: "bg-white text-black" },
  novo: { label: "NOVO", className: "bg-primary text-background" },
  "mais-recente": { label: "MAIS RECENTE", className: "bg-white text-black" },
};

/**
 * TASK-055 — "próximo episódio não assistido", ordenado por
 * (temporada, episódio) — a mesma noção de "assistir a seguir" que a
 * tela de detalhe da série já usa, só aplicada série por série aqui.
 */
function findNextUnwatched(
  seasons: {
    seasonNumber: number;
    episodes: { episodeNumber: number; name: string; stillPath: string | null; airDate: string | null }[];
  }[],
  watched: Set<WatchedEpisodeKey> | undefined
) {
  const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const season of sorted) {
    const episodes = [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    for (const ep of episodes) {
      if (!isEpisodeWatched(watched, season.seasonNumber, ep.episodeNumber)) {
        return { seasonNumber: season.seasonNumber, episode: ep };
      }
    }
  }
  return null;
}

/**
 * TASK-055 — "Minha Lista" enriquecida, no nível do TV Time: pôster
 * do EPISÓDIO (não da série), cápsula com nome da série, código T/E,
 * nome do episódio, badges (mesma regra de "Em breve", reutilizada
 * via `computeBadge`), botão de marcar assistido direto no card.
 * Cada card busca os próprios dados (useSeriesDetails +
 * useWatchedEpisodes) — é a forma correta de fazer isso numa lista
 * de tamanho variável sem violar a regra dos hooks (não dá pra
 * chamar hooks dentro de um .map de um componente só).
 */
export function ContinueWatchingCard({ item }: { item: LibraryItem }) {
  const { data: seriesDetails } = useSeriesDetails(String(item.id));
  const { data: watched } = useWatchedEpisodes(item.id);
  const toggleWatched = useToggleEpisodeWatched(item.id);

  const next = useMemo(() => {
    if (!seriesDetails) return null;
    return findNextUnwatched(seriesDetails.seasons, watched);
  }, [seriesDetails, watched]);

  if (!seriesDetails || !next) return null;

  /*
   * Correção (bug real, reportado): depois de "Continue assistindo"
   * passar a incluir séries "Em dia" (pra série que ganhou episódio
   * novo poder voltar a aparecer com o selo NOVO), sobrou um efeito
   * colateral — uma série "Em dia" cujo único episódio não assistido
   * ainda não foi ao ar (ex.: T03E06 previsto pra daqui a 2 dias)
   * também batia aqui, e o card aparecia como se já desse pra marcar
   * como assistido. Episódio que ainda não foi ao ar não é "continue
   * assistindo" — é "Em breve" (outra aba). Guard: se o próximo não
   * assistido ainda não tem data de exibição já passada, não mostra
   * o card aqui (a série continua listada normalmente em "Em breve"
   * enquanto isso).
   */
  if (!hasEpisodeAired(next.episode.airDate)) return null;

  const { seasonNumber, episode } = next;
  const badge =
    episode.airDate && watched
      ? computeBadge(
          { seriesId: item.id, seasonNumber, episodeNumber: episode.episodeNumber, airDate: episode.airDate },
          watched
        )
      : null;
  const badgeConfig = badge ? BADGE_CONFIG[badge] : null;
  const stillUrl = tmdbImage(episode.stillPath, "w300");
  const episodeCode = `T${String(seasonNumber).padStart(2, "0")} | E${String(episode.episodeNumber).padStart(2, "0")}`;

  function handleMarkWatched() {
    hapticTick();
    toggleWatched.mutate({ seasonNumber, episodeNumber: episode.episodeNumber, watched: false });
  }

  return (
    <Link
      href={`/series/${item.id}/season/${seasonNumber}/episode/${episode.episodeNumber}`}
      className="flex items-stretch gap-3 rounded-lg border border-border bg-surface p-3"
    >
      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-background">
        {stillUrl ? (
          <Image src={stillUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-text">
          {item.title}
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
        <p className="font-mono text-sm font-bold text-text">{episodeCode}</p>
        <p className="truncate text-sm text-muted">{episode.name}</p>
        {badgeConfig && (
          <span
            className={cn(
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
              badgeConfig.className
            )}
          >
            {badgeConfig.label}
          </span>
        )}
      </div>

      <EpisodeWatchedButton watched={false} onClick={handleMarkWatched} disabled={toggleWatched.isPending} size="lg" className="self-center" />
    </Link>
  );
}
