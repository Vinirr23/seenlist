import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { colors, spacing, radius } from "@/lib/theme";

const CONTINUE_LIMIT = 8;

/**
 * TASK-091 — primeira tela de conteúdo real do app nativo (depois da
 * fundação). Porta o essencial de `SeriesHome.tsx` +
 * `MinhaListaSection.tsx` do web: sub-abas (agora via `HomeTabs`
 * compartilhado, TASK-092), "Continue assistindo" (status "watching",
 * os 8 mais recentes) com pôster/progresso de verdade vindos do
 * Supabase, e os 3 atalhos que no web abrem telas dedicadas (aqui,
 * telas empilhadas dentro da própria aba — ver `_layout.tsx`).
 *
 * Fora do escopo desta leva, de propósito: a sub-aba "Em breve"
 * (busca o próximo episódio de cada série no TMDB — feature própria,
 * maior que a Home em si) e a tela de detalhes da série (tocar num
 * pôster ainda só mostra um aviso).
 */
export default function SeriesHomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();

  const continueWatching = useMemo(() => {
    return (items ?? [])
      .filter((item) => item.mediaType === "series" && item.status === "watching")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, CONTINUE_LIMIT);
  }, [items]);

  function handlePressItem(item: LibraryItem) {
    router.push(`/series/${item.id}`);
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
          <Text variant="subtitle" style={styles.sectionTitle}>
            Continue assistindo
          </Text>

          {isError ? (
            <EmptyShelf message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />
          ) : isLoading ? (
            <Text variant="muted">Carregando…</Text>
          ) : continueWatching.length === 0 ? (
            <EmptyShelf
              message="Você ainda não está acompanhando nenhuma série."
              actionLabel="Explorar séries"
              actionHref="/(tabs)/explore"
            />
          ) : (
            <PosterGrid items={continueWatching} onPressItem={handlePressItem} />
          )}

          <View style={styles.linkList}>
            <ListLinkButton
              label='Ver todas da lista "Assistir depois"'
              onPress={() => router.push("/(tabs)/series/watchlist")}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emBreve}>
          <Feather name="calendar" size={28} color={colors.primary} />
          <Text variant="subtitle" style={styles.emBreveTitle}>
            Em breve
          </Text>
          <Text variant="muted" style={styles.emBreveText}>
            O próximo episódio de cada série que você acompanha vai aparecer aqui. Essa parte ainda não foi construída
            nativamente.
          </Text>
        </View>
      )}
    </Screen>
  );
}

function ListLinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.linkButton}>
      <Text variant="body" style={styles.linkButtonText}>
        {label}
      </Text>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
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
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  linkList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  linkButtonText: {
    fontWeight: "600",
  },
  emBreve: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emBreveTitle: {
    marginTop: spacing.xs,
  },
  emBreveText: {
    textAlign: "center",
  },
});
