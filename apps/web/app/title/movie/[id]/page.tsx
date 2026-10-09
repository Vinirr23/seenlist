import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMovieDetails } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { fetchTitleCommunityContent, type TitleCommunityContent } from "@/lib/server/titlePublicContent";
import { MobileAppPromoBanner } from "@/components/layout/MobileAppPromoBanner";
import { TitleHeader } from "@/components/title/TitleHeader";
import { TitlePageLayout } from "@/components/title/TitlePageLayout";
import { TitlePagePromoCta } from "@/components/title/TitlePagePromoCta";
import { TitleFactsCard, type TitleFactRow } from "@/components/title/TitleFactsCard";
import { TitleReviewsSection } from "@/components/title/TitleReviewsSection";
import { CastCarousel } from "@/components/media/CastCarousel";
import { BackdropGallery } from "@/components/media/BackdropGallery";
import { SimilarMoviesCarousel } from "@/components/movie/SimilarMoviesCarousel";
import { StreamingProviders } from "@/components/movie/StreamingProviders";

const CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2, "páginas públicas independentes
 * das telas do app logado", Opção A aprovada). Rota NOVA — `/movies/[id]`
 * (app logado, atrás do middleware) não é tocada; esta aqui é o
 * destino público que o Google de fato consegue abrir e indexar.
 *
 * `cache()` do React: tanto `generateMetadata` quanto o componente da
 * página chamam as mesmas duas funções com os mesmos argumentos, na
 * MESMA requisição — sem isso, seriam duas chamadas reais ao TMDB e
 * duas ao Supabase por visita. `cache()` memoiza por requisição (não
 * entre requisições — isso já é feito por outra camada: `next:
 * {revalidate}` dentro de `tmdbGet`).
 */
const getCachedMovieDetails = cache((id: string) => getMovieDetails(id, "pt-BR"));
const getCachedCommunityContent = cache((mediaId: number): Promise<TitleCommunityContent> =>
  fetchTitleCommunityContent("movie", mediaId)
);

/** `tmdbGet` (lib/tmdb/client.ts) lança `Error("TMDB respondeu <status> em <path>")` — é assim que distinguimos "filme não existe" (404 real) de qualquer outra falha (rede, 5xx do TMDB), que deve continuar subindo pro error boundary em vez de virar um 404 enganoso. */
async function loadMovieOrNotFound(id: string) {
  try {
    return await getCachedMovieDetails(id);
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

  const [movie, community] = await Promise.all([
    loadMovieOrNotFound(id),
    getCachedCommunityContent(numericId),
  ]);

  const title = `${movie.title} — Onde Assistir, Avaliações e Sinopse | SeenList`;
  const description = community.aggregate
    ? `${movie.overview.slice(0, 120)}${movie.overview.length > 120 ? "…" : ""} Nota da comunidade SeenList: ${community.aggregate.average.toFixed(1)}/5 (${community.aggregate.count} ${community.aggregate.count === 1 ? "avaliação" : "avaliações"}).`
    : movie.overview.slice(0, 155);
  const posterUrl = tmdbImage(movie.posterPath, "w500");

  return {
    title,
    description,
    alternates: { canonical: `/title/movie/${id}` },
    // Decisão do usuário (2026-10-09): título SEM nenhuma avaliação pública ainda fica acessível por link direto, mas não é oferecido pro Google indexar nem entra no sitemap (ver `app/sitemap.ts`) — critérios de elegibilidade de indexação e de sitemap ficam sempre em sincronia, de propósito.
    robots: community.isEligibleForIndexing ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "video.movie",
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

export default async function PublicMovieTitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const [movie, community] = await Promise.all([
    loadMovieOrNotFound(id),
    getCachedCommunityContent(numericId),
  ]);

  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;

  // JSON-LD "Movie" — só dado real: sem `aggregateRating`/`review` quando não há nenhuma avaliação pública (mesmo princípio já usado em `app/page.tsx` pro `SoftwareApplication` — nunca inventar nota). Escala das notas é a do SeenList (0 a 5, passo de 0.5 — `reviews.rating`, ver `20260806000000_reviews_rating_0_to_5_half_step.sql`), NUNCA a nota 0–10 do TMDB (`movie.voteAverage`) — as duas nunca são misturadas no mesmo campo.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    description: movie.overview || undefined,
    image: tmdbImage(movie.posterPath, "w500") ?? undefined,
    datePublished: movie.releaseDate || undefined,
    genre: movie.genres.length > 0 ? movie.genres : undefined,
    director: movie.director ? { "@type": "Person", name: movie.director } : undefined,
    // A PEDIDO (2026-10-09 — redesign das páginas públicas, item 1) — mesmo dado agora exibido no hero, de graça no JSON-LD também.
    contentRating: movie.certification ?? undefined,
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

  // Item 9 — "ficha técnica... exibir apenas dados existentes". Direção
  // já aparece com destaque perto da sinopse (item 3), por isso NÃO se
  // repete aqui (evita a duplicação de informação apontada na revisão
  // do mockup).
  const factRows: TitleFactRow[] = [
    movie.studios.length > 0 ? { label: "Estúdios", value: movie.studios.join(", ") } : null,
    movie.country ? { label: "País de origem", value: movie.country } : null,
    movie.language ? { label: "Idioma original", value: movie.language } : null,
    movie.budget !== null ? { label: "Orçamento", value: CURRENCY_FORMATTER.format(movie.budget) } : null,
    movie.revenue !== null ? { label: "Bilheteria", value: CURRENCY_FORMATTER.format(movie.revenue) } : null,
  ].filter((row): row is TitleFactRow => row !== null);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON.stringify de dado já buscado/validado acima, nada de HTML/dado de usuário entra sem passar por `review.containsSpoiler`/sanitização dos próprios campos.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MobileAppPromoBanner />
      <TitleHeader
        mediaTypeLabel="Filme"
        title={movie.title}
        originalTitle={movie.originalTitle}
        backdropPath={movie.backdropPath}
        posterPath={movie.posterPath}
        year={year}
        certification={movie.certification}
        secondaryMetaLine={movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : null}
        genres={movie.genres}
        voteAverage={movie.voteAverage}
        communityAggregate={community.aggregate}
        trailerKey={movie.trailerKey}
        overview={movie.overview || "Sinopse não disponível."}
        creditLabel={movie.director ? "Direção" : null}
        creditNames={movie.director ? [movie.director] : []}
        watchProviders={<StreamingProviders providers={movie.watchProviders} />}
      />

      <TitlePageLayout sidebar={<><TitlePagePromoCta href={`/movies/${numericId}`} /><TitleFactsCard rows={factRows} /></>}>
        {movie.cast.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Elenco principal</h2>
            <CastCarousel cast={movie.cast} title={movie.title} year={year ? Number(year) : null} />
          </section>
        )}

        {movie.gallery.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Imagens</h2>
            <BackdropGallery paths={movie.gallery} />
          </section>
        )}

        {movie.similar.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Você também pode gostar</h2>
            <SimilarMoviesCarousel items={movie.similar} />
          </section>
        )}

        <TitleReviewsSection reviews={community.reviews} aggregate={community.aggregate} />
      </TitlePageLayout>
    </>
  );
}
