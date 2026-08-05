import { useMemo } from "react";
import { View, Pressable, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, Text } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-116 (correção — Perfil) — porta de ProfileMoviesSection.tsx: só filmes "Assistido", sem categorias, sem barra de cor.
 *
 * CORREÇÃO (bug real, reportado — "desço um pouco e trava") — antes,
 * `ScrollView` + `.map()` desenhava TODOS os filmes assistidos de uma
 * vez, imagem por imagem, sem nenhuma virtualização — pra biblioteca
 * grande (centenas de filmes), isso trava a rolagem de verdade.
 * Mesma causa raiz e mesma correção já aplicada antes ao
 * `EpisodeCarousel` (`SeasonAccordion.tsx`/`EpisodeCarousel.tsx`):
 * trocado por `FlatList` de verdade, que só desenha o que está
 * visível na tela (mais uma margem pequena), soltando o que sai da
 * tela conforme rola.
 */
export default function ProfileMoviesScreen() {
  const router = useRouter();
  const { items, isLoading } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("profile-movies");
  const cardWidth = usePosterCardWidth();

  const watchedMovies = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.mediaType === "movie" && item.status === "completed")
        // CORREÇÃO (bug real, reportado — "ordem diferente do web") —
        // mesma correção de `app/profile/series.tsx`: faltava
        // ordenar por atividade mais recente, igual ao web
        // (`ProfileMoviesSection.tsx`).
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [items]
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
        <Text variant="subtitle">Filmes</Text>
      </View>

      <View style={styles.toggleRow}>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {isLoading ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : watchedMovies.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf message="Você ainda não assistiu nenhum filme." actionLabel="Explorar" actionHref="/(tabs)/explore" />
        </View>
      ) : viewMode === "grid" ? (
        <FlatList
          key="grid"
          data={watchedMovies}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          contentContainerStyle={styles.content}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePress} cardWidth={cardWidth} />}
        />
      ) : (
        <FlatList
          key="list"
          data={watchedMovies}
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
