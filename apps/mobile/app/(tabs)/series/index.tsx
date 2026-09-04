import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useUpcomingEpisodes } from "@/lib/useUpcomingEpisodes";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { recalculateUpToDateSeriesCategoriesThrottled, prefetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchNextEpisodesToWatch, type NextEpisodeToWatch } from "@/lib/nextEpisodeToWatch";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { ContinueWatchingListRow } from "@/components/media/ContinueWatchingListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { PageError } from "@/components/media/PageError";
import { UpcomingEpisodeCard } from "@/components/media/UpcomingEpisodeCard";
import { UpcomingEpisodeCardSkeleton } from "@/components/media/UpcomingEpisodeCardSkeleton";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { translateDayLabel } from "@/lib/i18n/dayLabels";
import { colors, spacing, radius } from "@/lib/theme";

const CONTINUE_LIMIT = 8;

/**
 * A PEDIDO — seção "Faz um tempo que você não assiste". Série que
 * está em "Assistindo" mas sem NENHUM episódio marcado há 2 semanas
 * desce automaticamente de "Continue assistindo" pra essa seção
 * separada, mais abaixo.
 *
 * Usa `lastActivityAt` (não `updatedAt`): esse campo já reflete o
 * episódio mais recente REALMENTE assistido, não só a última vez que
 * o status mudou — é o que faz "faz um tempo que você não assiste"
 * significar o que promete. Sem botão nenhum e sem tela própria (a
 * pedido) — a seção só aparece quando tem algo nela, e some sozinha
 * quando a pessoa volta a assistir.
 */
