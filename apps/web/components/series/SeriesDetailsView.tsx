"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star, ChevronRight, Tv, Calendar, Layers, Clapperboard } from "lucide-react";
import { useSeriesDetails } from "@/lib/queries/series";
import { useWatchedEpisodes, useWatchedEpisodeIds, useSpecialEpisodeKeys } from "@/lib/queries/watched-episodes";
import { useSeriesStatus } from "@/lib/queries/series-status";
import { getSeriesCategoryByStatus } from "@/lib/series-categories";
import { computeSeriesCaughtUpBadge, type SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { SeriesHeader } from "./SeriesHeader";
import { SeriesTabs, type SeriesTab } from "./SeriesTabs";
import { SeriesDetailsSkeleton } from "./SeriesDetailsSkeleton";
import { SeasonAccordion } from "./SeasonAccordion";
import { EpisodeCarousel } from "./EpisodeCarousel";
import { SeriesCaughtUpCard } from "./SeriesCaughtUpCard";
import { ConfettiBurst } from "./ConfettiBurst";
import { CastCarousel } from "../media/CastCarousel";
import { MetaRow } from "../media/MetaRow";
import { BackdropGallery } from "../media/BackdropGallery";
import { TrailerCard } from "../media/TrailerCard";
import { SimilarSeriesCarousel } from "./SimilarSeriesCarousel";
import { SeriesWatchProviders } from "./SeriesWatchProviders";
import { ReviewsSection } from "../social/ReviewsSection";
import { EmptyState } from "../search/EmptyState";
import { PageError } from "../media/PageError";
import { PageContainer } from "../layout/PageContainer";

/**
 * A PEDIDO — sinopse com "Ler mais": recolhida por padrão (5
 * linhas, `line-clamp-5`), só mostra o botão quando o texto passa
 * um comprimento aproximado que costuma estourar 5 linhas nesse
 * tamanho de coluna (~220 caracteres) — evita mostrar "Ler mais" à
 * toa numa sinopse curta que já cabe inteira.
 */
function SeriesOverview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const likelyOverflows = text.length > 220;

  return (
    <div>
      <p className={`text-sm leading-relaxed text-text ${expanded ? "" : "line-clamp-5"}`}>{text}</p>
      {likelyOverflows && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-primary">
          {expanded ? t("series.readLess") : t("series.readMore")}
        </button>
      )}
    </div>
  );
}

