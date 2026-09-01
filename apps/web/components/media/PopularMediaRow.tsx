"use client";

import { useDiscoverList, useFilterOutLibraryItems, type DiscoverListKey } from "@/lib/queries/discover";
import { DiscoverCarousel } from "../explore/DiscoverCarousel";

export interface PopularMediaRowProps {
  list: DiscoverListKey;
  title: string;
}

/**
 * "Estado vazio melhorado" (2026-09-01, a pedido — GPT sugeriu uma
 * fileira "Populares no SeenList" dentro do estado vazio de
 * Séries/Home; usuário aprovou como o primeiro pedaço a construir).
 *
 * Por que é um componente PRÓPRIO, separado, em vez de só chamar
 * `useDiscoverList("trending_series")` direto dentro de
 * `MinhaListaSection.tsx`: essa seção só faz sentido quando a Home
 * está VAZIA ou "tudo em dia" — na maioria das visitas (biblioteca
 * com séries pendentes) ela nem aparece. `useDiscoverList` não tem
 * (nem precisa ter) uma opção `enabled` — ela só decide de verdade
 * QUANDO buscar quando o hook em si só é chamado dentro do
 * componente certo. Um componente React só executa seus próprios
 * hooks quando está de fato MONTADO — então, renderizando
 * `<PopularMediaRow />` só dentro dos ramos vazio/tudo-em-dia (ver
 * `MinhaListaSection.tsx`), a busca de "populares" só dispara quando
 * a fileira de fato vai aparecer na tela, sem gastar uma chamada de
 * rede extra em toda visita normal à Home.
 *
 * Reaproveita 100% do que já existe em Explorar — mesmo
 * `DiscoverCarousel`/`DiscoverCard` (com botão de adicionar por
 * cima de cada pôster), mesmo `useDiscoverList`/
 * `useFilterOutLibraryItems` (tira da lista quem já está na
 * Biblioteca) usados em `ExploreSeriesTab.tsx`/`ExploreMoviesTab.tsx`
 * — nada de componente novo pro carrossel em si.
 *
 * `list`/`title` recebidos por fora (não fixos em "trending_series")
 * de propósito: o mesmo componente já serve pra Filmes
 * (`trending_movies`) quando/se o mesmo tratamento for pedido lá —
 * ver `MinhaListaSection.tsx` (Filmes) — sem duplicar este arquivo.
 */
export function PopularMediaRow({ list, title }: PopularMediaRowProps) {
  const discover = useDiscoverList(list);
  const filtered = useFilterOutLibraryItems(discover.data?.items);
  // 8 pra não competir visualmente com o card/CTA do estado vazio
  // acima dela — mesmo corte já usado em "Continue assistindo"
  // (`CONTINUE_ASSISTINDO_LIMIT`).
  const items = filtered.slice(0, 8);

  // Evita mostrar o título da seção "pendurado" sozinho, sem nenhum
  // pôster embaixo, no caso raro em que a pessoa já adicionou TODOS
  // os títulos em alta no momento (fica só o esqueleto até carregar,
  // depois some por completo se não sobrar nada pra mostrar).
  if (!discover.isLoading && items.length === 0) return null;

  return <DiscoverCarousel title={title} items={items} isLoading={discover.isLoading} />;
}
