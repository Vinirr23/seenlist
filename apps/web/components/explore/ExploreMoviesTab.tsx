"use client";

import { Flame } from "lucide-react";
import { useDiscoverList, useDiscoverByGenre, useDiscoverSimilar, useFilterOutLibraryItems } from "@/lib/queries/discover";
import { useFavoriteGenres } from "@/lib/queries/favorite-genres";
import { useAnchorTitle } from "@/lib/queries/anchor-title";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { highlightTitle } from "@/lib/i18n/highlightTitle";
import { DiscoverCarousel } from "./DiscoverCarousel";
import { GenreChips } from "./GenreChips";

/**
 * Reformulação da aba Explorar (2026-08-21, especificação completa no
 * projeto) — Fase A+B, mesma filosofia de `ExploreSeriesTab.tsx`
 * (ver comentário lá pro histórico completo).
 *
 * Fase C (mesma data, seguinte) — "Para você" e "Seus gêneros
 * favoritos" de verdade, baseados nos gêneros dos títulos que você já
 * concluiu (pergunta feita ao usuário — ver `favorite-genres.ts`).
 * Fase D (2026-08-22, seguinte) — "Porque você assistiu a [X]":
 * recomendações/similares do TMDB pro título-âncora (o filme concluído/
 * em dia com atividade mais recente, ver `useAnchorTitle`). Perguntado
 * ao usuário (AskUserQuestion) e confirmado: só 1 âncora por aba (não
 * múltiplos carrosséis simultâneos), critério "mais recente"
 * (`lastActivityAt`), a seção FICA JUNTO de "Filmes populares" (não
 * substitui — usuário preferiu manter as duas), e tem tela "ver todos"
 * própria (mesma seta das outras seções, `SimilarAllView.tsx`).
 * Entra logo depois de "Para você", antes dos chips de gênero — ordem
 * exata pedida na especificação (Personalizado → Similar →
 * Preferências → Popular → Novidade).
 *
 * CORREÇÃO (a pedido, reportado — "não aparece simultâneo com o
 * resto") — antes, "Para você"/chips só renderizavam algo (ou nada)
 * quando o gênero já tinha chegado, então a seção "pulava" pra tela
 * um instante depois das outras e empurrava tudo pra baixo.
 * `showPersonalized` reserva o espaço (com esqueleto) assim que já
 * sabemos que a seção VAI existir (`hasCompletedItems`, rápido — vem
 * só da Biblioteca), sem esperar a parte lenta (gêneros/nomes) —
 * ninguém sem itens concluídos chega a ver esse espaço aparecer.
 *
 * CORREÇÃO junto (achado real — "Principais filmes para você" vazio
 * em alguns casos) — gênero de filme e de série não compartilham o
 * mesmo id no TMDB; `topMovieGenres` (separado de `topSeriesGenres`)
 * garante que o id usado aqui sempre veio do lado FILME. Ver
 * `favorite-genres.ts` pro histórico completo desse bug.
 *
 * 1. Para você (gênero #1 dos filmes concluídos, se houver).
 * 2. Porque você assistiu a [X] (Fase D) — mesma condição de "Para
 *    você" (precisa de item concluído/em dia pra ter um âncora).
 * 3. Seus gêneros favoritos (chips) — mesma condição.
 * 4. Em alta agora (trending_movies).
 * 5. Chegando em breve (upcoming_movies) — CORREÇÃO real encontrada
 *    nesta reformulação: o rótulo dizia "Lançamentos recentes" pra
 *    esse mesmo dado (`upcoming_movies` do TMDB = filmes que AINDA
 *    VÃO estrear, não os já lançados) — texto e dado diziam coisas
 *    opostas antes. Corrigido (`translations.ts`) pro sentido certo,
 *    que também é o nome que o usuário pediu.
 * 6. Filmes populares (popular_movies) — existiu como seção extra
 *    desde a Fase D, coexistindo com "Em alta agora". REMOVIDA a
 *    pedido em 2026-08-25 (redundante com "Em alta agora" pro
 *    usuário) — o hook `useDiscoverList("popular_movies")` e a rota
 *    `/explore/all/popular_movies` continuam existindo (a rota é
 *    genérica, `explore/all/[list]/page.tsx`), só não tem mais link
 *    nenhum apontando pra ela nesta aba.
 *
 * CORREÇÃO (a pedido — "tira esses botões, são redundantes; adiciona
 * nos demais a seta que tem em 'Em alta agora'") — o botão pílula
 * embaixo do carrossel foi removido (`DiscoverCarousel.tsx`); toda
 * seção com destino próprio agora usa só a seta no cabeçalho
 * (`viewAllHref`) — inclusive "Para você" (vai pra página do gênero,
 * mesmo destino do chip correspondente). ACHADO junto: a seta de "Em
 * alta agora" apontava pra `/explore/all-movies`, que sempre mostrou
 * `popular_movies` (dado DIFERENTE do carrossel trending de onde
 * clicava) — corrigido pra `/explore/all/trending_movies` (rota nova,
 * `explore/all/[list]/page.tsx`).
 */
