import { useEffect, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { Screen, GlassTargetProvider, AmbientGlow, type GlowBlob } from "@/components/ui";
import { SearchBar } from "@/components/explore/SearchBar";
import { SearchResults } from "@/components/explore/SearchResults";
import { ExploreTabs, type ExploreTab } from "@/components/explore/ExploreTabs";
import { ExploreMoviesTab } from "@/components/explore/ExploreMoviesTab";
import { ExploreSeriesTab } from "@/components/explore/ExploreSeriesTab";
import { spacing } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

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
 *
 * REMOVIDO (a pedido, 2026-10-01 — Activity Cards no Feed, documento
 * de UX "o Feed parece estático") — a 3ª sub-aba, "Atividade"
 * (um componente `ActivityTabContent` que existia aqui nesta tela),
 * saiu inteira: a mesma informação (quem terminou/avaliou/adicionou à
 * watchlist) passou a aparecer direto no Feed, como cards ricos com
 * poster (`components/feed/ActivityCard.tsx`, via `lib/activityFeed.ts`
 * — mesma função de busca, reaproveitada, não duplicada). Decisão
 * explícita: manter as duas telas mostrando a mesma coisa seria
 * duplicação sem ganho nenhum. `ExploreTab` (`ExploreTabs.tsx`) ficou
 * só com "movies"/"series"; `lib/useActivityFeed.ts` e
 * `components/explore/ActivityFeedRow.tsx` ficaram sem uso (não
 * apagados — mesmo critério já usado pra outros arquivos órfãos deste
 * projeto, apagar é decisão à parte).
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
   * SIMPLIFICADO (2026-10-01, Activity Cards no Feed) — a sub-aba
   * "Atividade" que motivou a versão anterior deste comentário (irmãs
   * sempre renderizadas, `key` fixa por posição) saiu da tela (ver
   * comentário grande acima) — com só "movies"/"series" sobrando,
   * `subAbasVisitadas` continua útil (evita re-buscar ao voltar pra
   * uma sub-aba já vista), mas não precisa mais do `View` irmão extra
   * nem da checagem de 3 vias que existia antes.
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
              * REMOVIDO (a pedido, 2026-09-29 — "tirar feed de explorar
              * e colocar na barra de navegação msm") — o Feed tinha
              * virado sub-aba daqui em 2026-09-28; um dia depois, voltou
              * a ser aba própria no dock (ver `ROUTE_ICON`/`ABAS` em
              * `components/layout/DockNavegacao.tsx` e o `Tabs.Screen`
              * em `app/(tabs)/_layout.tsx`). Mantendo o sub-aba aqui
              * também deixaria o mesmo destino acessível por dois
              * caminhos diferentes na navegação — removido pra não
              * duplicar. O componente que servia essa sub-aba
              * (`components/explore/FeedTabContent.tsx`, extraído
              * exatamente pra isso) foi apagado junto — sem uso nenhum
              * depois desta remoção; a aba `/feed` própria usa sua
              * própria implementação, em `app/(tabs)/feed.tsx`.
              */}
            <ScrollView
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
          </>
        )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
