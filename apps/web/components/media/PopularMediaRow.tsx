"use client";

import { useMemo } from "react";
import { useDiscoverListInfinite, flattenDiscoverPages, useFilterOutLibraryItems, type DiscoverListKey } from "@/lib/queries/discover";
import { DiscoverCarousel } from "../explore/DiscoverCarousel";

export interface PopularMediaRowProps {
  list: DiscoverListKey;
  title: string;
  viewAllHref?: string;
}

/**
 * "Estado vazio melhorado" (2026-09-01, a pedido — GPT sugeriu uma
 * fileira "Populares no SeenList" dentro do estado vazio de
 * Séries/Home; usuário aprovou como o primeiro pedaço a construir).
 *
 * Por que é um componente PRÓPRIO, separado, em vez de só chamar
 * `useDiscoverListInfinite("trending_series")` direto dentro de
 * `MinhaListaSection.tsx`: essa seção só faz sentido quando a Home
 * está VAZIA ou "tudo em dia" — na maioria das visitas (biblioteca
 * com séries pendentes) ela nem aparece. Um componente React só
 * executa seus próprios hooks quando está de fato MONTADO — então,
 * renderizando `<PopularMediaRow />` só dentro dos ramos
 * vazio/tudo-em-dia (ver `MinhaListaSection.tsx`), a busca de
 * "populares" só dispara quando a fileira de fato vai aparecer na
 * tela, sem gastar uma chamada de rede extra em toda visita normal à
 * Home.
 *
 * Reaproveita 100% do que já existe em Explorar — mesmo
 * `DiscoverCarousel`/`DiscoverCard` (com botão de adicionar por cima
 * de cada pôster), mesmo `useFilterOutLibraryItems` (tira da lista
 * quem já está na Biblioteca) usados em `ExploreSeriesTab.tsx`/
 * `ExploreMoviesTab.tsx` — nada de componente novo pro carrossel em
 * si.
 *
 * A PEDIDO (2026-09-01, seguinte) — "adiciona uma seta > e torna a
 * rolagem infinita": duas mudanças, uma em cada ponta.
 *
 * 1. `viewAllHref` (novo, recebido por fora) — mesma seta ">" que
 *    toda outra fileira de Explorar já tem, apontando pra MESMA
 *    rota genérica "ver todos" (`/explore/all/[list]`,
 *    `DiscoverAllView.tsx`) que "Em alta agora" já usa pra
 *    `trending_series` — nenhuma tela nova, só passar o link.
 * 2. A rolagem HORIZONTAL da própria fileira, aqui na Home, também
 *    virou infinita: trocado `useDiscoverList` (1 página fixa, corte
 *    manual em 8) por `useDiscoverListInfinite` (o MESMO hook
 *    paginado que `DiscoverAllView.tsx` já usa) — sem corte nenhum
 *    agora, a lista cresce sozinha conforme a pessoa rola pra
 *    direita (`hasNextPage`/`isFetchingNextPage`/`fetchNextPage`
 *    repassados pro `DiscoverCarousel`, que já sabe o que fazer com
 *    eles — ver comentário lá).
 */
export function PopularMediaRow({ list, title, viewAllHref }: PopularMediaRowProps) {
  const discover = useDiscoverListInfinite(list);
  const rawItems = useMemo(() => flattenDiscoverPages(discover.data?.pages), [discover.data]);
  const items = useFilterOutLibraryItems(rawItems);

  // Evita mostrar o título da seção "pendurado" sozinho, sem nenhum
  // pôster embaixo, no caso raro em que a pessoa já adicionou TODOS
  // os títulos em alta no momento (fica só o esqueleto até carregar,
  // depois some por completo se não sobrar nada pra mostrar — mesmo
  // sem mais páginas, `hasNextPage` some sozinho quando o TMDB
  // esgota, então não fica tentando buscar pra sempre).
  if (!discover.isLoading && items.length === 0 && !discover.hasNextPage) return null;

  return (
    <DiscoverCarousel
      title={title}
      items={items}
      isLoading={discover.isLoading}
      viewAllHref={viewAllHref}
      hasNextPage={discover.hasNextPage}
      isFetchingNextPage={discover.isFetchingNextPage}
      fetchNextPage={discover.fetchNextPage}
    />
  );
}
