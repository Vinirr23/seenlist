import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

export interface MediaListRowProps {
  item: LibraryItem;
  secondaryText: string;
}

/**
 * Generalização de `SeriesListRow` (criado pro Perfil) — o link era
 * fixo em `/series/${id}`, o que quebraria pra filme. Agora usa
 * `item.mediaType`, igual ao `MediaCard`/`ShelfCard` já fazem.
 * Reaproveitado pelo toggle grade/lista de Séries e Filmes.
 */
export function MediaListRow({ item, secondaryText }: MediaListRowProps) {
  const posterUrl = tmdbImage(item.posterPath, "w185");
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;

  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-background">
        {posterUrl ? (
          <Image src={posterUrl} alt={item.title} fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{item.title}</p>
        {secondaryText && <p className="truncate text-xs text-muted">{secondaryText}</p>}
      </div>
    </Link>
  );
}
