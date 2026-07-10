"use client";

import Link from "next/link";
import { MessageCircle, ChevronRight } from "lucide-react";
import { useMovieDetails } from "@/lib/queries/movie";
import { useMovieStatus } from "@/lib/queries/movie-status";
import { MovieHeader } from "./MovieHeader";
import { MovieActions } from "./MovieActions";
import { MovieInfo } from "./MovieInfo";
import { StreamingProviders } from "./StreamingProviders";
import { SimilarMoviesCarousel } from "./SimilarMoviesCarousel";
import { MovieDetailsSkeleton } from "./MovieDetailsSkeleton";
import { CastCarousel } from "../media/CastCarousel";
import { EmptyState } from "../search/EmptyState";
import { PageContainer } from "../layout/PageContainer";
import { ReviewsSection } from "../social/ReviewsSection";

export function MovieDetailsView({ movieId }: { movieId: string }) {
  const numericId = Number(movieId);

  const { data: movie, isLoading, isError } = useMovieDetails(movieId);
  const { data: status } = useMovieStatus(numericId);

  if (isLoading) {
    return <MovieDetailsSkeleton />;
  }

  if (isError || !movie) {
    return (
      <PageContainer>
        <EmptyState message="Não foi possível carregar este filme agora. Tente de novo em instantes." />
      </PageContainer>
    );
  }

  return (
    <div className="w-full md:mx-auto md:max-w-[430px]">
      <MovieHeader movie={movie} watched={status === "watched"} />

      <PageContainer>
        <div className="space-y-6">
          <MovieActions movieId={numericId} />

          {!movie.overview && movie.cast.length === 0 ? (
            <EmptyState message="Sem informações disponíveis para este filme." />
          ) : (
            <MovieInfo movie={movie} />
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Elenco principal</h2>
            <CastCarousel cast={movie.cast} />
          </section>

          <StreamingProviders providers={movie.watchProviders} />

          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Filmes semelhantes</h2>
            <SimilarMoviesCarousel items={movie.similar} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-text">Avaliações</h2>
            <ReviewsSection target={{ mediaType: "movie", mediaId: numericId }} />
          </section>

          <Link
            href={`/movies/${numericId}/comments`}
            className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text hover:border-primary/40"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted" strokeWidth={2} />
              Comentários
            </span>
            <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
