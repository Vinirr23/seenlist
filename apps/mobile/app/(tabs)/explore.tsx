import { useState, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Screen, Text, SlidingTabs } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { SearchBar } from "@/components/explore/SearchBar";
import { SearchResults } from "@/components/explore/SearchResults";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { ActivityFeedRow } from "@/components/explore/ActivityFeedRow";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { useActivityFeed } from "@/lib/useActivityFeed";
import { spacing } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type ExploreTab = "discover" | "activity";

/**
 * TASK-094 — porta de `ExploreView.tsx` + `ExploreDiscoverTab.tsx`
 * do web. A busca é o essencial (é pra onde os botões "Explorar
 * séries"/"Explorar filmes" espalhados pelo app já apontam desde a
 * fundação); Descobrir traz os mesmos carrosséis de tendências do
 * TMDB que o web mostra ("Adicionar à Biblioteca" direto no card já
 * existe, `DiscoverCarousel.tsx`/`AddToLibraryButton.tsx`, TASK-152).
 */
export default function ExploreScreen() {
  const tabBarClearance = useTabBarClearance();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("discover");
  const { t } = useTranslation();

  const trendingSeries = useDiscoverList("trending_series");
  const trendingMovies = useDiscoverList("trending_movies");
  const upcomingMovies = useDiscoverList("upcoming_movies");
  const onTheAir = useDiscoverList("on_the_air_series");
  // A PEDIDO (adicionar seção que faltava, comparado ao web) —
  // "Continuar explorando", mistura 6 séries + 6 filmes populares.
  // A filtragem de item já-na-biblioteca já acontece dentro do
  // próprio `DiscoverCarousel` (diferente do web, que filtra aqui
  // fora) — não precisa repetir isso aqui.
  const popularSeries = useDiscoverList("popular_series");
  const popularMovies = useDiscoverList("popular_movies");
  const continuing = useMemo(
    () => [...popularSeries.items.slice(0, 6), ...popularMovies.items.slice(0, 6)],
    [popularSeries.items, popularMovies.items]
  );

  return (
    <Screen padded={false}>
      <View style={styles.searchArea}>
        <SearchBar onDebouncedChange={setQuery} />
      </View>

      {query ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
          <SearchResults query={query} />
        </ScrollView>
      ) : (
        <>
          {/*
            * A PEDIDO — cópia local de "trilha de 2 abas" migrada pro
            * componente compartilhado (`SlidingTabs`, achado depois de
            * corrigir a mesma coisa em `HomeTabs.tsx` e só então notar
            * que existia uma segunda cópia aqui).
            */}
          <View style={styles.tabs}>
            <SlidingTabs
              active={tab}
              onChange={setTab}
              options={[
                { value: "discover", label: t("explore.tab.discover") },
                { value: "activity", label: t("explore.tab.activity") },
              ]}
            />
          </View>

          {tab === "discover" ? (
            <ScrollView contentContainerStyle={[styles.discoverContent, { paddingBottom: tabBarClearance }]}>
              <DiscoverCarousel title={t("explore.discover.trendingSeries")} items={trendingSeries.items} isLoading={trendingSeries.isLoading} />
              <DiscoverCarousel title={t("explore.discover.trendingMovies")} items={trendingMovies.items} isLoading={trendingMovies.isLoading} />
              <DiscoverCarousel title={t("explore.discover.upcomingMovies")} items={upcomingMovies.items} isLoading={upcomingMovies.isLoading} />
              <DiscoverCarousel title={t("explore.discover.onTheAir")} items={onTheAir.items} isLoading={onTheAir.isLoading} />
              <DiscoverCarousel
                title={t("explore.discover.keepExploring")}
                items={continuing}
                isLoading={popularSeries.isLoading || popularMovies.isLoading}
              />
            </ScrollView>
          ) : (
            <ActivityTabContent />
          )}
        </>
      )}
    </Screen>
  );
}

function ActivityTabContent() {
  const tabBarClearance = useTabBarClearance();
  const { items, isLoading, isError, refetch } = useActivityFeed();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <View style={styles.loadingActivity}>
        <PostCardSkeleton />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.emptyActivity}>
        <PageError message={t("explore.errorLoadActivity")} onRetry={() => refetch()} />
      </View>
    );
  }
  if (!items || items.length === 0) {
    return (
      <View style={styles.emptyActivity}>
        <Text variant="muted" style={styles.emptyActivityText}>
          {t("explore.emptyActivityFollowSuggestion")}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: tabBarClearance }}>
      {items.map((item) => (
        <ActivityFeedRow key={item.id} item={item} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  tabs: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  discoverContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  loadingActivity: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  emptyActivity: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyActivityText: {
    textAlign: "center",
  },
});
