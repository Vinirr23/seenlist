import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, Alert } from "react-native";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { colors, spacing } from "@/lib/theme";

interface Category {
  label: string;
  items: LibraryItem[];
  emptyMessage: string;
  showAction?: boolean;
}

/**
 * TASK-092 — porta de `movies-home/MoviesHome.tsx` +
 * `MinhaListaSection.tsx` do web. Mais simples que Séries: filme não
 * tem temporada/episódio, só 3 status lado a lado na mesma tela
 * (Assistindo, Assistir depois, Concluídos) — no web isso também não
 * tem telas dedicadas separadas, então aqui também não precisou.
 *
 * "Em breve" já é só um placeholder NO PRÓPRIO WEB (`EmBreveSection.tsx`
 * de filmes — filme não tem "próximo episódio" recorrente como série
 * tem) — a versão nativa bate 100% com o web aqui, não é uma
 * simplificação, é a mesma decisão de produto já tomada antes.
 */
export default function MoviesScreen() {
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();

  const movies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);
  const watching = useMemo(
    () => movies.filter((item) => item.status === "watching").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [movies]
  );
  const wantToWatch = useMemo(() => movies.filter((item) => item.status === "want_to_watch"), [movies]);
  const completed = useMemo(() => movies.filter((item) => item.status === "completed"), [movies]);

  function handlePressItem(item: LibraryItem) {
    Alert.alert(item.title, "A tela de detalhes do filme ainda vai ser construída — em breve.");
  }

  const categories: Category[] = [
    {
      label: "Assistindo",
      items: watching,
      emptyMessage: "Você ainda não adicionou nenhum filme.",
      showAction: true,
    },
    { label: "Assistir depois", items: wantToWatch, emptyMessage: "Sua lista está vazia." },
    { label: "Concluídos", items: completed, emptyMessage: "Nenhum filme concluído ainda." },
  ];

  return (
    <Screen padded={false}>
      <View style={styles.titleRow}>
        <Text variant="title">Filmes</Text>
      </View>

      <HomeTabs active={tab} onChange={setTab} />

      {tab === "minha-lista" ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {isError ? (
            <EmptyShelf message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />
          ) : isLoading ? (
            <Text variant="muted">Carregando…</Text>
          ) : (
            categories.map((category) => (
              <View key={category.label} style={styles.section}>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  {category.label}
                </Text>
                {category.items.length === 0 ? (
                  <EmptyShelf
                    message={category.emptyMessage}
                    actionLabel={category.showAction ? "Explorar filmes" : undefined}
                    actionHref={category.showAction ? "/(tabs)/explore" : undefined}
                  />
                ) : (
                  <PosterGrid items={category.items} onPressItem={handlePressItem} />
                )}
              </View>
            ))
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
  titleRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
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
