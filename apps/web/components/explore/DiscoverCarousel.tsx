"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { DiscoverItem } from "@/lib/tmdb/client";
import { DiscoverCard } from "./DiscoverCard";

export interface DiscoverCarouselProps {
  // A PEDIDO (2026-08-22) — `ReactNode` em vez de `string`: o
  // carrossel "Porque você assistiu a X" precisa colorir só o NOME
  // do título de âmbar (`highlightTitle`, ver `lib/i18n/highlightTitle.tsx`),
  // as outras seções continuam passando string simples normalmente.
  title: ReactNode;
  items: DiscoverItem[];
  isLoading: boolean;
  viewAllHref?: string;
}

// CORREÇÃO (a pedido — "tira esse botões, são redundantes") — o botão
// pílula âmbar embaixo do carrossel ("Ver todos os filmes"/"Ver todas
// as séries") levava pro MESMO lugar que a seta ">" ao lado do
// título — duas maneiras de fazer a mesma coisa, lado a lado.
// Removido o botão (e `viewAllLabel`, que só existia pra ele); a seta
// no cabeçalho continua sendo a única forma de "ver todos".
export function DiscoverCarousel({ title, items, isLoading, viewAllHref }: DiscoverCarouselProps) {
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
        <div className="flex gap-2 overflow-hidden px-4">
          {/* w-36 + gap-2 (a pedido — "deixa os cards um pouco maiores, deixa eles mais juntos") — acompanha DiscoverCard.tsx. */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : (
        // gap-2 (era gap-3) — cards mais próximos, a pedido.
        <div className="-mx-4 flex gap-2 overflow-x-auto overflow-y-hidden px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <DiscoverCard key={`${item.mediaType}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
