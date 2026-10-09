import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSeasonDetails, getSeriesDetails, type PublicSeasonDetails } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { fetchTitleCommunityContent, type TitleCommunityContent } from "@/lib/server/titlePublicContent";
import { MobileAppPromoBanner } from "@/components/layout/MobileAppPromoBanner";
import { TitleHeader } from "@/components/title/TitleHeader";
import { TitlePageLayout } from "@/components/title/TitlePageLayout";
import { TitlePagePromoCta } from "@/components/title/TitlePagePromoCta";
import { TitleFactsCard, type TitleFactRow } from "@/components/title/TitleFactsCard";
import { TitleReviewsSection } from "@/components/title/TitleReviewsSection";
import { PublicSeasonExplorer } from "@/components/title/PublicSeasonExplorer";
import { CastCarousel } from "@/components/media/CastCarousel";
import { BackdropGallery } from "@/components/media/BackdropGallery";
import { SimilarSeriesCarousel } from "@/components/series/SimilarSeriesCarousel";
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

/**
 * A PEDIDO (2026-10-09 — redesign das páginas públicas, item 5:
 * "exibir inicialmente a temporada mais relevante"). Mais recente
 * temporada com pelo menos um episódio cadastrado (ignora "temporada
 * 0"/especiais, já filtrada em `seasonSummaries`) — critério simples,
 * como pedido ("use a solução mais simples possível"). Resiliente de
 * propósito: se a busca da temporada falhar (TMDB fora do ar, etc.),
 * a página NÃO quebra — só não mostra a seção de temporadas (mesmo
 * padrão de resiliência já usado em `titlePublicContent.ts`).
 */
async function loadMostRelevantSeason(
  seriesId: string,
  seasonSummaries: { seasonNumber: number; episodeCount: number }[]
): Promise<PublicSeasonDetails | null> {
  const mostRelevant = [...seasonSummaries].filter((s) => s.episodeCount > 0).sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
  if (!mostRelevant) return null;

  try {
    return await getPublicSeasonDetails(seriesId, mostRelevant.seasonNumber, "pt-BR");
  } catch (error) {
    console.error(`[title/series/${seriesId}] Falha ao carregar a temporada mais relevante (${mostRelevant.seasonNumber}).`, error);
    return null;
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
  // Depende de `series.seasonSummaries` — por isso busca depois do Promise.all acima, não dentro dele.
  const mostRelevantSeason = await loadMostRelevantSeason(id, series.seasonSummaries);

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
    // A PEDIDO (2026-10-09 — redesign das páginas públicas, item 1).
    contentRating: series.certification ?? undefined,
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

  // Item 9 — "ficha técnica... exibir apenas dados existentes". Criação
  // já aparece com destaque perto da sinopse (item 3), por isso NÃO se
  // repete aqui (mesma decisão já documentada no filme).
  const factRows: TitleFactRow[] = [
    series.status ? { label: "Status", value: series.status } : null,
    series.country ? { label: "País de origem", value: series.country } : null,
    series.language ? { label: "Idioma original", value: series.language } : null,
    series.networks.length > 0 ? { label: "Emissoras", value: series.networks.join(", ") } : null,
  ].filter((row): row is TitleFactRow => row !== null);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- mesmo caso já documentado em app/title/movie/[id]/page.tsx.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MobileAppPromoBanner />
      <TitleHeader
        mediaTypeLabel="Série"
        title={series.title}
        backdropPath={series.backdropPath}
        posterPath={series.posterPath}
        year={year}
        certification={series.certification}
        secondaryMetaLine={seasonsLabel}
        genres={series.genres}
        voteAverage={series.voteAverage}
        communityAggregate={community.aggregate}
        trailerKey={series.trailerKey}
        overview={series.overview || "Sinopse não disponível."}
        creditLabel={series.creators.length > 0 ? "Criação" : null}
        creditNames={series.creators}
        watchProviders={<SeriesWatchProviders providers={series.watchProviders} />}
      />

      <TitlePageLayout sidebar={<><TitlePagePromoCta href={`/series/${numericId}`} /><TitleFactsCard rows={factRows} /></>}>
        {series.cast.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Elenco principal</h2>
            <CastCarousel cast={series.cast} title={series.matchTitle} year={year ? Number(year) : null} />
          </section>
        )}

        {mostRelevantSeason && (
          <PublicSeasonExplorer
            seriesId={numericId}
            seasons={series.seasonSummaries}
            initialSeasonNumber={mostRelevantSeason.seasonNumber}
            initialSeasonDetails={mostRelevantSeason}
            appHref={`/series/${numericId}`}
          />
        )}

        {series.gallery.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Imagens</h2>
            <BackdropGallery paths={series.gallery} />
          </section>
        )}

        {series.similar.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Você também pode gostar</h2>
            <SimilarSeriesCarousel items={series.similar} />
          </section>
        )}

        <TitleReviewsSection reviews={community.reviews} aggregate={community.aggregate} />
      </TitlePageLayout>
    </>
  );
}
