"use client";

import { useDiscoverList, useDiscoverByGenre, useDiscoverSimilar, useFilterOutLibraryItems } from "@/lib/queries/discover";
import { useFavoriteGenres } from "@/lib/queries/favorite-genres";
import { useAnchorTitle } from "@/lib/queries/anchor-title";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { highlightTitle } from "@/lib/i18n/highlightTitle";
import { DiscoverCarousel } from "./DiscoverCarousel";
import { GenreChips } from "./GenreChips";

/**
 * Reformulação da aba Explorar (2026-08-21, especificação completa
 * salva em `SEENLIST-EXPLORAR-REFORMULACAO-2026-08-21.md` no
 * projeto) — Fase A+B: troca a antiga aba única "Descobrir" (que
 * misturava séries e filmes nos mesmos carrosséis) por uma aba
 * DEDICADA só de séries, na nova ordem pedida.
 *
 * Fase C (mesma data, seguinte) — "Para você" (carrossel filtrado
 * pelo gênero #1 dos títulos já concluídos) e "Seus gêneros
 * favoritos" (chips) — ver `favorite-genres.ts` pro cálculo completo
 * e a pergunta feita ao usuário sobre qual fonte contar.
 *
 * Fase D (2026-08-22, seguinte) — "Porque você assistiu a [X]":
 * recomendações/similares do TMDB pro título-âncora (a série concluída/
 * em dia com atividade mais recente, ver `useAnchorTitle`). Perguntado
 * ao usuário (AskUserQuestion) e confirmado: só 1 âncora por aba (não
 * múltiplos carrosséis simultâneos), critério "mais recente"
 * (`lastActivityAt`), a seção FICA JUNTO de "Séries populares" (não
 * substitui — usuário preferiu manter as duas), e tem tela "ver todos"
 * própria (mesma seta das outras seções, `SimilarAllView.tsx`). Entra
 * logo depois de "Para você", antes dos chips de gênero — ordem exata
 * pedida na especificação (Personalizado → Similar → Preferências →
 * Popular → Novidade).
 *
 * CORREÇÃO (a pedido, reportado — "não aparece simultâneo com o
 * resto") — `showForYou` reserva o espaço (com esqueleto) assim que
 * já sabemos que a seção VAI existir (`hasCompletedItems`, rápido),
 * sem esperar a parte lenta (gêneros/nomes) — ver comentário completo
 * em `ExploreMoviesTab.tsx`.
 *
 * CORREÇÃO junto (achado real — "Principais séries para você"
 * SEMPRE vazio) — causa raiz: gênero de filme e de série não
 * compartilham o mesmo id no TMDB ("Ação"/28 e "Aventura"/12 só
 * existem no lado filme; série usa "Ação e Aventura"/10759). O
 * cálculo antigo combinava filme+série num "gênero favorito" único e
 * usava esse id pro `/discover/tv` também — quando o gênero vencedor
 * vinha dos filmes concluídos, a busca de séries daquele gênero nunca
 * tinha erro, só nunca tinha resultado. `topSeriesGenres` (separado
 * de `topMovieGenres`, ver `favorite-genres.ts`) garante que o id usado
 * aqui sempre veio do lado SÉRIE.
 *
 * 1. Para você (gênero #1 das séries concluídas, se houver).
 * 2. Porque você assistiu a [X] (Fase D) — mesma condição de "Para
 *    você" (precisa de item concluído/em dia pra ter um âncora).
 * 3. Seus gêneros favoritos (chips) — mesma condição.
 * 4. Em alta agora (trending_series) — igual a antes, só que sem o
 *    duplicado ("Principais séries pra você" mostrava quase os MESMOS
 *    títulos deste, a pedido do usuário foi removido).
 * 5. Novas séries (on_the_air_series) — antes rotulado "Em breve"
 *    (confuso — TMDB "on the air" = séries com episódio recente/no
 *    ar, não "ainda vai estrear"). Sem dado de "estreias futuras" de
 *    verdade pra séries no app hoje (TMDB não tem um endpoint
 *    "upcoming" pra TV como tem pra filme) — "Chegando em breve" de
 *    séries fica pra quando isso for construído.
 * 6. Séries populares (popular_series) — existiu como seção extra
 *    desde a Fase D, coexistindo com "Em alta agora". REMOVIDA a
 *    pedido em 2026-08-25 (redundante com "Em alta agora" pro
 *    usuário) — o hook `useDiscoverList("popular_series")` e a rota
 *    `/explore/all/popular_series` continuam existindo (a rota é
 *    genérica, `explore/all/[list]/page.tsx`), só não tem mais link
 *    nenhum apontando pra ela nesta aba.
 *
 * CORREÇÃO (a pedido — "tira esses botões, são redundantes; adiciona
 * nos demais a seta que tem em 'Em alta agora'") — botão pílula
 * embaixo removido (`DiscoverCarousel.tsx`); toda seção agora usa só
 * a seta no cabeçalho. ACHADO junto: a seta de "Em alta agora"
 * apontava pra `/explore/all-series`, que sempre mostrou
 * `popular_series` (dado DIFERENTE do carrossel trending de onde
 * clicava) — corrigido pra `/explore/all/trending_series`.
 */