const STALE_AFTER_DAYS = 14;

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
  const tabBarClearance = useTabBarClearance();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  /**
   * ACHADO DE PERFORMANCE (a pedido — "Séries busca a biblioteca 2x
   * toda abertura", confirmado com `adb logcat` em aparelho real) —
   * `skipInitialLoad`/`skipFocusRefetch` desligam a busca automática
   * própria do hook: o `useFocusEffect` logo abaixo (que já existia,
   * pra recalcular categorias ANTES de rebuscar) passa a ser o ÚNICO
   * disparador de busca desta tela, em vez de competir com uma
   * segunda busca automática do hook rodando por baixo. Ver comentário
   * completo em `lib/useLibraryItems.ts`.
   */
  const { items, isLoading, isError, refreshing, refetch, refetchSilently } = useLibraryItems({
    skipInitialLoad: true,
    skipFocusRefetch: true,
  });

  const upcoming = useUpcomingEpisodes();
  const { viewMode, setViewMode } = useViewModePreference("series-library");
  const { t, locale } = useTranslation();
  /**
   * PORTE DO WEB (2026-09-03, auditoria "implementar tudo que não
   * envolve redesign" — item "empty state") — `MinhaListaSection.tsx`
   * do web mostra a fileira "Populares no SeenList" (`PopularMediaRow`,
   * `trending_series`) embaixo do card vazio quando "Continue
   * assistindo" está zerado. Aqui reaproveita 100% do que já existe
   * (mesmo `DiscoverCarousel`/`useDiscoverList` do Explorar — nenhum
   * componente novo), só sem a ilustração/`EmptyLibraryHero` (isso é
   * visual/redesign, fora do escopo desta leva).
   */
  const trendingSeries = useDiscoverList("trending_series");

  /**
   * TASK-143/151 — toda vez que a aba Séries ganha foco, recalcula
   * sozinho se alguma série "Em dia" ganhou episódio novo desde a
   * última vez (sem precisar marcar nada manualmente) — depois busca
   * a biblioteca de novo, EM SILÊNCIO (`refetchSilently`, não
   * `refetch`) — usar `refetch` aqui ativava sem querer o spinner de
   * "puxar pra atualizar", mesmo sem ninguém ter puxado nada.
   *
   * PERFORMANCE (achado real, mesmo do web — "Home lenta") — usa a
   * versão com limite de 1x/dia (`...Throttled`, ver
   * `lib/seriesDetails.ts`) em vez da função crua: sem isso, essa
   * checagem pesada rodava do zero a CADA foco da aba, não só ao
   * montar.
   */
  useFocusEffect(
    useCallback(() => {
      recalculateUpToDateSeriesCategoriesThrottled()
        .then(() => refetchSilently())
        .catch((error) => console.error("[SeriesHomeScreen] Falha ao recalcular categorias em foco", error));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  /**
   * CORREÇÃO (bug real, reportado — "Tanya the Evil assistindo, mas
   * não aparece na Home") — "Em dia" (`up_to_date`) é um status
   * PRÓPRIO, separado de "watching". Filtrando só "watching" aqui,
   * uma série que passou a "Em dia" (episódios em dia com o que já
   * saiu) sumia de "Continue assistindo" até `recalculateUpToDate-
   * SeriesCategories` (chamado ao focar a aba) promovê-la de volta
   * pra "watching" quando saísse episódio novo — nesse meio tempo,
   * se a série tivesse QUALQUER pendência real (ex.: episódio
   * lançado mas ainda não processado pelo recálculo), ela ficava
   * invisível na Home mesmo aparecendo em "Assistindo" no Perfil
   * (que lista por status puro, sem essa lacuna). Mesma correção já
   * aplicada no web (`MinhaListaSection.tsx`).
   *
   * CORREÇÃO #2 (2026-09-03 — auditoria "implementar tudo que não
   * envolve redesign", achado real: o modo GRADE nunca recebeu esta
   * mesma correção) — até aqui, só o modo LISTA incluía "Em dia" com
   * pendência real; o modo GRADE continuava filtrando só "watching",
   * excluindo TODA série "Em dia" de propósito (mesmo bug que o web
   * já teve e corrigiu — "Bleach aparece na lista e não na grade",
   * ver `ContinueWatchingPosterGrid.tsx`/`UpToDateGate` no web). Como
   * o mobile já busca o "próximo episódio pendente" de cada série
   * pra montar o card completo da lista (`fetchNextEpisodesToWatch`,
   * abaixo), a correção mais simples e sem duplicar a regra é usar
   * ESSE MESMO resultado como o "portão": os dois modos agora
   * compartilham a mesma seleção (`continueWatching`, uma lista só,
   * nunca mais duas calculadas em separado) e a grade só exibe uma
   * série "Em dia" quando ela também aparece no mapa de próximos
   * episódios pendentes — exatamente a mesma checagem que o card da
   * lista já fazia pra decidir se mostra ou não.
   */
  /**
   * A PEDIDO — "Faz um tempo que você não assiste": corte por
   * `lastActivityAt` (episódio realmente assistido), 14 dias. Feito
   * ANTES das listas de "Continue assistindo" porque as duas
   * precisam desse mesmo corte pra não mostrar a mesma série nas
   * duas seções.
   */
  const { recentSeries, staleSeries } = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const allSeries = (items ?? []).filter((item) => item.mediaType === "series");
    const recent: LibraryItem[] = [];
    const stale: LibraryItem[] = [];

    for (const item of allSeries) {
      // Só "watching" pode ficar parada — "Em dia" não tem nada
      // pendente pra assistir, então não faz sentido cobrar.
      const isStale = item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff;
      (isStale ? stale : recent).push(item);
    }

    stale.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return { recentSeries: recent, staleSeries: stale };
  }, [items]);

  /**
   * CORREÇÃO (bug real, reportado com print — Tomb Raider King,
   * "De Caipira a Mestre Espadachim" etc. aparecendo na grade mas
   * sumindo no modo lista) — mesmo bug já corrigido no web antes
   * (comentário lá cita os mesmos exemplos: "Tanya the Evil, Daemons
   * do Reino das Sombras e Rick and Morty"), nunca portado pra essa
   * segunda parte da correção no mobile. O filtro já incluía "Em
   * dia" aqui, mas a ORDENAÇÃO continuava numa camada só (só por
   * `updatedAt`) — uma série "Em dia" mexida recentemente (sem
   * episódio pendente pra assistir agora) competia pelas mesmas 8
   * vagas com uma série "Assistindo" de verdade (que TEM episódio
   * pendente), podendo empurrar essa pra fora do corte. Ordenação em
   * duas camadas, igual ao web: primeiro por status (watching
   * sempre antes de up_to_date), dentro de cada grupo por
   * `updatedAt` — uma série com episódio pendente de verdade nunca
   * mais perde vaga pra uma que talvez nem tenha nada pra mostrar.
   */
  const continueWatching = useMemo(() => {
    return recentSeries
      .filter((item) => item.status === "watching" || item.status === "up_to_date")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, CONTINUE_LIMIT);
  }, [recentSeries]);

  /**
   * TASK-145 — busca o "próximo episódio pendente" de cada série de
   * "Continue assistindo"/"Faz um tempo que você não assiste". Usado
   * pelo modo LISTA pra montar o card completo, e (2026-09-03) também
   * pelo modo GRADE, como "portão" pra decidir se uma série "Em dia"
   * tem pendência real — ver comentário grande acima de
   * `continueWatching`.
   */
  const [nextEpisodes, setNextEpisodes] = useState<Map<number, NextEpisodeToWatch>>(new Map());
  /**
   * TASK-176 (achado real, a pedido — "mostra o cartão antigo por
   * uns segundos, depois troca pro novo") — sem isso, não dava pra
   * distinguir "ainda buscando o próximo episódio" de "buscou e essa
   * série genuinamente não tem nenhum pendente" — os dois casos
   * pareciam a mesma coisa (`nextEpisodes.get(item.id)` undefined),
   * então a lista caía no cartão simples (`MediaListRow`) por engano
   * enquanto os dados certos ainda estavam a caminho, e só trocava
   * pro cartão completo (`ContinueWatchingListRow`) quando a busca
   * terminava — visível como uma "atualização" incômoda.
   */
  const [nextEpisodesLoaded, setNextEpisodesLoaded] = useState(false);

  /**
   * A PEDIDO — a seção "Faz um tempo que você não assiste" usa o
   * MESMO card completo do "Continue assistindo"
   * (`ContinueWatchingListRow`: código do episódio, selo NOVO/MAIS
   * RECENTE, botão de check rápido) — antes usava um card simples
   * só com progresso, visualmente inconsistente com o resto da tela.
   * Por isso a busca de "próximo episódio pendente" precisa cobrir
   * as duas listas, não só a de cima.
   *
   * CORREÇÃO (2026-09-03, ver comentário grande acima de
   * `continueWatching`) — antes só buscava no modo LISTA
   * (`viewMode === "list" ? ... : []`); agora busca SEMPRE, porque o
   * modo GRADE também depende deste mesmo resultado pra decidir se
   * uma série "Em dia" tem pendência real (o "portão").
   */
  const listNeedingEpisodes = useMemo(() => [...continueWatching, ...staleSeries], [continueWatching, staleSeries]);

  const loadNextEpisodes = useCallback(() => {
    if (listNeedingEpisodes.length === 0) return;
    setNextEpisodesLoaded(false);
    fetchNextEpisodesToWatch(listNeedingEpisodes.map((item) => item.id), locale)
      .then((map) => {
        setNextEpisodes(map);
        setNextEpisodesLoaded(true);
      })
      .catch((error) => {
        console.error("[SeriesHomeScreen] Falha ao buscar próximos episódios", error);
        setNextEpisodesLoaded(true); // não trava no esqueleto pra sempre se der erro — cai pro cartão simples
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listNeedingEpisodes.map((i) => i.id).join(","), locale]);

  useEffect(loadNextEpisodes, [loadNextEpisodes]);

  /**
   * A PEDIDO (auditoria — velocidade percebida) — pré-carrega, em
   * silêncio, o detalhe das 2 primeiras séries de "Continue
   * assistindo": são de longe as mais prováveis de serem tocadas, e
   * assim a tela abre sem espera nenhuma. Não é trabalho extra de
   * verdade — é a MESMA busca que aconteceria ao tocar, só
   * antecipada; se falhar, a tela busca normalmente depois.
   */
  useEffect(() => {
    for (const item of continueWatching.slice(0, 2)) {
      prefetchSeriesDetails(String(item.id), locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueWatching.map((i) => i.id).join(",")]);

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
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">{t("seriesHome.continueWatching")}</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          ) : isLoading ? (
            viewMode === "grid" ? (
              <LibraryGridSkeleton />
            ) : (
              <LibraryListSkeleton />
            )
          ) : continueWatching.length === 0 ? (
            <>
              <EmptyShelf
                message={t("seriesHome.emptyLibrary")}
                actionLabel={t("seriesHome.exploreSeries")}
                actionHref="/(tabs)/explore"
              />
              {/*
                * `DiscoverCarousel` já tem seu próprio `paddingHorizontal:
                * spacing.md` interno (mesmo componente usado "cru", sem
                * container extra, no Explorar — ver `explore.tsx`,
                * `discoverContent` não tem padding horizontal nenhum,
                * de propósito). Esta tela, diferente do Explorar, já
                * envolve tudo num `ScrollView` com `styles.content`
                * (`paddingHorizontal: spacing.md`) — sem a margem
                * negativa abaixo, o carrossel ficaria com o dobro de
                * respiro nas bordas, desalinhado do card vazio acima.
                *
                * CORREÇÃO (2026-09-03, decisão do usuário: padronizar
                * borda de tela em 16px app-wide) — os três valores
                * citados acima eram `spacing.lg` (24); atualizados
                * juntos pra `spacing.md` (16), mantendo o alinhamento
                * entre eles.
                */}
              <View style={styles.popularSection}>
                <DiscoverCarousel
                  title={
                    <View style={styles.flameTitleRow}>
                      <Ionicons name="flame" size={16} color={colors.primary} />
                      <Text variant="subtitle" style={{ color: colors.primary }}>
                        {t("seriesHome.popularSeries")}
                      </Text>
                    </View>
                  }
                  items={trendingSeries.items}
                  isLoading={trendingSeries.isLoading}
                  viewAllHref="/explore/all/trending_series"
                />
              </View>
            </>
          ) : viewMode === "grid" ? (
            !nextEpisodesLoaded ? (
              <LibraryGridSkeleton />
            ) : (
              <PosterGrid
                items={continueWatching.filter((item) => item.status === "watching" || nextEpisodes.has(item.id))}
                onPressItem={handlePressItem}
              />
            )
          ) : !nextEpisodesLoaded ? (
            <LibraryListSkeleton />
          ) : (
            <View style={styles.listRows}>
              {continueWatching.map((item) => {
                /**
                 * CORREÇÃO (bug real, reportado com print — "série já
                 * em dia ainda na Home", card com formato errado) —
                 * `nextEpisodes.get(item.id)` vem `undefined` tanto pra
                 * "ainda buscando" (tratado acima, via
                 * `nextEpisodesLoaded`) quanto pra "já buscou e essa
                 * série genuinamente não tem episódio pendente com
                 * data já passada" — ou seja, ela está em dia hoje, só
                 * o status no banco ainda não foi recalculado (o
                 * recálculo agora roda só 1x/dia).
                 *
                 * CORREÇÃO (2026-09-04, achado ao implementar a
                 * animação de "marcar assistido" — ver
                 * ContinueWatchingListRow.tsx) — antes, o `if
                 * (!nextEpisode) return null` ficava AQUI, no pai: assim
                 * que `loadNextEpisodes()` (disparado pelo próprio
                 * toque no ✓) trazia um mapa sem mais entrada pra esta
                 * série, o React desmontava o card NA HORA, cortando a
                 * animação de saída no meio (sem tempo de mostrar a
                 * confirmação nem o card encolhendo). Agora o pai
                 * SEMPRE renderiza `ContinueWatchingListRow` pra toda
                 * série de `continueWatching` (ela só sai desta lista
                 * quando o status muda de verdade, não por causa de um
                 * episódio específico) — é o PRÓPRIO card quem decide
                 * quando não tem mais nada pra mostrar, exatamente
                 * como o web (`ContinueWatchingCard.tsx`: `if
                 * (next.length === 0 && phase === "idle") return
                 * null`), congelando o último episódio mostrado
                 * enquanto a animação de confirmação/saída ainda está
                 * rolando.
                 */
                return (
                  <ContinueWatchingListRow
                    key={item.id}
                    item={item}
                    nextEpisode={nextEpisodes.get(item.id) ?? null}
                    onMarkedWatched={() => {
                      refetchSilently();
                      loadNextEpisodes();
                    }}
                  />
                );
              })}
            </View>
          )}

          {/*
            * A PEDIDO — "Ver todas da lista Assistir depois" removido
            * daqui. A lista continua acessível normalmente (a rota
            * `/(tabs)/series/watchlist` não foi apagada), só não
            * ocupa mais espaço fixo no fim da Home.
            */}

          {staleSeries.length > 0 && (
            <View style={styles.staleSection}>
              <Text variant="subtitle" style={styles.staleTitle}>
                Faz um tempo que você não assiste
              </Text>
              {viewMode === "grid" ? (
                <PosterGrid items={staleSeries} onPressItem={handlePressItem} />
              ) : !nextEpisodesLoaded ? (
                <LibraryListSkeleton />
              ) : (
                <View style={styles.listRows}>
                  {staleSeries.map((item) => {
                    // Mesma regra do "Continue assistindo" acima (ver
                    // comentário grande lá, 2026-09-04) — o próprio
                    // `ContinueWatchingListRow` decide quando não tem
                    // nada pra mostrar, pra não cortar a animação de
                    // saída no meio.
                    return (
                      <ContinueWatchingListRow
                        key={item.id}
                        item={item}
                        nextEpisode={nextEpisodes.get(item.id) ?? null}
                        onMarkedWatched={() => {
                          refetchSilently();
                          loadNextEpisodes();
                        }}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}>
          {upcoming.isLoading ? (
            <UpcomingEpisodeCardSkeleton />
          ) : upcoming.isError ? (
            <PageError message={t("seriesHome.errorLoadUpcoming")} onRetry={() => upcoming.refetch()} />
          ) : upcoming.groups.length === 0 ? (
            <EmptyShelf
              message={t("seriesHome.emptyUpcoming")}
              actionLabel={t("seriesHome.exploreSeries")}
              actionHref="/(tabs)/explore"
            />
          ) : (
            /**
             * CORREÇÃO (bug real, reportado — "'em breve' não está
             * igual a web", 2026-09-04) — faltava a trilha vertical
             * (ponto + linha) conectando os cards do MESMO grupo de
             * data, que `EmBreveSection.tsx` do web tem desde a
             * TASK-063 ("ajuda a ler 'isso é uma sequência de
             * próximos lançamentos', não N caixas soltas"). Estrutura
             * portada 1:1: cada linha é uma `View` `flexDirection:
             * "row"` com uma coluna de trilha (ponto + linha, largura
             * 12) ao lado da coluna de conteúdo (card + um "spacer"
             * quando não é o último do grupo) — o spacer fica DENTRO
             * da coluna de conteúdo (não como margem do lado de fora)
             * pra que a trilha (irmã, que estica pra cobrir a altura
             * do que está do lado dela por padrão do flexbox) cubra
             * esse espaço também e a linha fique contínua, ponto a
             * ponto — mesmo truque do web (ver comentário lá). Ponto
             * do PRIMEIRO episódio de cada grupo é âmbar
             * (`colors.primary`); os demais, cinza claro translúcido.
             */
            <View style={styles.groupList}>
              {upcoming.groups.map((group) => (
                <View key={group.dateKey}>
                  <View style={styles.dayPillWrapper}>
                    <View style={styles.dayPill}>
                      <Text style={styles.dayPillText}>{translateDayLabel(group.label, t)}</Text>
                    </View>
                  </View>
                  <View>
                    {group.episodes.map((episode, index) => {
                      const isFirstInGroup = index === 0;
                      const hasNextInGroup = index < group.episodes.length - 1;
                      return (
                        <View key={`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`} style={styles.timelineRow}>
                          <View style={styles.track}>
                            <View style={[styles.trackDot, isFirstInGroup ? styles.trackDotFirst : styles.trackDotMuted]} />
                            {hasNextInGroup && <View style={styles.trackLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <UpcomingEpisodeCard episode={episode} />
                            {hasNextInGroup && <View style={styles.timelineSpacer} />}
                          </View>
                        </View>
                      );
                    })}
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

const styles = StyleSheet.create({
  tabsRow: {
    paddingTop: spacing.sm,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  content: {
    paddingHorizontal: spacing.md,
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
  // CORREÇÃO (2026-09-03) — `marginHorizontal` era `-spacing.lg` pra
  // cancelar exatamente o `paddingHorizontal` do `content` (acima) —
  // ver comentário no JSX que usa este estilo. Atualizado junto.
  popularSection: {
    marginTop: spacing.lg,
    marginHorizontal: -spacing.md,
  },
  flameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  staleSection: {
    marginTop: spacing.xl,
  },
  staleTitle: {
    marginBottom: spacing.sm,
  },
  groupList: {
    gap: spacing.lg,
  },
  // CORREÇÃO (fontes/espaçamento — mesma auditoria, conferido contra
  // `EmBreveSection.tsx` do web) — `mb-3`=12 (não `spacing.sm`=8),
  // `px-3.5`=14 (não `spacing.md`=16), `text-xs`=12 (não 11).
  dayPillWrapper: {
    alignItems: "center",
    marginBottom: 12,
  },
  dayPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.muted,
  },
  // Trilha (ponto + linha) conectando os cards do mesmo grupo — ver
  // comentário grande acima, no JSX do modo "Em breve".
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  track: {
    width: 12,
    alignItems: "center",
  },
  trackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackDotFirst: {
    backgroundColor: colors.primary,
  },
  trackDotMuted: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  trackLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
  },
  timelineSpacer: {
    height: 10,
  },
});
