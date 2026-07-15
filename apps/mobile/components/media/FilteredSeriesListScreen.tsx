import { useMemo } from "react";
import { View, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "./PosterGrid";
import { LibraryGridSkeleton } from "./LibraryGridSkeleton";
import { EmptyShelf } from "./EmptyShelf";
import { colors, spacing } from "@/lib/theme";

export function FilteredSeriesListScreen({
  status,
  title,
  emptyMessage,
}: {
  status: LibraryStatus;
  title: string;
  emptyMessage: string;
}) {
  const router = useRouter();
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();

  const filtered = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "series" && item.status === status),
    [items, status]
  );

  function handlePressItem(item: LibraryItem) {
    router.push(`/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color={colors.muted} />
        </Pressable>
        <Text variant="subtitle">{title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isError ? (
          <EmptyShelf message="Não foi possível carregar sua lista agora. Tente de novo em instantes." />
        ) : isLoading ? (
          <LibraryGridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyShelf message={emptyMessage} actionLabel="Explorar séries" actionHref="/(tabs)/explore" />
        ) : (
          <PosterGrid items={filtered} onPressItem={handlePressItem} />
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
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
