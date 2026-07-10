"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import { Clapperboard } from "lucide-react";
import type { DiscoverItem } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import { AddToLibraryButton } from "./AddToLibraryButton";

export const DiscoverCard = memo(function DiscoverCard({ item }: { item: DiscoverItem }) {
  const posterUrl = tmdbImage(item.posterPath, "w342");
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;

  return (
    <Link href={href} className="block w-28 shrink-0">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface">
        {posterUrl ? (
          <Image src={posterUrl} alt="" fill sizes="112px" loading="lazy" className="object-cover" />
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
});
