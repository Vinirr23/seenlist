import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { Screen, Text, GlassTargetProvider, AmbientGlow, type GlowBlob } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { SearchBar } from "@/components/explore/SearchBar";
import { SearchResults } from "@/components/explore/SearchResults";
import { ExploreTabs, type ExploreTab } from "@/components/explore/ExploreTabs";
import { ExploreMoviesTab } from "@/components/explore/ExploreMoviesTab";
import { ExploreSeriesTab } from "@/components/explore/ExploreSeriesTab";
import { ActivityFeedRow } from "@/components/explore/ActivityFeedRow";
import { useActivityFeed } from "@/lib/useActivityFeed";
import { spacing } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * PORTE DO WEB (2026-09-02 — "vamos implementar as mudanças que
 * foram feitas no web", reformulação completa da Explorar, resposta
 * explícita à pergunta de escopo: "A reformulação completa da
 * Explorar") — substitui a estrutura antiga de 2 abas
 * (Descobrir/Atividade, TASK-094) pela mesma de 3 abas do web
 * (Filmes/Séries/Atividade, `ExploreTabs.tsx`/`ExploreView.tsx` do
 * web, 2026-08-21): cada tipo de mídia ganhou sua própria aba
 * dedicada, com seções personalizadas (Para você/Porque você
 * assistiu/gêneros favoritos) — ver `ExploreMoviesTab.tsx` e
 * `ExploreSeriesTab.tsx` pro conteúdo de cada aba.
 *
 * REMOVIDO — "Continuar explorando" (`keepExploring`, mistura de 6
 * séries + 6 filmes populares): o web não tem mais essa seção desde a
 * reformulação de 2026-08-21 (substituída pelas seções
 * personalizadas); mantê-la aqui destoaria do "web e mobile com o
 * mesmo design", pedido em aberto desta sessão.
 *
 * VIDRO (2026-09-02, achado ao atender "deixe padronizado com web,
 * tudo" — causa raiz encontrada, não só o pedido original) — os cards
 * de `GenreChips`/`ExploreTabs`/`DiscoverCarousel` já usavam `Glass`,
 * mas esta tela nunca tinha um `GlassTargetProvider` (a fonte do blur
 * — ver `components/ui/Glass.tsx`) — sem ele, todo `Glass` cai no
 * fallback "borda simples, sem desfoque" (documentado no próprio
 * componente, "não deveria acontecer, mas não quebra"): ou seja,
 * NENHUM vidro real estava sendo mostrado no Explorar até agora,
 * mesmo já usando o componente certo. Corrigido igual ao Perfil
 * (`profile.tsx`, mesma técnica de fundo estático) — `GlassTargetProvider`
 * embrulha a tela inteira (busca+abas+conteúdo), com as MESMAS 5
 * manchas azuis do `ExploreView.tsx` do web (posição/cor/opacidade
 * portadas 1:1; `left`/`right` do web são % — convertidos pra pixel
 * assumindo ~400px de referência, mesma técnica já usada em
 * `PROFILE_GLOW_BLOBS`).
 */
const EXPLORE_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.45)", top: 40, left: -88, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 280, right: -80, size: 240 },
  { color: "rgba(13,59,92,0.45)", top: 520, left: -72, size: 256 },
  { color: "rgba(42,127,184,0.35)", top: 740, right: -72, size: 224 },
  { color: "rgba(13,59,92,0.24)", top: 950, left: -64, size: 192 },
];

export default function ExploreScreen() {
  const tabBarClearance = useTabBarClearance();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("movies");
  const { t } = useTranslation();

  return (
    <Screen padded={false}>
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={EXPLORE_GLOW_BLOBS} />}>
        <View style={styles.searchArea}>
          <SearchBar onDebouncedChange={setQuery} />
        </View>

        {query ? (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
            <SearchResults query={query} />
          </ScrollView>
        ) : (
          <>
            <View style={styles.tabs}>
              <ExploreTabs active={tab} onChange={setTab} />
            </View>

            {tab === "activity" ? (
              <ActivityTabContent />
            ) : (
              <ScrollView contentContainerStyle={[styles.discoverContent, { paddingBottom: tabBarClearance }]}>
                {tab === "movies" ? <ExploreMoviesTab /> : <ExploreSeriesTab />}
              </ScrollView>
            )}
          </>
        )}
      </GlassTargetProvider>
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
  glassFill: {
    flex: 1,
  },
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