export function ExploreSeriesTab() {
  const { topSeriesGenres, isLoading: favoriteGenresLoading, hasCompletedItems } = useFavoriteGenres();
  const topGenre = topSeriesGenres[0] ?? null;
  const forYou = useDiscoverByGenre("genre_series", topGenre?.genreId ?? null);
  const { anchor, isLoading: anchorLoading } = useAnchorTitle("series");
  const becauseYouWatched = useDiscoverSimilar("similar_series", anchor?.id ?? null);
  const trendingSeries = useDiscoverList("trending_series");
  const onTheAirSeries = useDiscoverList("on_the_air_series");
  const { t } = useTranslation();

  const forYouFiltered = useFilterOutLibraryItems(forYou.data?.items);
  const becauseYouWatchedFiltered = useFilterOutLibraryItems(becauseYouWatched.data?.items);
  const trendingSeriesFiltered = useFilterOutLibraryItems(trendingSeries.data?.items);
  const onTheAirFiltered = useFilterOutLibraryItems(onTheAirSeries.data?.items);

  const showForYou = hasCompletedItems && (favoriteGenresLoading || topGenre);
  // Mesmo raciocínio de `showForYou` — reserva espaço assim que já se
  // sabe que vai existir um âncora, sem esperar `useAnchorTitle`.
  const showBecauseYouWatched = hasCompletedItems && (anchorLoading || anchor);

  return (
    <div className="pt-4">
      {showForYou && (
        <DiscoverCarousel
          title={t("explore.discover.topSeriesForYou")}
          items={forYouFiltered}
          isLoading={favoriteGenresLoading || forYou.isLoading}
          viewAllHref={topGenre ? `/explore/genre/series/${topGenre.genreId}` : undefined}
        />
      )}

      {showBecauseYouWatched && (
        <DiscoverCarousel
          title={anchor ? highlightTitle(t("explore.discover.becauseYouWatched"), anchor.title) : "…"}
          items={becauseYouWatchedFiltered}
          isLoading={anchorLoading || becauseYouWatched.isLoading}
          viewAllHref={anchor ? `/explore/similar/series/${anchor.id}?title=${encodeURIComponent(anchor.title)}` : undefined}
        />
      )}

      <GenreChips title={t("explore.discover.yourGenres")} genres={topSeriesGenres} isLoading={favoriteGenresLoading} mediaType="series" />

      <DiscoverCarousel
        title={t("explore.discover.trendingNow")}
        items={trendingSeriesFiltered}
        isLoading={trendingSeries.isLoading}
        viewAllHref="/explore/all/trending_series"
      />

      <DiscoverCarousel
        title={t("explore.discover.onTheAir")}
        items={onTheAirFiltered}
        isLoading={onTheAirSeries.isLoading}
        viewAllHref="/explore/all/on_the_air_series"
      />
    </div>
  );
}
