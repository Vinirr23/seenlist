import { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Screen, Text } from "@/components/ui";
import { SearchBar } from "@/components/explore/SearchBar";
import { SearchResults } from "@/components/explore/SearchResults";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { colors, spacing, radius } from "@/lib/theme";

type ExploreTab = "discover" | "activity";

/**
 * TASK-094 — porta de `ExploreView.tsx` + `ExploreDiscoverTab.tsx`
 * do web. A busca é o essencial (é pra onde os botões "Explorar
 * séries"/"Explorar filmes" espalhados pelo app já apontam desde a
 * fundação); Descobrir traz os mesmos carrosséis de tendências do
 * TMDB que o web mostra.
 *
 * Fora do escopo desta leva, de propósito: a aba "Atividade" (feed
 * de quem você segue) — depende de dados sociais (follows) que fazem
 * mais sentido construir junto com a aba Feed, não separado aqui.
 * "Adicionar à Biblioteca" direto no card também fica pra quando a
 * tela de detalhes existir — colocar a mutação sem essa tela por
 * perto duplicaria lógica sem um lugar certo pra ela morar.
 */
export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("discover");

  const trendingSeries = useDiscoverList("trending_series");
  const trendingMovies = useDiscoverList("trending_movies");
  const upcomingMovies = useDiscoverList("upcoming_movies");
  const onTheAir = useDiscoverList("on_the_air_series");

  return (
    <Screen padded={false}>
      <View style={styles.searchArea}>
        <SearchBar onDebouncedChange={setQuery} />
      </View>

      {query ? (
        <ScrollView contentContainerStyle={styles.content}>
          <SearchResults query={query} />
        </ScrollView>
      ) : (
        <>
          <View style={styles.tabs}>
            <TabButton label="Descobrir" active={tab === "discover"} onPress={() => setTab("discover")} />
            <TabButton label="Atividade" active={tab === "activity"} onPress={() => setTab("activity")} />
          </View>

          {tab === "discover" ? (
            <ScrollView contentContainerStyle={styles.discoverContent}>
              <DiscoverCarousel title="Séries em alta" items={trendingSeries.items} isLoading={trendingSeries.isLoading} />
              <DiscoverCarousel title="Filmes em alta" items={trendingMovies.items} isLoading={trendingMovies.isLoading} />
              <DiscoverCarousel title="Lançamentos recentes" items={upcomingMovies.items} isLoading={upcomingMovies.isLoading} />
              <DiscoverCarousel title="Em breve" items={onTheAir.items} isLoading={onTheAir.isLoading} />
            </ScrollView>
          ) : (
            <View style={styles.emptyActivity}>
              <Text variant="muted" style={styles.emptyActivityText}>
                A atividade de quem você segue vai aparecer aqui. Essa parte ainda não foi construída nativamente.
              </Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text variant="label" style={active ? styles.tabLabelActive : styles.tabLabel}>
        {label}
      </Text>
    </Pressable>
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
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tabButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.background,
  },
  discoverContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
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
