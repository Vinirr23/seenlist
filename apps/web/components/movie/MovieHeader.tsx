"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Star, Check } from "lucide-react";
import type { MovieDetails } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { MovieQuickActionsSheet } from "./MovieQuickActionsSheet";

export function MovieHeader({ movie, watched }: { movie: MovieDetails; watched: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const backdropUrl = tmdbImage(movie.backdropPath, "w1280");
  const posterUrl = tmdbImage(movie.posterPath, "w342");
  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;

  return (
    <div className="relative">
      <div className="relative h-56 w-full bg-surface">
        {backdropUrl && (
          <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" priority />
        )}
        {/* Overlay escuro pedido no documento */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t("common.back")}
        className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
      </button>

      {/* TASK-172 (ajuste — a pedido, mesmo lugar de SeriesHeader.tsx) — "..." flutuando na capa, não espremido na fileira de botões de MovieActions.tsx (de onde saiu). */}
      <button
        type="button"
        onClick={() => {
          hapticTick();
          setShowMoreOptions(true);
        }}
        aria-label={t("action.moreOptions")}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <div className="relative -mt-16 flex gap-4 px-4">
        <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {posterUrl && <Image src={posterUrl} alt={movie.title} fill sizes="96px" className="object-cover" />}
          {watched && (
            <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-background">
              <Check className="h-3 w-3" strokeWidth={3} />
              {t("action.watched")}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-end gap-1 pb-1">
          <h1 className="text-lg font-semibold leading-tight text-text">{movie.title}</h1>
          {movie.originalTitle !== movie.title && (
            <p className="text-xs text-muted">{movie.originalTitle}</p>
          )}
          <p className="text-xs text-muted">
            {[year, movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {movie.genres.length > 0 && <p className="text-xs text-muted">{movie.genres.join(", ")}</p>}
          <div className="mt-1 flex items-center gap-1 text-xs text-primary">
            <Star className="h-3.5 w-3.5 fill-primary" />
            {movie.voteAverage.toFixed(1)}
          </div>
        </div>
      </div>

      {showMoreOptions && (
        <MovieQuickActionsSheet movieId={movie.id} movieTitle={movie.title} onClose={() => setShowMoreOptions(false)} />
      )}
    </div>
  );
}