/** Tradução (5º lote). */
export function SeriesDetailsView({ seriesId }: { seriesId: string }) {
  const [tab, setTab] = useState<SeriesTab>("episodios");
  const numericId = Number(seriesId);
  const { t } = useTranslation();

  const { data: series, isLoading, isError, refetch } = useSeriesDetails(seriesId);
  const { data: watchedEpisodes } = useWatchedEpisodes(numericId);
  // CORREÇÃO (2026-08-26 — "motor resistente") — Set de IDs fixos da TMDB, mesmos pontos de invalidação do Set de chaves acima (ver watched-episodes-mutations.ts).
  const { data: watchedEpisodeIds } = useWatchedEpisodeIds(numericId);
  const { data: specialEpisodeKeys } = useSpecialEpisodeKeys(numericId);
  const { data: currentStatus } = useSeriesStatus(numericId);
  const categoryColorClass = currentStatus ? getSeriesCategoryByStatus(currentStatus)?.barColorClass : undefined;

  // TASK-170 — precisa ficar ANTES dos `return` condicionais abaixo
  // (regra dos hooks: mesma quantidade de hooks em toda renderização
  // do componente, nunca depois de um retorno condicional). Por isso
  // `series` entra opcional aqui (`series ?? null` dentro da função) —
  // nos primeiros renders (carregando/erro) o resultado é sempre
  // `null`.
  const caughtUpBadge = series ? computeSeriesCaughtUpBadge(series, watchedEpisodes, specialEpisodeKeys, watchedEpisodeIds) : null;
  const [showConfetti, setShowConfetti] = useState(false);
  /**
   * Guarda o valor de referência pra comparar transição — começa
   * "não estabelecido" de propósito. Achado real ao escrever isto:
   * se a referência fosse inicializada direto com `caughtUpBadge`
   * (que, enquanto os dados ainda carregam, é sempre `null`), a
   * PRIMEIRA vez que o dado de verdade chegasse já "ended" (série
   * visitada que já estava completa antes) disparava o confete à
   * toa — parecia uma transição, mas só era o primeiro dado real
   * chegando. Só estabelece a referência (sem disparar nada) na
   * primeira renderização em que `series` já existe; só compara
   * depois disso.
   */
  const badgeBaselineRef = useRef<{ established: boolean; value: SeriesCaughtUpBadge }>({
    established: false,
    value: null,
  });

  useEffect(() => {
    if (!series) return;
    if (!badgeBaselineRef.current.established) {
      badgeBaselineRef.current = { established: true, value: caughtUpBadge };
      return;
    }
    if (caughtUpBadge === "ended" && badgeBaselineRef.current.value !== "ended") {
      setShowConfetti(true);
    }
    badgeBaselineRef.current.value = caughtUpBadge;
  }, [caughtUpBadge, series]);

  if (isLoading) {
    return <SeriesDetailsSkeleton />;
  }

  if (isError || !series) {
    return (
      <PageContainer>
        <PageError message={t("error.loadSeries")} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const watchedCount = watchedEpisodes?.size ?? 0;

  return (
    <div className="relative w-full md:mx-auto md:max-w-[430px]">
      {/*
        * "Vidro" (mesmo padrão do Perfil/Explorar/Biblioteca) — campo de
        * manchas desfocadas atrás do conteúdo. Ver ProfileView.tsx pro
        * histórico completo de causa raiz.
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "300px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "540px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "780px", left: "-18%", background: "#0D3B5C" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "1000px", right: "-18%", background: "#2A7FB8" }} />
        <div className="absolute h-48 w-48 rounded-full opacity-24 blur-[60px]" style={{ top: "1210px", left: "-16%", background: "#0D3B5C" }} />
      </div>

      <div className="relative">
      <SeriesHeader
        series={series}
        seriesId={numericId}
        seriesTitle={series.title}
        currentStatus={currentStatus}
        watchedCount={watchedCount}
        totalEpisodes={series.numberOfEpisodes}
        colorClass={categoryColorClass}
      />
      <SeriesTabs active={tab} onChange={setTab} />

      <PageContainer>
        {tab === "sobre" && (
          <div className="space-y-6">
            {/* A PEDIDO (2026-08-25) — "onde assistir" antes da sinopse, mesma ordem pedida pro Filme. */}
            <SeriesWatchProviders providers={series.watchProviders} />

            <section>
              <h2 className="mb-2 text-sm font-semibold text-text">{t("series.overviewTitle")}</h2>
              <SeriesOverview text={series.overview || t("series.noOverview")} />
            </section>

            {series.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {/* "Vidro" (mesmo padrão dos chips neutros do Explorar) */}
                {series.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-text backdrop-blur-[10px] backdrop-saturate-[160%]"
                    style={{
                      background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
                    }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <MetaRow label={t("series.status")} value={series.status} icon={<Layers className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />} />
              <MetaRow
                label={t("series.releaseDate")}
                value={series.firstAirDate?.slice(0, 4) ?? "—"}
                icon={<Calendar className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />}
              />
              <MetaRow
                label={t("series.seasonsLabel")}
                value={String(series.numberOfSeasons)}
                icon={<Tv className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />}
              />
              <MetaRow
                label={t("series.episodesLabel")}
                value={String(series.numberOfEpisodes)}
                icon={<Clapperboard className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />}
              />
            </div>

            {series.trailerKey && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-text">{t("series.trailer")}</h2>
                <TrailerCard videoKey={series.trailerKey} />
              </section>
            )}

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("series.mainCast")}</h2>
              <CastCarousel cast={series.cast} title={series.matchTitle} year={series.firstAirDate ? Number(series.firstAirDate.slice(0, 4)) : null} />
            </section>

            {series.gallery.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-text">{t("series.gallery")}</h2>
                <BackdropGallery paths={series.gallery} />
              </section>
            )}

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("series.similarSeries")}</h2>
              <SimilarSeriesCarousel items={series.similar} />
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("reviews.title")}</h2>
              <ReviewsSection target={{ mediaType: "series", mediaId: numericId }} />
            </section>

            {/* "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — "glass-row". */}
            <Link
              href={`/series/${numericId}/comments`}
              className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-text backdrop-blur-[18px] backdrop-saturate-[180%] hover:border-primary/40"
              style={{
                background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
              }}
            >
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted" strokeWidth={2} />
                {t("reviews.seeAll")}
              </span>
              <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
            </Link>
          </div>
        )}

        {tab === "episodios" && (
          <div className="space-y-4">
            {series.seasons.length > 0 && (
              <EpisodeCarousel
                seriesId={numericId}
                seriesSlug={seriesId}
                category={currentStatus}
                seasons={series.seasons}
                colorClass={categoryColorClass}
              />
            )}

            {series.seasons.length === 0 ? (
              <EmptyState message={t("error.noEpisodes")} />
            ) : (
              <div className="space-y-3">
                {series.seasons.map((season, index) => (
                  <SeasonAccordion
                    key={season.seasonNumber}
                    seriesId={numericId}
                    season={season}
                    watchedEpisodes={watchedEpisodes}
                    watchedEpisodeIds={watchedEpisodeIds}
                    defaultOpen={index === 0}
                    colorClass={categoryColorClass}
                  />
                ))}
              </div>
            )}

            {caughtUpBadge && <SeriesCaughtUpCard badge={caughtUpBadge} />}
          </div>
        )}
      </PageContainer>

      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
      </div>
    </div>
  );
}
