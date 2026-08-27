"use client";

import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import { useMovieDetails } from "@/lib/queries/movie";
import { useMovieStatus } from "@/lib/queries/movie-status";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { MovieHeader } from "./MovieHeader";
import { MovieActions } from "./MovieActions";
import { MovieInfo } from "./MovieInfo";
import { StreamingProviders } from "./StreamingProviders";
import { SimilarMoviesCarousel } from "./SimilarMoviesCarousel";
import { MovieDetailsSkeleton } from "./MovieDetailsSkeleton";
import { CastCarousel } from "../media/CastCarousel";
import { TrailerCard } from "../media/TrailerCard";
import { EmptyState } from "../search/EmptyState";
import { PageError } from "../media/PageError";
import { PageContainer } from "../layout/PageContainer";
import { ReviewsSection } from "../social/ReviewsSection";

/** Tradução (6º lote). */
export function MovieDetailsView({ movieId }: { movieId: string }) {
  const numericId = Number(movieId);
  const { t } = useTranslation();

  const { data: movie, isLoading, isError, refetch } = useMovieDetails(movieId);
  const { data: status } = useMovieStatus(numericId);

  if (isLoading) {
    return <MovieDetailsSkeleton />;
  }

  if (isError || !movie) {
    return (
      <PageContainer>
        <PageError message={t("error.loadMovie")} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <div className="relative w-full md:mx-auto md:max-w-[430px]">
      {/*
        * "Vidro" (mesmo padrão do Perfil/Explorar/Biblioteca/Série/Episódio) —
        * campo de manchas desfocadas atrás do conteúdo. Começa só depois do
        * cabeçalho (imagem + pôster, que já têm fundo opaco próprio).
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "340px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "580px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "820px", left: "-18%", background: "#0D3B5C" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "1040px", right: "-18%", background: "#2A7FB8" }} />
        <div className="absolute h-48 w-48 rounded-full opacity-24 blur-[60px]" style={{ top: "1250px", left: "-16%", background: "#0D3B5C" }} />
      </div>

      <div className="relative">
      <MovieHeader movie={movie} watched={status === "watched"} />

      <PageContainer>
        <div className="space-y-6">
          <MovieActions movieId={numericId} />

          {/* A PEDIDO — "onde assistir" antes da sinopse, não depois do elenco como estava. */}
          <StreamingProviders providers={movie.watchProviders} />

          {!movie.overview && movie.cast.length === 0 ? (
            <EmptyState message={t("movie.noInfo")} />
          ) : (
            <MovieInfo movie={movie} />
          )}

          {movie.trailerKey && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-text">{t("series.trailer")}</h2>
              <TrailerCard videoKey={movie.trailerKey} />
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium text-text">{t("series.mainCast")}</h2>
            <CastCarousel cast={movie.cast} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-text">{t("movie.similarMovies")}</h2>
            <SimilarMoviesCarousel items={movie.similar} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-text">{t("reviews.title")}</h2>
            <ReviewsSection target={{ mediaType: "movie", mediaId: numericId }} />
          </section>

          {/* "Vidro" (mesmo padrão de ExploreActivityTab.tsx) — "glass-row". */}
          <Link
            href={`/movies/${numericId}/comments`}
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
      </PageContainer>
      </div>
    </div>
  );
}
