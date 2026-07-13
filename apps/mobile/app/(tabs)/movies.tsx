import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-099 (correção — pedido do usuário) — tirei a categoria
 * "Assistindo" daqui. Diferente do web (que mantém as 3 categorias
 * lado a lado), a decisão pra este app é que filme não tem estado
 * "assistindo" que faça sentido mostrar como lista — só série tem
 * episódios/progresso pra acompanhar aos poucos. Filme é "quero
 * assistir" ou já foi assistido (o que muda o status pra "completed"
 * automaticamente, some daqui). Também removi o título "Filmes" no
 * topo — a barra de abas embaixo já diz em qual tela você está.
 */
export default function MoviesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("movies-library");

  const wantToWatch = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "want_to_watch"),
    [items]
  );

  function handlePressItem(item: LibraryItem) {
    router.push(`/movies/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.tabsRow}>
        <HomeTabs active={tab} onChange={setTab} />
      </View>

      {tab === "minha-lista" ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">Assistir depois</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <EmptyShelf message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />
          ) : isLoading ? (
            <Text variant="muted">Carregando…</Text>
          ) : wantToWatch.length === 0 ? (
            <EmptyShelf message="Sua lista está vazia." actionLabel="Explorar filmes" actionHref="/(tabs)/explore" />
          ) : viewMode === "grid" ? (
            <PosterGrid items={wantToWatch} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {wantToWatch.map((item) => (
                <MediaListRow key={item.id} item={item} onPress={handlePressItem} secondaryText={item.year ? String(item.year) : ""} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emBreve}>
          <Text variant="muted" style={styles.emBreveText}>
            Em breve — ainda não disponível para filmes.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    paddingTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  listRows: {
    gap: spacing.sm,
  },
  emBreve: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emBreveText: {
    textAlign: "center",
  },
});
