"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import type { SeriesDetails } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

export function SeriesHeader({ series }: { series: SeriesDetails }) {
  const router = useRouter();
  const backdropUrl = tmdbImage(series.backdropPath, "w1280");
  const posterUrl = tmdbImage(series.posterPath, "w342");
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;

  return (
    <div className="relative">
      <div className="relative h-56 w-full bg-surface">
        {backdropUrl && (
          <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" priority />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Voltar"
        className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <div className="relative -mt-16 flex gap-4 px-4">
        <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {posterUrl && <Image src={posterUrl} alt={series.title} fill sizes="96px" className="object-cover" />}
        </div>

        <div className="flex flex-1 flex-col justify-end gap-1 pb-1">
          <h1 className="text-lg font-semibold leading-tight text-text">{series.title}</h1>
          <p className="text-xs text-muted">
            {[year, `${series.numberOfSeasons} temporada${series.numberOfSeasons === 1 ? "" : "s"}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {series.genres.length > 0 && (
            <p className="text-xs text-muted">{series.genres.join(", ")}</p>
          )}
          <div className="mt-1 flex items-center gap-1 text-xs text-primary">
            <Star className="h-3.5 w-3.5 fill-primary" />
            {series.voteAverage.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
