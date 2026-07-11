"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Share2, Calendar, Eye, EyeOff, MessageCircle } from "lucide-react";
import type { SeriesDetails } from "@seenlist/types";
import { useSeriesDetails } from "@/lib/queries/series";
import { useSeriesStatus } from "@/lib/queries/series-status-state";
import { getSeriesCategoryByStatus } from "@/lib/series-categories";
import { useEpisodeDetails } from "@/lib/queries/episode-details";
import { useWatchedEpisodes, isEpisodeWatched } from "@/lib/queries/watched-episodes-state";
import { useToggleEpisodeWatched } from "@/lib/queries/watched-episodes-mutations";
import { useCommentCount } from "@/lib/queries/social/comments";
import { useMyReview, useUpsertReview, useReviewAggregate } from "@/lib/queries/social/reviews";
import { HalfStarRating } from "../social/HalfStarRating";
import { EpisodeStarRatingRow } from "./EpisodeStarRatingRow";
import { EpisodeMoodPicker } from "./EpisodeMoodPicker";
import { EpisodeFavoriteCharacterPicker, type FavoriteCharacterOption } from "./EpisodeFavoriteCharacterPicker";
import { EpisodeWatchedPlatformPicker } from "./EpisodeWatchedPlatformPicker";
import { useAnimeCharacters } from "@/lib/queries/anime-characters";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { useToast } from "@/lib/toast/ToastProvider";
import { cn } from "@seenlist/utils";
import { WhereToWatchSection } from "./WhereToWatchSection";
import { EpisodeWatchedButton } from "../series/EpisodeWatchedButton";

export interface EpisodeDetailViewProps {
  seriesId: string;
  season: number;
  episode: number;
}

interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/**
 * TASK-052 — reaproveitado sem mudança nenhuma (TASK-030): próximo/
 * anterior calculado da mesma lista de temporadas já em cache, sem
 * chamada nova ao TMDB.
 */
function findAdjacentEpisodes(
  seasons: SeriesDetails["seasons"] | undefined,
  season: number,
  episode: number
): { previous: EpisodeRef | null; next: EpisodeRef | null } {
  if (!seasons) return { previous: null, next: null };

  const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const flat: EpisodeRef[] = sorted.flatMap((s) =>
    [...s.episodes]
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
      .map((e) => ({ seasonNumber: s.seasonNumber, episodeNumber: e.episodeNumber }))
  );

  const currentIndex = flat.findIndex((e) => e.seasonNumber === season && e.episodeNumber === episode);
  if (currentIndex === -1) return { previous: null, next: null };

  return {
    previous: currentIndex > 0 ? (flat[currentIndex - 1] ?? null) : null,
    next: currentIndex < flat.length - 1 ? (flat[currentIndex + 1] ?? null) : null,
  };
}

const SWIPE_THRESHOLD_PX = 60;

/**
 * TASK-052 — redesign completo pra ficar no nível visual/funcional
 * do TV Time (identidade de cor do SeenList preservada). Reaproveita
 * 100% dos hooks de dado já existentes (useSeriesDetails,
 * useEpisodeDetails, useWatchedEpisodes, useToggleEpisodeWatched,
 * WhereToWatchSection) — só a estrutura visual e a navegação por
 * swipe são novas. `useCommentCount` é a única consulta nova (linha
 * "Comentários N >" precisa de um número, que não existia antes).
 *
 * TASK-067 — experiência pós-"assistido" (referência: TV Time).
 * Assim que o episódio é marcado como assistido, aparecem "Onde você
 * assistiu?", a nota com estrelas rotuladas, "Como você se sentiu?"
 * e "Quem foi seu personagem favorito?" — cada uma salva na hora que
 * a pessoa toca (sem botão "salvar" separado), a mesma linha de
 * `reviews` (upsert parcial, ver reviews.ts). O sheet de avaliação
 * automático que existia antes (`EpisodeRatingBottomSheet`) saiu —
 * essa mesma pergunta agora vive inline, sempre visível, igual à
 * referência (não é mais um popup único na primeira vez). O botão de
 * comentários virou uma barra flutuante fixa no rodapé, acima da
 * barra de navegação.
 */
