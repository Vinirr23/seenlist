"use client";

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
    <div>
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
        </div>
      </PageContainer>
    </div>
  );
}
