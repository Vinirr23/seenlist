import Link from "next/link";
import Image from "next/image";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

function hrefFor(item: MediaSearchResult): string {
  return item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
}

export function SimilarTitlesCarousel({ items }: { items: MediaSearchResult[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map((item) => {
        const posterUrl = tmdbImage(item.posterPath, "w185");
        return (
          <Link key={item.id} href={hrefFor(item)} className="w-28 shrink-0">
            <div className="relative h-40 w-28 overflow-hidden rounded-lg bg-surface">
              {posterUrl ? (
                <Image src={posterUrl} alt={item.title} fill sizes="112px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">
                  Sem pôster
                </div>
              )}
            </div>
            <p className="mt-1.5 truncate text-xs font-medium text-text">{item.title}</p>
          </Link>
        );
      })}
    </div>
  );
}
