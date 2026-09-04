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
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-116 (correção — Perfil) — porta de FavoriteSeriesPageView.tsx, reaproveitando usePublicFavorites (já existia, perfil público) com o próprio userId.
 *
 * CORREÇÃO (bug real, reportado — "desço um pouco e trava", mesma
 * causa de `movies.tsx`/`series.tsx`) — trocado `ScrollView`+`.map()`
 * (desenha tudo de uma vez) por `FlatList` de verdade (virtualizada).
 */
export default function FavoriteSeriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  // CORREÇÃO (2026-09-03, causa raiz — ver comentário grande em
  // `usePublicProfile.ts`) — era `session?.user.id ?? ""`, disparava a
  // busca com uuid vazio (erro passageiro) enquanto a sessão ainda
  // carregava. O hook agora aceita `undefined` direto e só busca
  // quando o id chega.
  const { items, isLoading, isError, refetch } = usePublicFavorites(session?.user.id);
  const { viewMode, setViewMode } = useViewModePreference("profile-favorite-series");
  const cardWidth = usePosterCardWidth();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("profile.favoriteSeries")}</Text>
      </View>

      <View style={styles.toggleRow}>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {isLoading ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : isError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadFavoritesFailed")} onRetry={() => refetch()} />
        </View>
      ) : series.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf
            icon="heart"
            message={t("profile.emptyFavoriteSeries")}
            actionLabel={t("seriesHome.exploreSeries")}
            actionHref="/(tabs)/explore"
          />
        </View>
      ) : viewMode === "grid" ? (
        <FlatList
          key="grid"
          data={series}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          contentContainerStyle={styles.content}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePress} cardWidth={cardWidth} />}
        />
      ) : (
        <FlatList
          key="list"
          data={series}
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  toggleRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
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
