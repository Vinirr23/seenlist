"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { useDiscoverList, type DiscoverListKey } from "@/lib/queries/discover";
import { tmdbImage } from "@/lib/tmdb/image";
import { AddToLibraryButton } from "./AddToLibraryButton";

const TITLES: Record<DiscoverListKey, string> = {
  trending_series: "Séries em alta",
  trending_movies: "Filmes em alta",
  popular_series: "Séries populares",
  popular_movies: "Filmes populares",
  upcoming_movies: "Lançamentos recentes",
  on_the_air_series: "Em breve",
};

export function DiscoverAllView({ list }: { list: DiscoverListKey }) {
  const { data, isLoading } = useDiscoverList(list);

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/explore" aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">{TITLES[list]}</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          {data?.items.map((item) => {
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
