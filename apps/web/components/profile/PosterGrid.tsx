"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { cn } from "@seenlist/utils";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useLongPress } from "./useLongPress";
import { SeriesQuickActionsSheet } from "./SeriesQuickActionsSheet";

export interface PosterGridProps {
  items: LibraryItem[];
  /** Classe de cor da barra inferior (ex.: "bg-yellow-500") — omitir pra não mostrar barra nenhuma. */
  barColorClass?: string;
  /** false desativa o pressionar-e-segurar — usado no perfil público (TASK-028), onde o pôster é da biblioteca de OUTRA pessoa; não faria sentido abrir um menu que muda status na conta de quem está vendo. */
  interactive?: boolean;
}

/**
 * TASK-024: "o mesmo componente do Explore" não existe — o Explore
 * é uma lista vertical de cards horizontais (pôster ao lado do
 * texto), não uma grade. Construído do zero, na mesma linguagem
 * visual do resto do app.
 *
 * Ajuste seguinte: pressionar e segurar um pôster de SÉRIE abre um
 * menu de ações rápidas (`SeriesQuickActionsSheet`) — só séries têm
 * esse menu (filme não tem status "pausada" nem esse fluxo pedido).
 * "Transição suave ao mudar de categoria": cada item nasce com
 * fade+leve escala via `useEffect`, sem precisar de nenhuma
 * biblioteca de animação (nenhuma está instalada no projeto).
 */
export function PosterGrid({ items, barColorClass, interactive = true }: PosterGridProps) {
  const [activeSheetId, setActiveSheetId] = useState<number | null>(null);
  const activeItem = items.find((item) => item.id === activeSheetId && item.mediaType === "series");

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <PosterGridItem
            key={`${item.mediaType}-${item.id}`}
            item={item}
            barColorClass={barColorClass}
            onLongPress={interactive && item.mediaType === "series" ? () => setActiveSheetId(item.id) : undefined}
          />
        ))}
      </div>

      {activeItem && (
        <SeriesQuickActionsSheet
          seriesId={activeItem.id}
          seriesTitle={activeItem.title}
          currentStatus={activeItem.status}
          onClose={() => setActiveSheetId(null)}
        />
      )}
    </>
  );
}

function PosterGridItem({
  item,
  barColorClass,
  onLongPress,
}: {
  item: LibraryItem;
  barColorClass?: string;
  onLongPress?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const longPress = useLongPress(onLongPress ?? (() => {}));
  const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
  const posterUrl = tmdbImage(item.posterPath, "w342");

  return (
    <Link
      href={href}
      className={cn(
        "block transition-all duration-300 ease-out",
        mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
      )}
      {...(onLongPress ? longPress : {})}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={item.title}
            fill
            sizes="(min-width: 768px) 130px, 30vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface to-background">
            <Clapperboard className="h-6 w-6 text-muted/40" strokeWidth={1.5} />
          </div>
        )}

        {barColorClass && (
          <div className={cn("absolute inset-x-0 bottom-0 h-1.5", barColorClass)} aria-hidden="true" />
        )}
      </div>
    </Link>
  );
}
