"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { DiscoverItem } from "@/lib/tmdb/client";
import { useInfiniteScrollSentinel } from "@/lib/useInfiniteScrollSentinel";
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
  /**
   * A PEDIDO (2026-09-01 — fileira "Populares no SeenList" do estado
   * vazio de Séries/Home) — OPCIONAIS, os 3 juntos. Quando ausentes
   * (todo carrossel de antes desta mudança — "Em alta agora", "Para
   * você" etc.), o comportamento é EXATAMENTE o mesmo de sempre: uma
   * fileira fixa, sem carregar mais nada sozinha. Quando presentes
   * (só `PopularMediaRow.tsx` por enquanto), a rolagem HORIZONTAL
   * ganha o mesmo mecanismo de "carregar mais sozinho perto do fim"
   * já usado nas telas verticais "ver todos" (`DiscoverAllView.tsx`,
   * `useInfiniteScrollSentinel`) — reaproveitado aqui sem duplicar a
   * lógica, só apontando a sentinela pro fim da lista horizontal em
   * vez do fim de uma grade vertical (o `IntersectionObserver` por
   * baixo já considera o recorte de qualquer ancestral com rolagem
   * própria, então funciona nos dois sentidos sem mudança nenhuma no
   * hook).
   */
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

// CORREÇÃO (a pedido — "tira esse botões, são redundantes") — o botão
// pílula âmbar embaixo do carrossel ("Ver todos os filmes"/"Ver todas
// as séries") levava pro MESMO lugar que a seta ">" ao lado do
// título — duas maneiras de fazer a mesma coisa, lado a lado.
// Removido o botão (e `viewAllLabel`, que só existia pra ele); a seta
// no cabeçalho continua sendo a única forma de "ver todos".
export function DiscoverCarousel({
  title,
  items,
  isLoading,
  viewAllHref,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: DiscoverCarouselProps) {
  // `?? false`/`?? (() => {})` — o hook já não faz nada quando
  // `hasNextPage` é falso (ver `useInfiniteScrollSentinel.ts`), então
  // chamá-lo incondicionalmente aqui (regra dos hooks: nunca dentro de
  // `if`) é seguro pros carrosséis que não passam essas 3 props.
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage: isFetchingNextPage ?? false,
    fetchNextPage: fetchNextPage ?? (() => {}),
  });

  return (
    <section className="mb-8">
      {/*
        * PADRONIZADO (2026-09-01, a pedido — "verifique se 'populares
        * no seenlist' está do mesmo tamanho das fontes em perfil, se
        * não estiver, padronize" + "deixe os espaços padronizados",
        * usuário escolheu estender pro Explorar inteiro quando
        * perguntado sobre o alcance) — dois ajustes, os dois batendo
        * com `ProfileMediaCarousel.tsx`:
        *
        * 1) Fonte do título: era `text-base font-bold` (16px/700);
        *    Perfil usa `text-lg font-extrabold` (18px/800) pros
        *    títulos de carrossel de lá — tamanho e peso realmente
        *    diferentes, não impressão. Não copiado o `tracking-tight`/
        *    `text-shadow` do Perfil — aqueles existem lá pra
        *    legibilidade sobre o brilho ambiente atrás do título
        *    "Séries", não fazem parte do "tamanho da fonte" em si.
        *
        * 2) Espaçamento: `mb-6` (24px, entre uma fileira e a próxima)
        *    virou `mb-8` (32px) — Perfil usa `mb-8` entre os próprios
        *    carrosséis; `mb-2` (8px, entre o título e os pôsteres)
        *    virou `mb-3` (12px) — Perfil usa `mb-3` no mesmo lugar.
        *
        * Como este `<section>`/`<h2>` é o MESMO usado em TODO
        * carrossel de Explorar (Em alta agora, Para você, Novas
        * séries etc.), não só em "Populares no SeenList", os dois
        * ajustes valem pra tela inteira — intencional, é exatamente
        * esse o pedido: acabar com dois tamanhos/espaçamentos de
        * carrossel diferentes convivendo no app (um em Explorar,
        * outro em Perfil).
        */}
      <div className="mb-3 flex items-center justify-between px-4">
        <h2 className="text-lg font-extrabold text-text">{title}</h2>
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
          {hasNextPage && (
            // Sentinela + esqueleto — mesmo raciocínio do botão "Carregar
            // mais" nas telas verticais, só que aqui sem botão (rolagem
            // horizontal já é o gesto natural, não precisa de um botão
            // extra pra isso) — o esqueleto girando é o único aviso de
            // que tem mais vindo.
            <div ref={sentinelRef} className="flex w-16 shrink-0 items-center justify-center">
              {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-muted" strokeWidth={2} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
