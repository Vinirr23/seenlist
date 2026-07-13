import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import { usePublicLibraryItems } from "@/lib/usePublicProfile";
import { PosterGrid } from "@/components/media/PosterGrid";
import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

/** Mesma ordem e mesmos rótulos de SERIES_CATEGORIES (lib/series-categories.ts) do web. */
const SERIES_CATEGORIES: { label: string; filter: (item: LibraryItem) => boolean }[] = [
  { label: "Assistindo", filter: (i) => i.status === "watching" },
  { label: "Em dia", filter: (i) => i.status === "up_to_date" },
  { label: "Assistir depois", filter: (i) => i.status === "want_to_watch" },
  { label: "Interrompidas", filter: (i) => i.status === "paused" },
  { label: "Assistidas", filter: (i) => i.status === "completed" },
];

export function PublicLibrarySection({ userId }: { userId: string }) {
  const { items, isLoading, isError } = usePublicLibraryItems(userId);
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
    return (
      <Text variant="muted" style={styles.message}>
        Não foi possível carregar a biblioteca agora.
      </Text>
    );
  }
  if (nonEmptyCategories.length === 0 && watchedMovies.length === 0) {
    return (
      <Text variant="muted" style={styles.message}>
        Este perfil ainda não tem biblioteca pública ou está vazia.
      </Text>
    );
  }

  return (
    <View style={styles.wrapper}>
      {nonEmptyCategories.length > 0 && (
        <View>
          <Text variant="title" style={styles.groupTitle}>
            Séries
          </Text>
          <View style={styles.categoryList}>
            {nonEmptyCategories.map((category) => (
              <View key={category.label}>
                <Text variant="subtitle" style={styles.categoryTitle}>
                  {category.label}
                </Text>
                <PosterGrid items={category.items} onPressItem={handlePress} />
              </View>
            ))}
          </View>
        </View>
      )}

      {watchedMovies.length > 0 && (
        <View>
          <Text variant="title" style={styles.groupTitle}>
            Filmes
          </Text>
          <Text variant="subtitle" style={styles.categoryTitle}>
            Assistidos
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
