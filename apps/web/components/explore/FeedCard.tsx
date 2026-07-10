"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import { Clapperboard } from "lucide-react";
import type { DiscoverItem } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { AddToLibraryButton } from "./AddToLibraryButton";
import { useWatchedByStats } from "@/lib/queries/watched-by-stats";
import { genreNames } from "@/lib/queries/discover";

export interface FeedCardProps {
  item: DiscoverItem;
  genreMap: Record<number, string> | null | undefined;
  extraInfo: string | null;
}

const numberFormatter = new Intl.NumberFormat("pt-BR");

export const FeedCard = memo(function FeedCard({ item, genreMap, extraInfo }: FeedCardProps) {
  const backdropUrl = tmdbImage(item.backdropPath, "w780") ?? tmdbImage(item.posterPath, "w500");
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
  const { data: watchedBy } = useWatchedByStats(item.mediaType, item.id);
  const genres = genreNames(item, genreMap).slice(0, 3);

  return (
    <Link href={href} className="block overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="relative aspect-video w-full">
        {backdropUrl ? (
          <Image src={backdropUrl} alt="" fill sizes="400px" loading="lazy" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface">
            <Clapperboard className="h-6 w-6 text-muted/40" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} className="absolute right-3 top-3" />
        <div className="absolute inset-x-3 bottom-3">
          <p className="text-lg font-bold text-white drop-shadow">{item.title}</p>
          <p className="mt-0.5 text-xs text-white/80 drop-shadow">
            {[item.year, extraInfo, genres.join(", ")].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {watchedBy && watchedBy.count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="flex -space-x-2">
            {watchedBy.avatars.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo
              <img key={i} src={url} alt="" className="h-6 w-6 rounded-full border-2 border-surface object-cover" />
            ))}
          </div>
          <p className="text-xs text-muted">{numberFormatter.format(watchedBy.count)} pessoas assistiram</p>
        </div>
      )}
    </Link>
  );
});
