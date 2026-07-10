import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@seenlist/utils";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { ProgressBar } from "../media/ProgressBar";

export interface MediaCardProps {
  item: LibraryItem;
  size?: "default" | "large";
}

/**
 * TASK-017: pôster real do TMDB — mesmo `tmdbImage()` que a busca e
 * a página da série já usam, não mais o ícone placeholder genérico
 * (que só ficava por causa dos dados mockados que essa tela usava
 * antes). Some card sem pôster no TMDB ainda cai no ícone — mas isso
 * é exceção, não a regra.
 */
export function MediaCard({ item, size = "default" }: MediaCardProps) {
  const posterUrl = tmdbImage(item.posterPath, "w342");

  return (
    <Link
      href={`/series/${item.id}`}
      className={cn(
        "group block shrink-0",
        size === "large" ? "w-44 sm:w-48 md:w-52" : "w-36 sm:w-40 md:w-44"
      )}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface transition-transform duration-200 ease-out group-hover:-translate-y-1">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            sizes="(min-width: 768px) 208px, 176px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface to-background">
            <Clapperboard className="h-8 w-8 text-muted/40" strokeWidth={1.5} />
          </div>
        )}

        {/* Barra de progresso sobreposta na base do pôster, igual ao TV Time. */}
        {item.progress && item.progress.totalEpisodes > 0 && (
          <div className="absolute inset-x-0 bottom-0">
            <ProgressBar
              percentage={Math.round((item.progress.watchedEpisodes / item.progress.totalEpisodes) * 100)}
            />
          </div>
        )}
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="truncate text-base font-semibold text-text">{item.title}</p>
        <p className="text-xs text-muted">{item.year}</p>
      </div>
    </Link>
  );
}
