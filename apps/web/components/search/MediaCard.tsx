import Link from "next/link";
import Image from "next/image";
import { Card, Badge } from "@seenlist/ui";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

const TYPE_LABEL: Record<MediaSearchResult["mediaType"], string> = {
  movie: "Filme",
  series: "Série",
};

export function MediaCard({ item }: { item: MediaSearchResult }) {
  // TASK-004: só navegação, sem implementar a tela de destino ainda.
  const href = item.mediaType === "movie" ? `/movie/${item.id}` : `/series/${item.id}`;
  const posterUrl = tmdbImage(item.posterPath, "w342");

  return (
    <Link href={href}>
      <Card className="flex gap-3 rounded-lg border border-border bg-surface p-2 transition-colors hover:bg-surface/70">
        <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-background">
          {posterUrl ? (
            <Image src={posterUrl} alt={item.title} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted">
              Sem pôster
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-1">
          <Badge className="w-fit rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            {TYPE_LABEL[item.mediaType]}
          </Badge>
          <p className="truncate text-sm font-medium text-text">{item.title}</p>
          {item.year && <p className="text-xs text-muted">{item.year}</p>}
        </div>
      </Card>
    </Link>
  );
}
