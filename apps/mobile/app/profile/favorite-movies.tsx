import { useMemo } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePublicFavorites } from "@/lib/usePublicProfile";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { colors, spacing } from "@/lib/theme";

/** TASK-116 (correção — Perfil) — porta de FavoriteMoviesPageView.tsx. */
export default function FavoriteMoviesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { items, isLoading } = usePublicFavorites(session?.user.id ?? "");
  const { viewMode, setViewMode } = useViewModePreference("profile-favorite-movies");

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

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toggleRow}>
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </View>

        {isLoading ? (
          viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />
        ) : movies.length === 0 ? (
          <Text variant="muted">Você ainda não favoritou nenhum filme.</Text>
        ) : viewMode === "grid" ? (
          <PosterGrid items={movies} onPressItem={handlePress} />
        ) : (
          <View style={styles.listRows}>
            {movies.map((item) => (
              <MediaListRow key={item.id} item={item} onPress={handlePress} secondaryText={item.year ? String(item.year) : ""} />
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
  listRows: {
    gap: spacing.sm,
  },
});
