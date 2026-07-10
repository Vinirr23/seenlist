"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@seenlist/utils";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { ProgressBar } from "../media/ProgressBar";
import { useLongPress } from "../profile/useLongPress";
import { SeriesQuickActionsSheet } from "../profile/SeriesQuickActionsSheet";

export interface ShelfCardProps {
  item: LibraryItem;
  /** "continue" = pôster grande + legenda de episódios (item 1). "compact" = as demais seções (itens 2–4). */
  variant?: "continue" | "compact";
}

/**
 * TASK-022 — versão "premium" só da Home de Séries. Existe uma
 * `MediaCard` parecida em `components/media/`, mas essa é usada pela
 * aba Filmes também (TASK-020) — o item 14 desta tarefa proíbe
 * alterar Filmes, então em vez de arriscar mudar a aparência de lá
 * sem permissão, criei uma versão à parte aqui. Sim, isso duplica
 * um pouco de estrutura; foi a troca deliberada pra respeitar
 * "não alterar Filmes" ao pé da letra.
 *
 * Ajuste: o menu de pressionar e segurar (`SeriesQuickActionsSheet`)
 * tinha sido conectado só no grid do Perfil (`PosterGrid`) — faltava
 * aqui, que é o card usado em "Continue assistindo" e na tela de
 * "Assistir depois". Mesmo hook (`useLongPress`) e mesmo menu,
 * reaproveitados sem duplicar nada.
 */
export function ShelfCard({ item, variant = "compact" }: ShelfCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const posterUrl = tmdbImage(item.posterPath, "w342");
  const href = `/series/${item.id}`;
  const isContinue = variant === "continue";

  const watched = item.progress?.watchedEpisodes ?? 0;
  const total = item.progress?.totalEpisodes ?? 0;
  const percentage = total > 0 ? Math.round((watched / total) * 100) : 0;

  const longPress = useLongPress(() => setSheetOpen(true));

  return (
    <>
      <Link
        href={href}
        className={cn(
          "group block shrink-0 snap-start outline-none",
          isContinue ? "w-44 sm:w-48 md:w-52" : "w-36 sm:w-40 md:w-44"
        )}
        {...longPress}
      >
        <div
          className={cn(
            "relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface",
            "transition-transform duration-200 ease-out",
            "group-hover:-translate-y-1 group-hover:shadow-lg",
            "group-active:scale-95"
          )}
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={item.title}
              fill
              sizes="(min-width: 768px) 200px, 176px"
              className={cn("object-cover transition-opacity duration-300", imageLoaded ? "opacity-100" : "opacity-0")}
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface to-background">
              <Clapperboard className="h-8 w-8 text-muted/40" strokeWidth={1.5} />
            </div>
          )}

          {posterUrl && !imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-surface" aria-hidden="true" />
          )}

          {isContinue && total > 0 && (
            <div className="absolute inset-x-0 bottom-0">
              <ProgressBar percentage={percentage} />
            </div>
          )}
        </div>

        <div className="mt-2 space-y-0.5">
          <p className="truncate text-sm font-semibold text-text">{item.title}</p>
          {isContinue ? (
            <p className="text-xs text-muted">
              {watched} / {total} episódios
            </p>
          ) : (
            <p className="text-xs text-muted">{item.year}</p>
          )}
        </div>
      </Link>

      {sheetOpen && (
        <SeriesQuickActionsSheet
          seriesId={item.id}
          seriesTitle={item.title}
          currentStatus={item.status}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
