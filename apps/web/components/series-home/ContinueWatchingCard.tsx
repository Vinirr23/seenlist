"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { ChevronRight, Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { useSeriesEpisodesLight, groupBySeason } from "@/lib/queries/seriesEpisodesLight";
import { useWatchedEpisodes, isEpisodeWatched, type WatchedEpisodeKey } from "@/lib/queries/watched-episodes-state";
import { useToggleEpisodeWatched } from "@/lib/queries/watched-episodes-mutations";
import { computeBadge, hasEpisodeAired, type UpcomingBadge } from "@/lib/queries/upcoming-episodes";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { EpisodeWatchedButton } from "../series/EpisodeWatchedButton";

const BADGE_LABEL_KEY: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "seriesHome.badge.premiere",
  novo: "seriesHome.badge.new",
  "mais-recente": "seriesHome.badge.latest",
};

const BADGE_CLASSNAME: Record<Exclude<UpcomingBadge, null>, string> = {
  premiere: "bg-white text-black",
  novo: "bg-primary text-background",
  "mais-recente": "bg-white text-black",
};

/**
 * TASK-055 — "próximo episódio não assistido", ordenado por
 * (temporada, episódio) — a mesma noção de "assistir a seguir" que a
 * tela de detalhe da série já usa, só aplicada série por série aqui.
 *
 * CORREÇÃO (a pedido, achado real — "o card não mostra +N episódios
 * como no mobile") — reescrito pra devolver a lista INTEIRA de
 * pendentes (não só o primeiro), espelhando exatamente
 * `lib/nextEpisodeToWatch.ts` do mobile: mesmo filtro (episódio sem
 * data conhecida OU já ao ar — nunca exclui por "data desconhecida",
 * mesma correção do Tanya the Evil/Daemons já aplicada aqui antes),
 * mesma ordenação. `additionalPendingCount` (o "+N") é
 * `pending.length - 1` — quantos outros episódios além do mostrado
 * já estão liberados pra assistir.
 *
 * CORREÇÃO 2 (a pedido — bug NOVO, introduzido pela correção acima —
 * "temporada nova confirmada mas SEM data de lançamento apareceu
 * como pendente à toa") — episódio sem data só conta como "pode já
 * ter saído" se a MESMA temporada tiver pelo menos um outro episódio
 * com data confirmada e já passada. Temporada inteira sem nenhuma
 * data (especulação de futuro, ainda sem estreia) não conta mais.
 */
