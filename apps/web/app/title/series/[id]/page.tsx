import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layers, Calendar, Tv, Clapperboard } from "lucide-react";
import { getSeriesDetails } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { fetchTitleCommunityContent, type TitleCommunityContent } from "@/lib/server/titlePublicContent";
import { MobileAppPromoBanner } from "@/components/layout/MobileAppPromoBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { TitleHeader } from "@/components/title/TitleHeader";
import { TitlePagePromoCta } from "@/components/title/TitlePagePromoCta";
import { TitleReviewsSection } from "@/components/title/TitleReviewsSection";
import { CastCarousel } from "@/components/media/CastCarousel";
import { TrailerCard } from "@/components/media/TrailerCard";
import { MetaRow } from "@/components/media/MetaRow";
import { SeriesWatchProviders } from "@/components/series/SeriesWatchProviders";

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2). Mesmo raciocínio de
 * `app/title/movie/[id]/page.tsx` (ler aquele primeiro — aqui só o
 * que muda pra série está comentado). `/series/[id]` (app logado)
 * não é tocada.
 */
const getCachedSeriesDetails = cache((id: string) => getSeriesDetails(id, "pt-BR"));
const getCachedCommunityContent = cache((mediaId: number): Promise<TitleCommunityContent> =>
  fetchTitleCommunityContent("series", mediaId)
);

async function loadSeriesOrNotFound(id: string) {
  try {
    return await getCachedSeriesDetails(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/respondeu 404/.test(message)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return {};

  const [series, community] = await Promise.all([
    loadSeriesOrNotFound(id),
    getCachedCommunityContent(numericId),
  ]);

  const title = `${series.title} — Onde Assistir, Avaliações e Sinopse | SeenList`;
  const description = community.aggregate
    ? `${series.overview.slice(0, 120)}${series.overview.length > 120 ? "…" : ""} Nota da comunidade SeenList: ${community.aggregate.average.toFixed(1)}/5 (${community.aggregate.count} ${community.aggregate.count === 1 ? "avaliação" : "avaliações"}).`
    : series.overview.slice(0, 155);
  const posterUrl = tmdbImage(series.posterPath, "w500");

  return {
    title,
    description,
    alternates: { canonical: `/title/series/${id}` },
    robots: community.isEligibleForIndexing ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "video.tv_show",
      images: posterUrl ? [{ url: posterUrl, width: 500, height: 750 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: posterUrl ? [posterUrl] : undefined,
    },
  };
}

export default async function PublicSeriesTitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const [series, community] = await Promise.all([
    loadSeriesOrNotFound(id),
    getCachedCommunityContent(numericId),
  ]);

  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const seasonsLabel = `${series.numberOfSeasons} ${series.numberOfSeasons === 1 ? "temporada" : "temporadas"}`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: series.title,
    description: series.overview || undefined,
    image: tmdbImage(series.posterPath, "w500") ?? undefined,
    datePublished: series.firstAirDate || undefined,
    genre: series.genres.length > 0 ? series.genres : undefined,
    numberOfSeasons: series.numberOfSeasons,
    numberOfEpisodes: series.numberOfEpisodes,
  };
  if (community.aggregate) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(community.aggregate.average.toFixed(2)),
      ratingCount: community.aggregate.count,
      bestRating: 5,
      worstRating: 0,
    };
    jsonLd.review = community.reviews.slice(0, 5).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.author.displayName },
      datePublished: review.createdAt,
      reviewBody: review.containsSpoiler ? undefined : (review.reviewText ?? undefined),
      reviewRating:
        review.rating !== null
          ? { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 0 }
          : undefined,
    }));
  }

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- mesmo caso já documentado em app/title/movie/[id]/page.tsx.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MobileAppPromoBanner />
      <div className="relative w-full md:mx-auto md:max-w-[430px]">
        <TitleHeader
          title={series.title}
          backdropPath={series.backdropPath}
          posterPath={series.posterPath}
          year={year}
          metaLine={seasonsLabel}
          genres={series.genres}
          voteAverage={series.voteAverage}
        />

        <PageContainer>
          <div className="space-y-6">
            <TitlePagePromoCta href={`/series/${numericId}`} />

            <SeriesWatchProviders providers={series.watchProviders} />

            <section>
              <h2 className="mb-2 text-sm font-medium text-text">Sinopse</h2>
              <p className="text-sm leading-relaxed text-text">{series.overview || "Sinopse não disponível."}</p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <MetaRow label="Status" value={series.status} icon={<Layers className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />} />
              <MetaRow label="Lançamento" value={year ?? "—"} icon={<Calendar className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />} />
              <MetaRow label="Temporadas" value={String(series.numberOfSeasons)} icon={<Tv className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />} />
              <MetaRow label="Episódios" value={String(series.numberOfEpisodes)} icon={<Clapperboard className="mb-1 h-4 w-4 text-muted" strokeWidth={2} />} />
            </div>

            {series.trailerKey && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-text">Trailer</h2>
                <TrailerCard videoKey={series.trailerKey} />
              </section>
            )}

            {series.cast.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-text">Elenco principal</h2>
                <CastCarousel cast={series.cast} title={series.matchTitle} year={year ? Number(year) : null} />
              </section>
            )}

            <TitleReviewsSection reviews={community.reviews} aggregate={community.aggregate} />
          </div>
        </PageContainer>
      </div>
    </>
  );
}
