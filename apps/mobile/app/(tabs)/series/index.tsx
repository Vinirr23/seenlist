import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useUpcomingEpisodes } from "@/lib/useUpcomingEpisodes";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { UpcomingEpisodeCard } from "@/components/media/UpcomingEpisodeCard";
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
 * Fora do escopo desta leva, de propósito, na época: a sub-aba "Em
 * breve" (TASK-119, já construída depois) e a tela de detalhes da
 * série (também já construída depois).
 */
export default function SeriesHomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();
  const upcoming = useUpcomingEpisodes();
  const { viewMode, setViewMode } = useViewModePreference("series-library");

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
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">Continue assistindo</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

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
          ) : viewMode === "grid" ? (
            <PosterGrid items={continueWatching} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {continueWatching.map((item) => (
                <MediaListRow
                  key={item.id}
                  item={item}
                  onPress={handlePressItem}
                  secondaryText={
                    item.progress && item.progress.totalEpisodes > 0
                      ? `${item.progress.watchedEpisodes}/${item.progress.totalEpisodes} episódios`
                      : ""
                  }
                />
              ))}
            </View>
          )}

          <View style={styles.linkList}>
            <ListLinkButton
              label='Ver todas da lista "Assistir depois"'
              onPress={() => router.push("/(tabs)/series/watchlist")}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {upcoming.isLoading ? (
            <Text variant="muted">Carregando…</Text>
          ) : upcoming.isError ? (
            <EmptyShelf message="Não foi possível carregar os próximos episódios agora. Tente de novo em instantes." />
          ) : upcoming.groups.length === 0 ? (
            <EmptyShelf
              message="Nenhum episódio previsto. Continue acompanhando séries para receber novidades."
              actionLabel="Explorar séries"
              actionHref="/(tabs)/explore"
            />
          ) : (
            <View style={styles.groupList}>
              {upcoming.groups.map((group) => (
                <View key={group.dateKey}>
                  <View style={styles.dayPillWrapper}>
                    <View style={styles.dayPill}>
                      <Text style={styles.dayPillText}>{group.label}</Text>
                    </View>
                  </View>
                  <View style={styles.episodeList}>
                    {group.episodes.map((episode) => (
                      <UpcomingEpisodeCard key={`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`} episode={episode} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  listRows: {
    gap: spacing.sm,
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
  groupList: {
    gap: spacing.lg,
  },
  dayPillWrapper: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dayPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  dayPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.muted,
  },
  episodeList: {
    gap: spacing.sm,
  },
});
