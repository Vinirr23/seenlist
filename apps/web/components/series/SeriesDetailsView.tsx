"use client";

import { useState } from "react";
import { useSeriesDetails } from "@/lib/queries/series";
import { useWatchedEpisodes, useMostRecentWatchedEpisode } from "@/lib/queries/watched-episodes";
import { SeriesHeader } from "./SeriesHeader";
import { SeriesTabs, type SeriesTab } from "./SeriesTabs";
import { SeriesDetailsSkeleton } from "./SeriesDetailsSkeleton";
import { SeasonAccordion } from "./SeasonAccordion";
import { CastCarousel } from "../media/CastCarousel";
import { MetaRow } from "../media/MetaRow";
import { SimilarSeriesCarousel } from "./SimilarSeriesCarousel";
import { ProgressCard } from "./ProgressCard";
import { EmptyState } from "../search/EmptyState";
import { PageContainer } from "../layout/PageContainer";

export function SeriesDetailsView({ seriesId }: { seriesId: string }) {
  const [tab, setTab] = useState<SeriesTab>("sobre");
  const numericId = Number(seriesId);

  const { data: series, isLoading, isError } = useSeriesDetails(seriesId);
  const { data: watchedEpisodes } = useWatchedEpisodes(numericId);
  const { data: mostRecent } = useMostRecentWatchedEpisode(numericId);

  if (isLoading) {
    return <SeriesDetailsSkeleton />;
  }

  if (isError || !series) {
    return (
      <PageContainer>
        <EmptyState message="Não foi possível carregar esta série agora. Tente de novo em instantes." />
      </PageContainer>
    );
  }

  const watchedCount = watchedEpisodes?.size ?? 0;

  const recentEpisode = mostRecent
    ? series.seasons
        .find((season) => season.seasonNumber === mostRecent.seasonNumber)
        ?.episodes.find((episode) => episode.episodeNumber === mostRecent.episodeNumber)
    : null;

  return (
    <div>
      <SeriesHeader series={series} />
      <SeriesTabs active={tab} onChange={setTab} />

      <PageContainer>
        {tab === "sobre" && (
          <div className="space-y-6">
            <p className="text-sm leading-relaxed text-text">
              {series.overview || "Sem sinopse disponível."}
            </p>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <MetaRow label="Status" value={series.status} />
              <MetaRow label="Lançamento" value={series.firstAirDate ?? "—"} />
              <MetaRow label="Temporadas" value={String(series.numberOfSeasons)} />
              <MetaRow label="Episódios" value={String(series.numberOfEpisodes)} />
              <MetaRow label="Emissora" value={series.networks.join(", ") || "—"} />
              <MetaRow label="Gêneros" value={series.genres.join(", ") || "—"} />
            </dl>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">Elenco principal</h2>
              <CastCarousel cast={series.cast} />
            </section>

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">Séries semelhantes</h2>
              <SimilarSeriesCarousel items={series.similar} />
            </section>
          </div>
        )}

        {tab === "episodios" && (
          <div className="space-y-4">
            <ProgressCard watchedCount={watchedCount} totalEpisodes={series.numberOfEpisodes} />

            {recentEpisode && (
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                  Continuar assistindo
                </p>
                <p className="text-sm text-text">
                  T{recentEpisode.seasonNumber} · E{recentEpisode.episodeNumber} — {recentEpisode.name}
                </p>
              </div>
            )}

            {series.seasons.length === 0 ? (
              <EmptyState message="Nenhum episódio encontrado para esta série." />
            ) : (
              <div className="space-y-3">
                {series.seasons.map((season) => (
                  <SeasonAccordion
                    key={season.seasonNumber}
                    seriesId={numericId}
                    season={season}
                    watchedEpisodes={watchedEpisodes}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
