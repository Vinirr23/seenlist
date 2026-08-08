"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { useDiscoverList, type DiscoverListKey } from "@/lib/queries/discover";
import { useLibraryItems } from "@/lib/queries/library";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { AddToLibraryButton } from "./AddToLibraryButton";

const TITLE_KEYS: Record<DiscoverListKey, string> = {
  trending_series: "explore.discover.trendingSeries",
  trending_movies: "explore.discover.trendingMovies",
  popular_series: "explore.discover.popularSeries",
  popular_movies: "explore.discover.popularMovies",
  upcoming_movies: "explore.discover.upcomingMovies",
  on_the_air_series: "explore.discover.onTheAir",
};

export function DiscoverAllView({ list }: { list: DiscoverListKey }) {
  const { data, isLoading } = useDiscoverList(list);
  const { data: libraryItems } = useLibraryItems();
  const { t } = useTranslation();

  // CORREÇÃO (a pedido, mesmo motivo de ExploreDiscoverTab.tsx) —
  // "ver todas" não deve mostrar o que já está na Biblioteca.
  const libraryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of libraryItems ?? []) keys.add(`${item.mediaType}:${item.id}`);
    return keys;
  }, [libraryItems]);
  const items = useMemo(
    () => (data?.items ?? []).filter((item) => !libraryKeys.has(`${item.mediaType}:${item.id}`)),
    [data, libraryKeys]
  );

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/explore" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t(TITLE_KEYS[list])}</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          {items.map((item) => {
            const posterUrl = tmdbImage(item.posterPath, "w342");
            const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
            return (
              <Link key={`${item.mediaType}-${item.id}`} href={href} className="block">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface">
                  {posterUrl ? (
                    <Image src={posterUrl} alt="" fill sizes="120px" loading="lazy" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                    </div>
                  )}
                  <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} className="absolute right-1.5 top-1.5" />
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-text">{item.title}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
