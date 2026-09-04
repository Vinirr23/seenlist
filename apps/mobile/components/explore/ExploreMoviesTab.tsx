import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { useDiscoverList, useDiscoverByGenre, useDiscoverSimilar } from "@/lib/useDiscoverList";
import { useFavoriteGenres } from "@/lib/useFavoriteGenres";
import { useAnchorTitle } from "@/lib/useAnchorTitle";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { highlightTitle } from "@/lib/i18n/highlightTitle";
import { DiscoverCarousel } from "./DiscoverCarousel";
import { GenreChips } from "./GenreChips";
import { colors, spacing } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-02 — "vamos implementar as mudanças que
 * foram feitas no web", reformulação completa da Explorar) — mesma
 * estrutura/ordem exata de `apps/web/components/explore/ExploreMoviesTab.tsx`
 * (ver comentário completo lá pro histórico das fases A-D e das
 * correções de bug já feitas):
 *
 * 1. Populares no SeenList (`trending_movies`, ícone de chama âmbar).
 * 2. Porque você assistiu a [X] (só se houver título-âncora).
 * 3. Seus gêneros favoritos (chips, clicáveis).
 * 4. Principais filmes para você (só se houver gênero favorito).
 * 5. Chegando em breve (`upcoming_movies`).
 *
 * CORREÇÃO (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile, não assuma nada") — toda
 * seção agora tem `viewAllHref`, igual ao web: as 3 telas "ver todos"
 * (`app/explore/all/[list].tsx`, `app/explore/genre/[mediaType]/
 * [genreId].tsx`, `app/explore/similar/[mediaType]/[anchorId].tsx`)
 * foram criadas nesta mesma correção — a decisão anterior de omitir a
 * seta (porque a tela de destino não existia ainda) não vale mais.
 *
 * `useFilterOutLibraryItems` do web não tem equivalente aqui porque
 * não faz falta — `DiscoverCarousel.tsx` mobile já filtra
 * item-já-na-Biblioteca internamente (TASK-152), diferente do web que
 * filtra fora.
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

  const showForYou = hasCompletedItems && (favoriteGenresLoading || !!topGenre);
  const showBecauseYouWatched = hasCompletedItems && (anchorLoading || !!anchor);

  return (
    <View style={styles.wrap}>
      <DiscoverCarousel
        title={
          <View style={styles.flameTitleRow}>
            <Ionicons name="flame" size={16} color={colors.primary} />
            <Text variant="subtitle" style={{ color: colors.primary }}>
              {t("seriesHome.popularSeries")}
            </Text>
          </View>
        }
        items={trendingMovies.items}
        isLoading={trendingMovies.isLoading}
        viewAllHref="/explore/all/trending_movies"
      />

      {showBecauseYouWatched && (
        <DiscoverCarousel
          title={
            <Text variant="subtitle" style={styles.title}>
              {anchor ? highlightTitle(t("explore.discover.becauseYouWatched"), anchor.title) : "…"}
            </Text>
          }
          items={becauseYouWatched.items}
          isLoading={anchorLoading || becauseYouWatched.isLoading}
          viewAllHref={anchor ? `/explore/similar/movie/${anchor.id}?title=${encodeURIComponent(anchor.title)}` : undefined}
        />
      )}

      <GenreChips title={t("explore.discover.yourGenres")} genres={topMovieGenres} isLoading={favoriteGenresLoading} mediaType="movie" />

      {showForYou && (
        <DiscoverCarousel
          title={
            <Text variant="subtitle" style={styles.title}>
              {t("explore.discover.topMoviesForYou")}
            </Text>
          }
          items={forYou.items}
          isLoading={favoriteGenresLoading || forYou.isLoading}
          viewAllHref={topGenre ? `/explore/genre/movie/${topGenre.genreId}` : undefined}
        />
      )}

      <DiscoverCarousel
        title={
          <Text variant="subtitle" style={styles.title}>
            {t("explore.discover.upcomingMovies")}
          </Text>
        }
        items={upcomingMovies.items}
        isLoading={upcomingMovies.isLoading}
        viewAllHref="/explore/all/upcoming_movies"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.sm,
  },
  title: {
    color: colors.text,
  },
  flameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