export function ExploreMoviesTab() {
  const { topMovieGenres, isLoading: favoriteGenresLoading, hasCompletedItems } = useFavoriteGenres();
  const topGenre = topMovieGenres[0] ?? null;
  const forYou = useDiscoverByGenre("genre_movies", topGenre?.genreId ?? null);
  const { anchor, isLoading: anchorLoading } = useAnchorTitle("movie");
  const becauseYouWatched = useDiscoverSimilar("similar_movies", anchor?.id ?? null);
  const trendingMovies = useDiscoverList("trending_movies");
  const upcomingMovies = useDiscoverList("upcoming_movies");
  const { t } = useTranslation();

  const forYouFiltered = useFilterOutLibraryItems(forYou.data?.items);
  const becauseYouWatchedFiltered = useFilterOutLibraryItems(becauseYouWatched.data?.items);
  const trendingMoviesFiltered = useFilterOutLibraryItems(trendingMovies.data?.items);
  const upcomingMoviesFiltered = useFilterOutLibraryItems(upcomingMovies.data?.items);

  // Só reserva espaço pra "Para você" (com esqueleto) enquanto o
  // usuário JÁ SE SABE elegível (tem item concluído) — evita o
  // "flash" de uma seção que nunca vai aparecer pra quem não tem
  // nenhum título concluído ainda.
  const showForYou = hasCompletedItems && (favoriteGenresLoading || topGenre);
  // Mesmo raciocínio pra "Porque você assistiu a X" — reserva espaço
  // assim que já se sabe que vai existir um âncora (tem item
  // concluído/em dia), sem esperar `useAnchorTitle` terminar.
  const showBecauseYouWatched = hasCompletedItems && (anchorLoading || anchor);

  return (
    <div className="pt-4">
      {/*
        * A PEDIDO (2026-09-02 — "muda 'em alta agora' pra 'populares no
        * seenlist' com o foguinho âmbar de antes, e muda de lugar com o
        * 'principais filmes para você'") — dois ajustes juntos nesta
        * seção (era "Em alta agora", `trending_movies`, 4ª posição):
        * (1) título trocado pro MESMO texto+ícone já usados no estado
        * vazio de Séries/Filmes (`t("seriesHome.popularSeries")` +
        * `Flame` âmbar, ver `MinhaListaSection.tsx`/`PopularMediaRow.tsx`)
        * — reaproveitado de propósito (o texto já era genérico, "marca
        * do app", não específico de série), não uma chave nova; (2)
        * posição trocada com "Para você" (`showForYou`, abaixo) — essa
        * seção sobe pra 1ª posição, "Para você" desce pra onde esta
        * ficava (depois dos chips de gênero). O DADO em si
        * (`trending_movies`) não mudou, só rótulo/ícone/posição.
        */}
      <DiscoverCarousel
        title={
          <span className="flex items-center gap-1.5 text-primary">
            <Flame className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            {t("seriesHome.popularSeries")}
          </span>
        }
        items={trendingMoviesFiltered}
        isLoading={trendingMovies.isLoading}
        viewAllHref="/explore/all/trending_movies"
      />

      {showBecauseYouWatched && (
        <DiscoverCarousel
          title={anchor ? highlightTitle(t("explore.discover.becauseYouWatched"), anchor.title) : "…"}
          items={becauseYouWatchedFiltered}
          isLoading={anchorLoading || becauseYouWatched.isLoading}
          viewAllHref={anchor ? `/explore/similar/movie/${anchor.id}?title=${encodeURIComponent(anchor.title)}` : undefined}
        />
      )}

      <GenreChips title={t("explore.discover.yourGenres")} genres={topMovieGenres} isLoading={favoriteGenresLoading} mediaType="movie" />

      {showForYou && (
        <DiscoverCarousel
          title={t("explore.discover.topMoviesForYou")}
          items={forYouFiltered}
          isLoading={favoriteGenresLoading || forYou.isLoading}
          viewAllHref={topGenre ? `/explore/genre/movie/${topGenre.genreId}` : undefined}
        />
      )}

      <DiscoverCarousel
        title={t("explore.discover.upcomingMovies")}
        items={upcomingMoviesFiltered}
        isLoading={upcomingMovies.isLoading}
        viewAllHref="/explore/all/upcoming_movies"
      />
    </div>
  );
}
