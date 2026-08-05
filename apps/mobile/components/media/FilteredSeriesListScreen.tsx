import { useMemo } from "react";
import { View, RefreshControl, Pressable, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { Screen, Text } from "@/components/ui";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "./PosterGrid";
import { LibraryGridSkeleton } from "./LibraryGridSkeleton";
import { EmptyShelf } from "./EmptyShelf";
import { PageError } from "./PageError";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-116/176 — telas "Assistir depois"/"Concluídas"/"Interrompidas"
 * (Séries), acessadas pelo botão no fim da Home. Um componente só,
 * reaproveitado pelas 3 (só muda `status`/`title`/`emptyMessage`).
 *
 * CORREÇÃO (bug real, reportado com print — pôster colado na barra
 * de navegação) — essa tela está DENTRO da aba Séries
 * (`app/(tabs)/series/watchlist.tsx` etc.), então a barra de
 * navegação (`position: absolute`) fica por cima dela igual — só que
 * essa tela nunca tinha somado `useTabBarClearance()` no
 * `paddingBottom`, diferente de toda outra tela com lista dentro de
 * uma aba (mesmo ajuste já usado em todo canto, ver
 * `useTabBarClearance.ts`).
 *
 * CORREÇÃO (a pedido — mesmo achado #3 já corrigido no Perfil) —
 * trocado `ScrollView`+`PosterGrid` (desenha tudo de uma vez, sem
 * limite) por `FlatList` virtualizada — série "Concluídas" pode
 * crescer bastante ao longo do tempo de uso.
 */
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
  const cardWidth = usePosterCardWidth();
  const tabBarClearance = useTabBarClearance();

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

      {isError ? (
        <View style={styles.content}>
          <PageError message="Não foi possível carregar sua lista agora. Tente de novo em instantes." onRetry={() => refetch()} />
        </View>
      ) : isLoading ? (
        <View style={styles.content}>
          <LibraryGridSkeleton />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf message={emptyMessage} actionLabel="Explorar séries" actionHref="/(tabs)/explore" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePressItem} cardWidth={cardWidth} />}
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
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
});