function findPendingEpisodes(
  seasons: {
    seasonNumber: number;
    episodes: { episodeNumber: number; name: string; airDate: string | null }[];
  }[],
  watched: Set<WatchedEpisodeKey> | undefined
) {
  const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const pending: { seasonNumber: number; episode: (typeof seasons)[number]["episodes"][number] }[] = [];
  for (const season of sorted) {
    const seasonHasConfirmedAiring = season.episodes.some((ep) => ep.airDate !== null && hasEpisodeAired(ep.airDate));
    const episodes = [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    for (const ep of episodes) {
      const aired = ep.airDate ? hasEpisodeAired(ep.airDate) : seasonHasConfirmedAiring;
      if (!aired) continue;
      if (!isEpisodeWatched(watched, season.seasonNumber, ep.episodeNumber)) {
        pending.push({ seasonNumber: season.seasonNumber, episode: ep });
      }
    }
  }
  return pending;
}

/**
 * TASK-055 — "Minha Lista" enriquecida, no nível do TV Time: pôster
 * do EPISÓDIO (não da série), cápsula com nome da série, código T/E,
 * nome do episódio, badges (mesma regra de "Em breve", reutilizada
 * via `computeBadge`), botão de marcar assistido direto no card.
 * Cada card busca os próprios dados — é a forma correta de fazer
 * isso numa lista de tamanho variável sem violar a regra dos hooks
 * (não dá pra chamar hooks dentro de um .map de um componente só).
 *
 * AUDITORIA (perf, a pedido) — trocado `useSeriesDetails` (elenco,
 * sinopse, títulos similares, imagens — o mesmo dado pesado da
 * PÁGINA da série) por `useSeriesEpisodesLight` (só temporada/
 * episódio/nome/data). Com até 8 cards na lista ao mesmo tempo, isso
 * é bem menos dado trafegado por card, sem mudar nada do que
 * aparece na tela — o resto da lógica (achar o próximo não
 * assistido, badge, checagem de "já foi ao ar") é idêntico.
 */
export function ContinueWatchingCard({ item }: { item: LibraryItem }) {
  const { t } = useTranslation();
  const { data: episodes } = useSeriesEpisodesLight(item.id);
  const { data: watched } = useWatchedEpisodes(item.id);
  const toggleWatched = useToggleEpisodeWatched(item.id);

  const next = useMemo(() => {
    if (!episodes) return null;
    return findPendingEpisodes(groupBySeason(episodes), watched);
  }, [episodes, watched]);

  if (!episodes || next === null || next.length === 0) return null;
  const { seasonNumber, episode } = next[0]!;
  const additionalPendingCount = next.length - 1;
  const badge =
    episode.airDate && watched
      ? computeBadge(
          { seriesId: item.id, seasonNumber, episodeNumber: episode.episodeNumber, airDate: episode.airDate },
          watched
        )
      : null;
  const badgeConfig = badge ? { label: t(BADGE_LABEL_KEY[badge]), className: BADGE_CLASSNAME[badge] } : null;
  /*
   * Ajuste (a pedido): trocado o still do episódio (`episode.stillPath`)
   * pelo pôster da série (`item.posterPath`) — achado real: além de
   * faltar em vários episódios (TMDB nem sempre tem still pra todo
   * episódio), quando existe costuma vir em baixa qualidade, e é uma
   * imagem PAISAGEM (16:9) forçada dentro de um recorte RETRATO
   * (o container aqui é 64×96, a mesma proporção 2:3 de um pôster),
   * cortando as bordas de um jeito estranho. O pôster da série já vem
   * nessa proporção de verdade e é sempre consistente entre os cards.
   */
  const posterUrl = tmdbImage(item.posterPath, "w185");
  const episodeCode = `T${String(seasonNumber).padStart(2, "0")} | E${String(episode.episodeNumber).padStart(2, "0")}`;

  function handleMarkWatched() {
    hapticTick();
    toggleWatched.mutate({ seasonNumber, episodeNumber: episode.episodeNumber, watched: false });
  }

  return (
    <Link
      href={`/series/${item.id}/season/${seasonNumber}/episode/${episode.episodeNumber}`}
      className="flex items-stretch gap-3 rounded-lg border border-border bg-surface p-3 transition-transform active:scale-[0.98]"
    >
      <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-background">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill sizes="64px" className="object-cover" />
        ) : item.summaryPending ? (
          /* ACHADO ("não tá suave", 16ª rodada) — enquanto o resumo do
           * TMDB não chega, pulso discreto em vez do ícone estático:
           * comunica "carregando", não "sem pôster". */
          <div className="h-full w-full animate-pulse bg-surface" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        {item.summaryPending ? (
          <div className="h-5 w-24 animate-pulse rounded-full bg-surface" aria-hidden="true" />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-text">
            {item.title}
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </span>
        )}
        <p className="flex items-center gap-1.5 font-mono text-sm font-bold text-text">
          {episodeCode}
          {/* A PEDIDO (achado real — "falta o +N que o mobile tem") — quantos outros episódios além deste já estão liberados pra assistir. */}
          {additionalPendingCount > 0 && (
            <span className="rounded bg-primary/15 px-1 font-sans text-[10px] font-bold text-primary">
              +{additionalPendingCount}
            </span>
          )}
        </p>
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
