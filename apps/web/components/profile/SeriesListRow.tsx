import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

export interface SeriesListRowProps {
  item: LibraryItem;
  secondaryText: string;
}

/**
 * Segundo componente de visualização pedido — "apenas dois
 * componentes consumindo os mesmos dados". O grid já existia
 * (`PosterGrid`); este é novo. `secondaryText` já vem calculado de
 * fora (ver `ProfileSeriesSection`), porque o que mostrar muda por
 * categoria (próximo dado disponível: progresso, ano, ou total
 * assistido — sem "próximo episódio" porque essa informação vem de
 * uma busca separada ao TMDB que esta tarefa não autoriza criar).
 */
export function SeriesListRow({ item, secondaryText }: SeriesListRowProps) {
  const posterUrl = tmdbImage(item.posterPath, "w185");

  return (
    <Link
      href={`/series/${item.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
    >
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
