import { useEffect, useState } from "react";
import { View, ScrollView, FlatList, StyleSheet } from "react-native";
import { Screen, GlassTargetProvider, AmbientGlow, type GlowBlob } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { SearchBar } from "@/components/explore/SearchBar";
import { SearchResults } from "@/components/explore/SearchResults";
import { ExploreTabs, type ExploreTab } from "@/components/explore/ExploreTabs";
import { ExploreMoviesTab } from "@/components/explore/ExploreMoviesTab";
import { ExploreSeriesTab } from "@/components/explore/ExploreSeriesTab";
import { ActivityFeedRow } from "@/components/explore/ActivityFeedRow";
import { FeedTabContent } from "@/components/explore/FeedTabContent";
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
  { color: "rgba(27,75,122,0.45)", top: 40, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.4)", top: 280, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.45)", top: 520, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.35)", top: 740, right: -90, size: 224 },
  { color: "rgba(13,59,92,0.24)", top: 950, left: -80, size: 192 },
];

export default function ExploreScreen() {
  const tabBarClearance = useTabBarClearance();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("movies");
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-27, Etapa 3 — bug real reportado:
   * "ao trocar de sub abas dentro de explorar, toda vez recarrega") —
   * antes, `{tab === "movies" ? <ExploreMoviesTab /> : <ExploreSeriesTab />}`
   * desmontava um e montava o outro a CADA troca de sub-aba — e os
   * hooks de "Porque você assistiu a X"/"Principais [filmes/séries]
   * para você"/"Seus gêneros favoritos" (`useDiscoverByGenre`/
   * `useDiscoverSimilar`/`useFavoriteGenres`) não têm cache (de
   * propósito — são por PESSOA, ver comentário em
   * `lib/useDiscoverList.ts`, cachear arriscaria mostrar dado
   * desatualizado se a Biblioteca mudar), então cada remonte refazia
   * a busca do zero, com esqueleto visível.
   *
   * Fix: mesmo padrão já usado pelo navegador de abas em si (monta a
   * primeira vez que a sub-aba é visitada, depois MANTÉM montada,
   * só escondendo com `display: "none"` — sem desmontar). Isso resolve
   * pela raiz (a causa real era o remonte desnecessário, não falta de
   * cache) sem contradizer a decisão deliberada de não cachear esses
   * hooks.
   *
   * CORREÇÃO (mesmo dia — reportado depois: "dentro de explorar na sub
   * aba atividade tem o mesmo bug") — a 1ª versão deste fix só cobria
   * Filmes/Séries; a sub-aba Atividade continuava num `tab === "activity"
   * ? <ActivityTabContent /> : <ScrollView>...</ScrollView>` no nível de
   * cima, que desmontava a `ScrollView` (e tudo dentro, inclusive
   * Filmes/Séries já "mantidos") toda vez que se ia pra Atividade e
   * voltava. Unificado: as 3 sub-abas agora são irmãs sempre
   * renderizadas (montam na 1ª visita, sem nunca desmontar de novo),
   * cada uma só escondida com `display: "none"` quando não é a ativa.
   *
   * CORREÇÃO (mesmo dia, 2ª rodada — testado no aparelho: Filmes↔Séries
   * parou de recarregar, mas ir pra Atividade e voltar pra Filmes/Séries
   * ainda recarregava) — o bloco de Atividade só passou a existir
   * DEPOIS da 1ª visita (`subAbasVisitadas.has("activity") && (...)`);
   * sem uma `key` fixa, o React pode reconciliar os irmãos deste
   * fragmento por POSIÇÃO — o bloco de Atividade aparecendo/sumindo do
   * meio da lista de filhos deslocava a posição da `ScrollView` de
   * Filmes/Séries logo abaixo, e o React tratava isso como um elemento
   * novo (desmontando o antigo). `key` fixa em cada bloco ("sub-aba-
   * activity"/"sub-aba-discover"/"sub-aba-movies"/"sub-aba-series")
   * ancora a identidade de cada um, independente de posição.
   */
  const [subAbasVisitadas, setSubAbasVisitadas] = useState<Set<ExploreTab>>(() => new Set([tab]));
  useEffect(() => {
    if (!subAbasVisitadas.has(tab)) {
      setSubAbasVisitadas((prev) => new Set(prev).add(tab));
    }
  }, [tab, subAbasVisitadas]);

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

            {/*
              * A PEDIDO (2026-09-28, "quero religar a aba feed... vai
              * ficar como uma sub aba dentro de explorar") — mesmo
              * padrão de montagem persistente das outras sub-abas
              * (`subAbasVisitadas`, comentário acima): monta na 1ª
              * visita, nunca desmonta de novo, só esconde com
              * `display: "none"`. `FeedTabContent` é o mesmo componente
              * usado pela rota solta `/feed` (ver aquele arquivo) — sem
              * duplicar a lógica de posts/curtida/Realtime.
              */}
            {subAbasVisitadas.has("feed") && (
              <View key="sub-aba-feed" style={[styles.flexFill, tab === "feed" ? undefined : styles.subAbaEscondida]}>
                <FeedTabContent />
              </View>
            )}
            {subAbasVisitadas.has("activity") && (
              <View
                key="sub-aba-activity"
                style={[styles.flexFill, tab === "activity" ? undefined : styles.subAbaEscondida]}
              >
                <ActivityTabContent />
              </View>
            )}
            {(subAbasVisitadas.has("movies") || subAbasVisitadas.has("series")) && (
              <ScrollView
                key="sub-aba-discover"
                style={tab === "activity" ? styles.subAbaEscondida : undefined}
                contentContainerStyle={[styles.discoverContent, { paddingBottom: tabBarClearance }]}
              >
                {subAbasVisitadas.has("movies") && (
                  <View key="sub-aba-movies" style={tab === "movies" ? undefined : styles.subAbaEscondida}>
                    <ExploreMoviesTab />
                  </View>
                )}
                {subAbasVisitadas.has("series") && (
                  <View key="sub-aba-series" style={tab === "series" ? undefined : styles.subAbaEscondida}>
                    <ExploreSeriesTab />
                  </View>
                )}
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
      // FASE 2 (consistência visual sistêmica, 2026-09-26) — era
      // `<Text variant="muted">` solto; `EmptyShelf` já é o padrão
      // único de estado vazio do app. A mensagem já sugere seguir
      // gente — ganhou o `actionLabel` real que faltava, indo direto
      // pra `discover-people` (mesma tela/rótulo do sino de "Descobrir
      // pessoas").
      <View style={styles.emptyActivity}>
        <EmptyShelf
          icon="users"
          message={t("explore.emptyActivityFollowSuggestion")}
          actionLabel={t("social.discoverPeople")}
          actionHref="/discover-people"
        />
      </View>
    );
  }

  return (
    // CORREÇÃO (2026-09-04, "vidro que falta") — a borda de tela e o
    // respiro entre linhas moram aqui agora: cada `ActivityFeedRow`
    // virou um cartão de vidro (antes era linha crua com `border-b`, e
    // era ela mesma quem punha a borda de tela por dentro).
    //
    // CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance —
    // item 6 da Etapa 1B: "Explorar > Atividade → FlatList") — era
    // `ScrollView` + `.map()`, montando de uma vez todo item vindo de
    // `fetchActivityFeed` (até 40 — `.slice(0, 40)` em
    // `lib/activityFeed.ts`; o número exato é 40, não ~60 como estimado
    // na auditoria original). Mesmo padrão já aprovado nesta mesma
    // etapa pro Feed principal (`app/(tabs)/feed.tsx`) e na Etapa 1A
    // pros carrosséis — `FlatList` virtualiza, só monta o que está
    // perto da tela. SEM `getItemLayout`: a altura da linha não é fixa
    // (o texto de `ActivityFeedRow` — nome + ação + título — pode
    // quebrar em mais de uma linha dependendo do conteúdo, sem
    // `numberOfLines`), então declarar uma altura fixa aqui erraria o
    // posicionamento em vez de ajudar. Vidro, layout, ações, navegação
    // e os estados de carregamento/vazio/erro acima continuam
    // exatamente iguais — só a forma de desenhar a lista mudou. Esta
    // aba nunca teve "puxar pra atualizar" (nenhum `RefreshControl`
    // antes da correção) — não é adicionado agora, por não fazer parte
    // do escopo desta etapa.
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.activityList, { paddingBottom: tabBarClearance }]}
      initialNumToRender={8}
      windowSize={7}
      maxToRenderPerBatch={8}
      renderItem={({ item }) => <ActivityFeedRow item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  subAbaEscondida: {
    display: "none",
  },
  glassFill: {
    flex: 1,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  searchArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  tabs: {
    marginBottom: spacing.sm,
  },
  // `discoverContent` de propósito NÃO tem `paddingHorizontal` — o
  // `DiscoverCarousel` usado aqui "cru" fornece sua própria borda de
  // tela internamente (ver `DiscoverCarousel.tsx`, também padronizada
  // pra `spacing.md` nesta mesma correção).
  discoverContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  activityList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  loadingActivity: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  emptyActivity: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
});
