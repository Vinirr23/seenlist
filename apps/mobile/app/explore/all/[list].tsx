import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DiscoverGridScreen } from "@/components/explore/DiscoverGridScreen";
import { useDiscoverListInfinite } from "@/lib/useDiscoverList";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import type { DiscoverListKey } from "@/lib/discover";

/**
 * PORTE DO WEB (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile, não assuma nada") —
 * versão RN de `apps/web/app/(main)/explore/all/[list]/page.tsx`
 * (rota dinâmica única pras 6 listas fixas, em vez de uma pasta por
 * lista — mesmo raciocínio de lá).
 */
const VALID_LISTS: DiscoverListKey[] = [
  "trending_series",
  "trending_movies",
  "popular_series",
  "popular_movies",
  "upcoming_movies",
  "on_the_air_series",
];

// Idêntico ao TITLE_KEYS de `DiscoverAllView.tsx` (web) — todas as 6
// chaves já existiam em `translations.ts` antes desta correção
// (conferido, não precisou adicionar nenhuma nova aqui).
const TITLE_KEYS: Record<DiscoverListKey, string> = {
  trending_series: "explore.discover.trendingSeries",
  trending_movies: "explore.discover.trendingMovies",
  popular_series: "explore.discover.popularSeries",
  popular_movies: "explore.discover.popularMovies",
  upcoming_movies: "explore.discover.upcomingMovies",
  on_the_air_series: "explore.discover.onTheAir",
};

export default function ExploreAllListScreen() {
  const { list } = useLocalSearchParams<{ list: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const isValid = VALID_LISTS.includes(list as DiscoverListKey);

  // Sem `notFound()` equivalente direto no expo-router — só os links
  // que a gente mesmo gera (`ExploreMoviesTab.tsx`/`ExploreSeriesTab.tsx`)
  // apontam pra cá, igual ao comentário do web sobre o mesmo assunto,
  // então este ramo é praticamente inalcançável na prática; volta pra
  // trás em vez de mostrar uma grade vazia/quebrada.
  useEffect(() => {
    if (!isValid) router.back();
  }, [isValid, router]);

  // Hook chamado incondicionalmente (regra dos hooks) — usa um valor
  // qualquer válido como fallback quando `list` não bate com nenhuma
  // das 6 chaves; a busca deste fallback nunca chega a aparecer,
  // porque o `useEffect` acima já volta pra trás antes.
  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useDiscoverListInfinite(
    isValid ? (list as DiscoverListKey) : "trending_movies"
  );

  if (!isValid) return null;

  return (
    <DiscoverGridScreen
      title={t(TITLE_KEYS[list as DiscoverListKey])}
      items={items}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
      // Só esta tela mostra título embaixo do pôster — igual ao web:
      // `DiscoverAllView.tsx` mostra, `GenreAllView.tsx`/
      // `SimilarAllView.tsx` não (inconsistência real do próprio web,
      // conferida linha a linha, não corrigida por conta própria — ver
      // comentário completo em `DiscoverGridScreen.tsx`).
      showItemTitles
    />
  );
}
