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
 * PORTE DO WEB (2026-09-09) — destino do botão "Ver tudo" de "Continue
 * assistindo" (`ContinueWatchingAllView.tsx` do web,
 * rota `/series/continue-assistindo`).
 *
 * É a MESMA seleção da Home, sem o corte de 8. O comentário do web diz
 * isso com todas as letras: "visual idêntico, só sem o limite". Por
 * isso aqui se repete a regra de seleção da Home em vez de inventar
 * outra — a mesma exclusão de séries "Em dia" sem pendência real, a
 * mesma ordenação (watching antes de up_to_date, depois por
 * `updatedAt`) e o mesmo corte de 14 dias que separa "Faz um tempo que
 * você não assiste".
 *
 * A tela fica DENTRO da aba Séries (como `watchlist.tsx` e
 * `completed.tsx`), então soma `useTabBarClearance()` no
 * `paddingBottom` — a barra é `position: absolute` e cobriria o último
 * card.
 */
const STALE_AFTER_DAYS = 14;

export default function ContinueWatchingAllScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { items, isLoading, isError, refreshing, refetch, refetchSilently } = useLibraryItems();
  /*
   * MESMO ESCOPO da Home (`"series-library"`) de propósito: no web o
   * `viewMode` é o mesmo estado nas duas telas, então trocar pra grade
   * aqui e voltar mantém a grade lá. Escopo próprio faria as duas
   * discordarem.
   */
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("series-library");
  const tabBarClearance = useTabBarClearance();
  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-17, a pedido — "listas grandes tem
   * uma lentidão", confirmado pelo usuário testando no aparelho físico
   * com o blur já desligado — ou seja, a causa aqui é outra, não o
   * blur) — esta tela mostra a MESMA seleção da Home, "sem o corte de
   * 8" (ver comentário no topo do arquivo): pode crescer bastante. Era
   * `ScrollView` + `PosterGrid`/`.map()` (sem limite, desenha tudo de
   * uma vez), igual ao achado já corrigido em `movies.tsx`. Vira
   * `FlatList` nos dois modos.
   *
   * RISCO CONHECIDO, aceito a pedido do usuário — o modo LISTA usa
   * `ContinueWatchingListRow`, que depende de `layout={LinearTransition}`
   * do Reanimated pra animação aprovada de "as linhas de baixo deslizam
   * suavemente pra cima" ao marcar um episódio. Essa técnica tem
   * problemas de compatibilidade já documentados com `FlatList`/
   * `VirtualizedList` (o jeito como a lista posiciona/recicla células
   * pode não deixar a transição de layout do Reanimated rodar direito).
   * PRECISA ser conferida no aparelho físico depois: marcar um episódio
   * no modo lista aqui e ver se a animação de "deslizar pra cima"
   * continua suave. Se quebrar, a correção é reverter só o modo LISTA
   * desta tela específica (o modo grade não usa esse componente, não
   * corre esse risco).
   */
  const cardWidth = usePosterCardWidth();

  const recentSeries = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    return (items ?? []).filter(
      (item) =>
        item.mediaType === "series" &&
        !(item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff)
    );
  }, [items]);

  const continueWatching = useMemo(
    () =>
      recentSeries
        .filter((item) => item.status === "watching" || item.status === "up_to_date")
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        }),
    [recentSeries]
  );

  const [nextEpisodes, setNextEpisodes] = useState<Map<number, NextEpisodeToWatch>>(new Map());
  const [nextEpisodesLoaded, setNextEpisodesLoaded] = useState(false);

  /* Esqueleto só na PRIMEIRA carga — ver o comentário longo na Home; refetch com a lista já na tela é o que deixa a animação aparecer. */
  const jaCarregouEpisodiosRef = useRef(false);

  const loadNextEpisodes = useCallback(() => {
    if (continueWatching.length === 0) {
      setNextEpisodesLoaded(true);
      return;
    }
    if (!jaCarregouEpisodiosRef.current) setNextEpisodesLoaded(false);
    fetchNextEpisodesToWatch(
      continueWatching.map((item) => item.id),
      locale
    )
      .then((map) => {
        setNextEpisodes(map);
        jaCarregouEpisodiosRef.current = true;
        setNextEpisodesLoaded(true);
      })
      .catch((error) => {
        console.error("[ContinueWatchingAllScreen] Falha ao buscar próximos episódios", error);
        // Não trava no esqueleto pra sempre se der erro — mesma escolha da Home.
        jaCarregouEpisodiosRef.current = true;
        setNextEpisodesLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueWatching.map((i) => i.id).join(","), locale]);

  useEffect(loadNextEpisodes, [loadNextEpisodes]);

  /* Mesma regra da Home: série "Em dia" só entra se tiver pendência real. */
  const visibleContinueWatching = useMemo(
    () => continueWatching.filter((item) => item.status === "watching" || nextEpisodes.has(item.id)),
    [continueWatching, nextEpisodes]
  );

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
            <Text variant="subtitle">{t("seriesHome.continueWatching")}</Text>
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
            key={`continue-${viewMode}`}
            data={visibleContinueWatching}
            keyExtractor={(item) => `${item.mediaType}-${item.id}`}
            numColumns={viewMode === "grid" ? 3 : 1}
            columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
            contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
            ListEmptyComponent={<Text variant="muted">{t("seriesHome.emptyCaughtUp")}</Text>}
            renderItem={({ item, index }) =>
              viewMode === "grid" ? (
                <PosterGridItem item={item} onPress={handlePressItem} cardWidth={cardWidth} />
              ) : (
                <ContinueWatchingListRow
                  item={item}
                  /* Igual ao web: aqui a curva do destaque vale pra lista INTEIRA, não só pras 8 da Home. */
                  priorityIndex={index}
                  nextEpisode={nextEpisodes.get(item.id) ?? null}
                  layoutActive={transicoesAtivas > 0}
                  onTransitionActiveChange={handleTransitionActiveChange}
                  onMarkedWatched={() => {
                    refetchSilently();
                    loadNextEpisodes();
                  }}
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
  /** Espaçamento entre pôsteres de fileiras diferentes no grid — mesmo valor de `FilteredSeriesListScreen.tsx`/`movies.tsx`. */
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
});
