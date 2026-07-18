"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, ChevronRight } from "lucide-react";
import { useSeriesDetails } from "@/lib/queries/series";
import { useWatchedEpisodes } from "@/lib/queries/watched-episodes";
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
import { SimilarSeriesCarousel } from "./SimilarSeriesCarousel";
import { ReviewsSection } from "../social/ReviewsSection";
import { EmptyState } from "../search/EmptyState";
import { PageContainer } from "../layout/PageContainer";

/** Tradução (5º lote). */
export function SeriesDetailsView({ seriesId }: { seriesId: string }) {
  const [tab, setTab] = useState<SeriesTab>("episodios");
  const numericId = Number(seriesId);
  const { t } = useTranslation();

  const { data: series, isLoading, isError } = useSeriesDetails(seriesId);
  const { data: watchedEpisodes } = useWatchedEpisodes(numericId);
  const { data: currentStatus } = useSeriesStatus(numericId);
  const categoryColorClass = currentStatus ? getSeriesCategoryByStatus(currentStatus)?.barColorClass : undefined;

  // TASK-170 — precisa ficar ANTES dos `return` condicionais abaixo
  // (regra dos hooks: mesma quantidade de hooks em toda renderização
  // do componente, nunca depois de um retorno condicional). Por isso
  // `series` entra opcional aqui (`series ?? null` dentro da função) —
  // nos primeiros renders (carregando/erro) o resultado é sempre
  // `null`.
  const caughtUpBadge = series ? computeSeriesCaughtUpBadge(series, watchedEpisodes) : null;
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
        <EmptyState message={t("error.loadSeries")} />
      </PageContainer>
    );
  }

  const watchedCount = watchedEpisodes?.size ?? 0;

  return (
    <div className="w-full md:mx-auto md:max-w-[430px]">
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
            <p className="text-sm leading-relaxed text-text">{series.overview || t("series.noOverview")}</p>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <MetaRow label={t("series.status")} value={series.status} />
              <MetaRow label={t("series.releaseDate")} value={series.firstAirDate ?? "—"} />
              <MetaRow label={t("series.seasonsLabel")} value={String(series.numberOfSeasons)} />
              <MetaRow label={t("series.episodesLabel")} value={String(series.numberOfEpisodes)} />
              <MetaRow label={t("series.network")} value={series.networks.join(", ") || "—"} />
              <MetaRow label={t("series.genres")} value={series.genres.join(", ") || "—"} />
            </dl>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("series.mainCast")}</h2>
              <CastCarousel cast={series.cast} />
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("series.similarSeries")}</h2>
              <SimilarSeriesCarousel items={series.similar} />
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("reviews.title")}</h2>
              <ReviewsSection
                target={{ mediaType: "series", mediaId: numericId }}
                media={{ type: "series", title: series.title, posterPath: series.posterPath }}
              />
            </section>

            <Link
              href={`/series/${numericId}/comments`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text hover:border-primary/40"
            >
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted" strokeWidth={2} />
                {t("profile.comments")}
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
  );
}
