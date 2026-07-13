import { useMemo } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { SERIES_CATEGORIES } from "@/lib/seriesCategories";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-116 (correção — Perfil) — porta de `ProfileSeriesPageView.tsx`
 * + `ProfileSeriesSection.tsx`: 5 categorias com cor própria,
 * alternando grade/lista. Diferente da aba Séries (bottom nav), que
 * só mostra "Continue assistindo" + atalhos — esta tela mostra TUDO,
 * categorizado, de uma vez.
 */
export default function ProfileSeriesScreen() {
  const router = useRouter();
  const { items, isLoading } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("profile-series");

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const nonEmptyCategories = useMemo(
    () => SERIES_CATEGORIES.map((category) => ({ ...category, items: series.filter(category.filter) })).filter((c) => c.items.length > 0),
    [series]
  );

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Séries</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toggleRow}>
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </View>

        {isLoading ? (
          <Text variant="muted">Carregando…</Text>
        ) : nonEmptyCategories.length === 0 ? (
          <Text variant="muted">Você ainda não tem nenhuma série na sua biblioteca.</Text>
        ) : (
          <View style={styles.categoryList}>
            {nonEmptyCategories.map((category) => (
              <View key={category.slug}>
                <Text variant="subtitle" style={styles.categoryTitle}>
                  {category.label}
                </Text>
                {viewMode === "grid" ? (
                  <PosterGrid items={category.items} onPressItem={handlePress} barColor={category.barColor} />
                ) : (
                  <View style={styles.listRows}>
                    {category.items.map((item) => (
                      <MediaListRow
                        key={item.id}
                        item={item}
                        onPress={handlePress}
                        secondaryText={
                          item.progress && item.progress.totalEpisodes > 0
                            ? `${item.progress.watchedEpisodes}/${item.progress.totalEpisodes} episódios`
                            : ""
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  toggleRow: {
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  categoryList: {
    gap: spacing.lg,
  },
  categoryTitle: {
    marginBottom: spacing.sm,
  },
  listRows: {
    gap: spacing.sm,
  },
});
