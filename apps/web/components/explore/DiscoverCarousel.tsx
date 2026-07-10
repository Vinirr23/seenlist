"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DiscoverItem } from "@/lib/tmdb/client";
import { DiscoverCard } from "./DiscoverCard";

export interface DiscoverCarouselProps {
  title: string;
  items: DiscoverItem[];
  isLoading: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
}

export function DiscoverCarousel({ title, items, isLoading, viewAllHref, viewAllLabel }: DiscoverCarouselProps) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between px-4">
        <h2 className="text-base font-bold text-text">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-muted">
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-28 shrink-0 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <DiscoverCard key={`${item.mediaType}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      {viewAllHref && viewAllLabel && (
        <Link
          href={viewAllHref}
          className="mx-4 mt-3 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-background"
        >
          {viewAllLabel}
          <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      )}
    </section>
  );
}
