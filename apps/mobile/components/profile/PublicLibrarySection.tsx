import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import { usePublicLibraryItems } from "@/lib/usePublicProfile";
import { SERIES_CATEGORIES } from "@/lib/seriesCategories";
import { PosterGrid } from "@/components/media/PosterGrid";
import { Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function PublicLibrarySection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { items, isLoading, isError, refetch } = usePublicLibraryItems(userId);
  const router = useRouter();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const watchedMovies = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "completed"),
    [items]
  );

  const nonEmptyCategories = useMemo(
    () => SERIES_CATEGORIES.map((category) => ({ ...category, items: series.filter(category.filter) })).filter((c) => c.items.length > 0),
    [series]
  );

  function handlePress(item: LibraryItem) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  if (isLoading) return null;
  if (isError) {
    return <PageError message={t("error.loadLibraryFailed")} onRetry={() => refetch()} />;
  }
  if (nonEmptyCategories.length === 0 && watchedMovies.length === 0) {
    return (
      <Text variant="muted" style={styles.message}>
        {t("profile.publicLibraryEmpty")}
      </Text>
    );
  }

  return (
    <View style={styles.wrapper}>
      {nonEmptyCategories.length > 0 && (
        <View>
          <Text variant="title" style={styles.groupTitle}>
            {t("nav.series")}
          </Text>
          <View style={styles.categoryList}>
            {nonEmptyCategories.map((category) => (
              <View key={category.labelKey}>
                <Text variant="subtitle" style={styles.categoryTitle}>
                  {t(category.labelKey)}
                </Text>
                <PosterGrid items={category.items} onPressItem={handlePress} barColor={category.barColor} />
              </View>
            ))}
          </View>
        </View>
      )}

      {watchedMovies.length > 0 && (
        <View>
          <Text variant="title" style={styles.groupTitle}>
            {t("nav.movies")}
          </Text>
          <Text variant="subtitle" style={styles.categoryTitle}>
            {t("profile.watched")}
          </Text>
          <PosterGrid items={watchedMovies} onPressItem={handlePress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.lg,
  },
  groupTitle: {
    marginBottom: spacing.sm,
    fontSize: 18,
  },
  categoryList: {
    gap: spacing.lg,
  },
  categoryTitle: {
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
});
