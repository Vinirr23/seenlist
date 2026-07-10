"use client";

import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { useUpcomingEpisodes, type UpcomingBadge } from "@/lib/queries/upcoming-episodes";
import { tmdbImage } from "@/lib/tmdb/image";
import { cn } from "@seenlist/utils";
import { HomeEmptyState } from "../media/HomeEmptyState";
import { HomeSkeleton } from "../media/HomeSkeleton";

/** TASK-054 — TMDB devolve literalmente "Episódio N"/"Episode N" quando ainda não existe título específico pro episódio — mostrar isso duplica o código T/E que já aparece acima, sem informação nova nenhuma. */
function isGenericEpisodeName(name: string, episodeNumber: number): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === `episódio ${episodeNumber}` || normalized === `episode ${episodeNumber}`;
}

/** TASK-053 — mesmas cores do mockup de referência: PREMIERE e MAIS RECENTE em branco/preto, NOVO em amarelo (cor primária do SeenList) — a única das três que usa a identidade de cor da marca, igual o botão "Assistido". */
const BADGE_CONFIG: Record<Exclude<UpcomingBadge, null>, { label: string; className: string }> = {
  premiere: { label: "PREMIERE", className: "bg-white text-black" },
  novo: { label: "NOVO", className: "bg-primary text-background" },
  "mais-recente": { label: "MAIS RECENTE", className: "bg-white text-black" },
};

/**
 * TASK-053 — layout ampliado pra bater com a referência: card maior,
 * badges abaixo do título (não acima), código T/E e nome do episódio
 * dentro da coluna de conteúdo. O horário grande à direita do mockup
 * NÃO foi replicado — o TMDB não devolve hora de exibição em
 * `next_episode_to_air` (só a data), e mostrar um horário inventado
 * seria pior do que não mostrar nenhum. No lugar dele, a emissora
 * ocupa esse espaço (a única informação real disponível ali).
 */
export function EmBreveSection() {
  const { groups, isLoading, isError } = useUpcomingEpisodes();

  if (isLoading) return <HomeSkeleton />;
  if (isError) {
    return (
      <HomeEmptyState message="Não foi possível carregar os próximos episódios agora. Tente de novo em instantes." />
    );
  }
  if (groups.length === 0) {
    return (
      <HomeEmptyState
        message="Nenhum episódio previsto. Continue acompanhando séries para receber novidades."
        actionLabel="Explorar séries"
        actionHref="/explore"
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey}>
          <div className="mb-3 flex justify-center">
            <span className="rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              {group.label}
            </span>
          </div>
          <div className="space-y-3">
            {group.episodes.map((episode) => {
              const posterUrl = tmdbImage(episode.posterPath, "w185");
              const badge = episode.badge ? BADGE_CONFIG[episode.badge] : null;
              const network = episode.networks[0] ?? null;
              const episodeCode = `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;
              const hasRealEpisodeName = episode.name && !isGenericEpisodeName(episode.name, episode.episodeNumber);

              return (
                <Link
                  key={`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`}
                  href={`/series/${episode.seriesId}`}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
                >
                  <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-background">
                    {posterUrl ? (
                      <Image src={posterUrl} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-base font-bold text-text">{episode.seriesTitle}</p>
                    {badge && (
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    )}
                    <p className="font-mono text-sm font-bold text-text">{episodeCode}</p>
                    {hasRealEpisodeName && <p className="truncate text-sm text-muted">{episode.name}</p>}
                  </div>

                  {network && (
                    <div className="shrink-0 self-center text-right">
                      <p className="text-xs text-muted">{network}</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
