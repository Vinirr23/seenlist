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
 * estrutura/ordem exata de `apps/web/components/explore/ExploreSeriesTab.tsx`
 * (ver `ExploreMoviesTab.tsx` deste app pro racional completo das
 * diferenças deliberadas em relação ao web — mesmo aqui):
 *
 * 1. Populares no SeenList (`trending_series`, ícone de chama âmbar).
 * 2. Porque você assistiu a [X] (só se houver título-âncora).
 * 3. Seus gêneros favoritos (chips).
 * 4. Principais séries para você (só se houver gênero favorito).
 * 5. Novas séries (`on_the_air_series`).
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
        items={trendingSeries.items}
        isLoading={trendingSeries.isLoading}
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
        />
      )}

      <GenreChips title={t("explore.discover.yourGenres")} genres={topSeriesGenres} isLoading={favoriteGenresLoading} />

      {showForYou && (
        <DiscoverCarousel
          title={
            <Text variant="subtitle" style={styles.title}>
              {t("explore.discover.topSeriesForYou")}
            </Text>
          }
          items={forYou.items}
          isLoading={favoriteGenresLoading || forYou.isLoading}
        />
      )}

      <DiscoverCarousel
        title={
          <Text variant="subtitle" style={styles.title}>
            {t("explore.discover.onTheAir")}
          </Text>
        }
        items={onTheAirSeries.items}
        isLoading={onTheAirSeries.isLoading}
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