export function EpisodeDetailView({ seriesId, season, episode }: EpisodeDetailViewProps) {
  const router = useRouter();
  const seriesIdNum = Number(seriesId);
  const { data: seriesDetails } = useSeriesDetails(seriesId);
  const { data: currentStatus } = useSeriesStatus(seriesIdNum);
  const categoryColorClass = currentStatus ? getSeriesCategoryByStatus(currentStatus)?.barColorClass : undefined;
  const { data: episodePage, isLoading, isError } = useEpisodeDetails(seriesId, season, episode);
  const { data: watched } = useWatchedEpisodes(seriesIdNum);
  const toggleWatched = useToggleEpisodeWatched(seriesIdNum);
  const { data: commentCount = 0 } = useCommentCount({
    mediaType: "series",
    mediaId: seriesIdNum,
    seasonNumber: season,
    episodeNumber: episode,
  });

  const episodeTarget = { mediaType: "series" as const, mediaId: seriesIdNum, seasonNumber: season, episodeNumber: episode };
  const { data: myRating } = useMyReview(episodeTarget);
  const { data: ratingAggregate } = useReviewAggregate(episodeTarget);
  const upsertRating = useUpsertReview(episodeTarget);
  const toast = useToast();

  const { previous, next } = useMemo(
    () => findAdjacentEpisodes(seriesDetails?.seasons, season, episode),
    [seriesDetails?.seasons, season, episode]
  );

  /**
   * TASK-067 (personagem favorito, versão 2) — tenta o anime primeiro
   * (ilustração de verdade via Jikan/MyAnimeList); sem correspondência,
   * cai pro elenco do TMDB (foto do ator/dublador, como já era).
   * `enabled: Boolean(title)` dentro do hook cuida de não disparar
   * a busca antes de `seriesDetails` carregar.
   */
  const seriesYear = seriesDetails?.firstAirDate ? Number(seriesDetails.firstAirDate.slice(0, 4)) : null;
  const { data: animeCharacters } = useAnimeCharacters(seriesDetails?.title, seriesYear);
  const favoriteCharacterOptions: FavoriteCharacterOption[] = useMemo(() => {
    if (animeCharacters && animeCharacters.length > 0) return animeCharacters;
    return (seriesDetails?.cast ?? []).map((member) => ({
      id: member.id,
      name: member.character || member.name,
      imageUrl: tmdbImage(member.profilePath, "w185"),
    }));
  }, [animeCharacters, seriesDetails?.cast]);

  const currentSeasonEpisodes = useMemo(() => {
    const currentSeason = seriesDetails?.seasons.find((s) => s.seasonNumber === season);
    return currentSeason ? [...currentSeason.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber) : [];
  }, [seriesDetails?.seasons, season]);

  const isWatched = isEpisodeWatched(watched, season, episode);

  const touchStartX = useRef<number | null>(null);

  function handleToggleWatched() {
    hapticTick();
    toggleWatched.mutate({ seasonNumber: season, episodeNumber: episode, watched: isWatched });
  }

  async function handleShare() {
    const url = `${window.location.origin}/series/${seriesId}/season/${season}/episode/${episode}`;
    const title = episodePage?.episode.name ?? `T${season}E${episode}`;
    hapticTick();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // cancelado — cai pro fallback de copiar
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch (error) {
      console.error("[episode] Falha ao copiar link do episódio", error);
      toast.error("Não foi possível copiar o link.");
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
  }

  /**
   * TASK-052, item 14 — swipe horizontal troca de episódio sem
   * voltar pra tela da temporada. season/episode vêm da URL, então
   * navegar pra rota do episódio adjacente já refaz todo o fetch
   * (banner, título, código, data, nota, sinopse, comentários,
   * streamings) — não precisa de estado "in-place" separado.
   */
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    hapticTick();
    if (deltaX < 0 && next) {
      router.push(`/series/${seriesId}/season/${next.seasonNumber}/episode/${next.episodeNumber}`);
    } else if (deltaX > 0 && previous) {
      router.push(`/series/${seriesId}/season/${previous.seasonNumber}/episode/${previous.episodeNumber}`);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[430px]">
        <div className="aspect-[4/3] w-full animate-pulse bg-surface" />
        <div className="space-y-3 px-4 py-4">
          <div className="h-6 w-2/3 animate-pulse rounded bg-surface" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
        </div>
      </div>
    );
  }

  if (isError || !episodePage) {
    return (
      <div className="mx-auto max-w-[430px] px-4 py-16 text-center">
        <p className="text-sm text-muted">Não foi possível carregar este episódio agora.</p>
        <Link href={`/series/${seriesId}`} className="mt-4 inline-block text-sm text-primary underline">
          Voltar para a série
        </Link>
      </div>
    );
  }

  const { episode: ep, watchProviders } = episodePage;
  const stillUrl = tmdbImage(ep.stillPath, "w1280");
  const episodeCode = `T${String(season).padStart(2, "0")} | E${String(episode).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-[430px] pb-28">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={() => router.push(`/series/${seriesId}`)}
          aria-label="Voltar para a série"
          className="flex h-8 w-8 shrink-0 items-center justify-center text-text"
        >
          <ChevronDown className="h-6 w-6" strokeWidth={2} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 overflow-hidden">
          {currentSeasonEpisodes.map((e) => (
            <span
              key={e.episodeNumber}
              className={cn(
                "h-1.5 shrink-0 rounded-full transition-all",
                e.episodeNumber === episode ? "w-4 bg-primary" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>
        <div className="h-8 w-8 shrink-0" aria-hidden="true" />
      </div>

      <div
        className="relative aspect-[4/3] w-full bg-surface"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {stillUrl ? (
          <Image src={stillUrl} alt={ep.name} fill sizes="430px" className="object-cover" priority />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">Sem imagem</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          {seriesDetails && (
            <Link
              href={`/series/${seriesId}`}
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black"
            >
              {seriesDetails.title}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          )}
          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartilhar episódio"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          >
            <Share2 className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <p className="text-xl font-bold text-white">{episodeCode}</p>
          <p className="mt-0.5 truncate text-sm text-white/90">{ep.name}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {ep.airDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
              {new Date(ep.airDate).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
          <span className="flex items-center gap-1">
            {isWatched ? (
              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {isWatched ? "Assistido" : "Não assistido"}
          </span>
        </div>
        <EpisodeWatchedButton
          watched={isWatched}
          onClick={handleToggleWatched}
          disabled={toggleWatched.isPending}
          colorClass={categoryColorClass}
        />
      </div>

      <div className="space-y-6 px-4 py-4">
        {!isWatched && (
          <section>
            <WhereToWatchSection providers={watchProviders} />
          </section>
        )}

        {isWatched && (
          <>
            <section>
              <h2 className="mb-2 text-sm font-medium text-text">Onde você assistiu?</h2>
              <EpisodeWatchedPlatformPicker
                providers={watchProviders}
                value={myRating?.watchedPlatform ?? null}
                onChange={(platform) => upsertRating.mutate({ watchedPlatform: platform })}
              />
            </section>

            <section className="rounded-lg border border-border bg-surface p-3">
              <h2 className="mb-1 text-center text-sm font-medium text-text">Avaliar este episódio</h2>
              <EpisodeStarRatingRow
                value={myRating?.rating ?? 0}
                onChange={(rating) => upsertRating.mutate({ rating })}
              />
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">Como você se sentiu?</h2>
              <EpisodeMoodPicker
                value={myRating?.mood ?? null}
                onChange={(mood) => upsertRating.mutate({ mood })}
              />
            </section>

            {favoriteCharacterOptions.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-text">Quem foi seu personagem favorito?</h2>
                <EpisodeFavoriteCharacterPicker
                  characters={favoriteCharacterOptions}
                  selectedId={myRating?.favoriteCharacterId ?? null}
                  onSelect={(character) =>
                    upsertRating.mutate({
                      favoriteCharacterId: character?.id ?? null,
                      favoriteCharacterName: character?.name ?? null,
                    })
                  }
                />
              </section>
            )}
          </>
        )}

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">Informações do episódio</h2>
          {ratingAggregate && ratingAggregate.count > 0 ? (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <HalfStarRating value={ratingAggregate.average ?? 0} size="sm" />
                <span className="text-lg font-bold text-text">{(ratingAggregate.average ?? 0).toFixed(1)}/5</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">Avaliação da comunidade SeenList</p>
              <p className="text-xs text-muted">
                {ratingAggregate.count} avaliaç{ratingAggregate.count === 1 ? "ão" : "ões"}
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted">Ainda sem avaliações da comunidade SeenList.</p>
          )}
          {ep.overview && <p className="text-sm leading-relaxed text-muted">{ep.overview}</p>}
        </section>
      </div>

      {/* TASK-067 — botão de comentários flutuante, fixo acima da barra de navegação. */}
      <Link
        href={`/series/${seriesIdNum}/season/${season}/episode/${episode}/comments`}
        className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-background shadow-lg"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
        {commentCount} COMENTÁRIO{commentCount === 1 ? "" : "S"}
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
