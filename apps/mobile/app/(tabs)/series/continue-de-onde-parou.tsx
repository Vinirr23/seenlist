import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { View, FlatList, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { fetchNextEpisodesToWatch, type NextEpisodeToWatch } from "@/lib/nextEpisodeToWatch";
import { Screen, Text, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { ContinueWatchingListRow } from "@/components/media/ContinueWatchingListRow";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { PageError } from "@/components/media/PageError";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, spacing } from "@/lib/theme";

/**
 * ETAPA 1B (2026-09-27, auditoria de performance, item 5 — "Home
 * Séries: staleSeries sem limite") — destino do botão "Ver tudo" da
 * seção "Continue de onde parou" (`seriesHome.continueWhereYouLeftOff`,
 * ver `app/(tabs)/series/index.tsx`, `visibleStaleSeries`). Mesmo
 * padrão de `continue-assistindo.tsx` (a tela irmã desta, botão "Ver
 * tudo" de "Continue assistindo"): MESMA seleção da Home, sem o corte
 * de `CONTINUE_LIMIT`, com `FlatList` (virtualizada) nos dois modos —
 * decisão confirmada com o usuário antes de implementar, já que não
 * existia nenhuma rota equivalente pra esta seção específica.
 *
 * A regra de seleção é a MESMA da Home: série com `status === "watching"`
 * e sem atividade (`lastActivityAt`) há `STALE_AFTER_DAYS` dias ou mais,
 * ordenada da mais parada pra menos.
 */
const STALE_AFTER_DAYS = 14;

export default function ContinueWhereYouLeftOffAllScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { items, isLoading, isError, refreshing, refetch, refetchSilently } = useLibraryItems();
  /*
   * MESMO ESCOPO da Home (`"series-library"`) de propósito — igual a
   * `continue-assistindo.tsx` (ver comentário lá): trocar pra grade
   * aqui mantém a grade na Home e vice-versa.
   */
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("series-library");
  const tabBarClearance = useTabBarClearance();
  const cardWidth = usePosterCardWidth();

  const staleSeries = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    return (items ?? [])
      .filter(
        (item) => item.mediaType === "series" && item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff
      )
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }, [items]);

  const [nextEpisodes, setNextEpisodes] = useState<Map<number, NextEpisodeToWatch>>(new Map());
  const [nextEpisodesLoaded, setNextEpisodesLoaded] = useState(false);

  /* Esqueleto só na PRIMEIRA carga — mesma regra de `continue-assistindo.tsx`/Home. */
  const jaCarregouEpisodiosRef = useRef(false);

  const loadNextEpisodes = useCallback(() => {
    if (staleSeries.length === 0) {
      setNextEpisodesLoaded(true);
      return;
    }
    if (!jaCarregouEpisodiosRef.current) setNextEpisodesLoaded(false);
    fetchNextEpisodesToWatch(
      staleSeries.map((item) => item.id),
      locale
    )
      .then((map) => {
        setNextEpisodes(map);
        jaCarregouEpisodiosRef.current = true;
        setNextEpisodesLoaded(true);
      })
      .catch((error) => {
        console.error("[ContinueWhereYouLeftOffAllScreen] Falha ao buscar próximos episódios", error);
        // Não trava no esqueleto pra sempre se der erro — mesma escolha da Home.
        jaCarregouEpisodiosRef.current = true;
        setNextEpisodesLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleSeries.map((i) => i.id).join(","), locale]);

  useEffect(loadNextEpisodes, [loadNextEpisodes]);

  const [transicoesAtivas, setTransicoesAtivas] = useState(0);
  const handleTransitionActiveChange = useCallback((active: boolean) => {
    setTransicoesAtivas((n) => Math.max(0, n + (active ? 1 : -1)));
  }, []);

  function handlePressItem(item: LibraryItem) {
    router.push(`/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              accessibilityLabel={t("common.back")}
              hitSlop={12}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={20} color={colors.muted} />
            </Pressable>
            <Text variant="subtitle">{t("seriesHome.continueWhereYouLeftOff")}</Text>
          </View>
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </View>

        {isError ? (
          <View style={styles.content}>
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          </View>
        ) : !viewModeReady || isLoading || !nextEpisodesLoaded ? (
          <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
        ) : (
          <FlatList
            key={`stale-${viewMode}`}
            data={staleSeries}
            keyExtractor={(item) => `${item.mediaType}-${item.id}`}
            numColumns={viewMode === "grid" ? 3 : 1}
            columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
            contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
            ListEmptyComponent={<Text variant="muted">{t("seriesHome.emptyCaughtUp")}</Text>}
            renderItem={({ item }) =>
              viewMode === "grid" ? (
                <PosterGridItem item={item} onPress={handlePressItem} cardWidth={cardWidth} />
              ) : (
                <ContinueWatchingListRow
                  item={item}
                  nextEpisode={nextEpisodes.get(item.id) ?? null}
                  layoutActive={transicoesAtivas > 0}
                  onTransitionActiveChange={handleTransitionActiveChange}
                  onMarkedWatched={() => {
                    refetchSilently();
                    loadNextEpisodes();
                  }}
                  /* Igual à Home: só esta seção mostra "há quanto tempo" (ver `staleSince` em `index.tsx`). */
                  staleSince={item.lastActivityAt}
                />
              )
            }
          />
        )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 1,
  },
  backButton: {
    padding: 2,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  /** Espaçamento entre pôsteres de fileiras diferentes no grid — mesmo valor de `continue-assistindo.tsx`/`movies.tsx`. */
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
});
