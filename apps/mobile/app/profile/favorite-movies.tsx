import { useMemo } from "react";
import { View, Pressable, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePublicFavorites } from "@/lib/usePublicProfile";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, Text } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-116 (correção — Perfil) — porta de FavoriteMoviesPageView.tsx.
 *
 * CORREÇÃO (bug real, reportado — "desço um pouco e trava", mesma
 * causa de `movies.tsx`/`series.tsx`/`favorite-series.tsx`) —
 * trocado `ScrollView`+`.map()` por `FlatList` virtualizada.
 */
export default function FavoriteMoviesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { items, isLoading, isError, refetch } = usePublicFavorites(session?.user.id ?? "");
  const { viewMode, setViewMode } = useViewModePreference("profile-favorite-movies");
  const cardWidth = usePosterCardWidth();

  const movies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Filmes favoritos</Text>
      </View>

      <View style={styles.toggleRow}>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {isLoading ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : isError ? (
        <View style={styles.content}>
          <PageError message="Não foi possível carregar seus favoritos agora." onRetry={() => refetch()} />
        </View>
      ) : movies.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf
            icon="heart"
            message="Você ainda não favoritou nenhum filme."
            actionLabel="Explorar filmes"
            actionHref="/(tabs)/explore"
          />
        </View>
      ) : viewMode === "grid" ? (
        <FlatList
          key="grid"
          data={movies}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          contentContainerStyle={styles.content}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePress} cardWidth={cardWidth} />}
        />
      ) : (
        <FlatList
          key="list"
          data={movies}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          contentContainerStyle={[styles.content, styles.listRows]}
          renderItem={({ item }) => (
            <MediaListRow item={item} onPress={handlePress} secondaryText={item.year ? String(item.year) : ""} />
          )}
        />
      )}
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
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  listRows: {
    gap: spacing.sm,
  },
});
