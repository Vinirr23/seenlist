import { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useUpcomingEpisodes } from "@/lib/useUpcomingEpisodes";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { recalculateUpToDateSeriesCategoriesThrottled, prefetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchNextEpisodesToWatch, type NextEpisodeToWatch } from "@/lib/nextEpisodeToWatch";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { mark } from "@/lib/perfMarks";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { ContinueWatchingListRow } from "@/components/media/ContinueWatchingListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { EmptyShelf } from "@/components/media/EmptyShelf";
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
  mark("series_home_render"); // TEMPORÁRIO — ver lib/perfMarks.ts
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch, refetchSilently } = useLibraryItems();

  // TEMPORÁRIO — ver lib/perfMarks.ts
  useEffect(() => {
    if (!isLoading) mark("series_home_data_loaded");
  }, [isLoading]);
  const upcoming = useUpcomingEpisodes();
  const { viewMode, setViewMode } = useViewModePreference("series-library");
  const { t, locale } = useTranslation();

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
   * Ampliado só pro modo LISTA — é o único que mostra o próximo
   * episódio pendente; sem pendência nenhuma, cai no fallback
   * `MediaListRow` (só progresso, sem quebrar nada). O modo GRADE
   * continua só "watching", igual ao web — incluir "Em dia" ali
   * poluiria a grade com séries sem nada pendente e nenhum
   * indicativo visual disso.
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
  const continueWatchingList = useMemo(() => {
    return recentSeries
      .filter((item) => item.status === "watching" || item.status === "up_to_date")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, CONTINUE_LIMIT);
  }, [recentSeries]);

  const continueWatchingGrid = useMemo(() => {
    return recentSeries
      .filter((item) => item.status === "watching")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, CONTINUE_LIMIT);
  }, [recentSeries]);

  const continueWatching = viewMode === "grid" ? continueWatchingGrid : continueWatchingList;

  /**
   * TASK-145 (a pedido) — só busca o "próximo episódio pendente" de
   * cada série quando o modo é LISTA (é onde esse card aparece) — no
   * modo grade, ninguém vê essa informação, buscar seria trabalho à
   * toa.
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
   */
  const listNeedingEpisodes = useMemo(
    () => (viewMode === "list" ? [...continueWatching, ...staleSeries] : []),
    [viewMode, continueWatching, staleSeries]
  );

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
            <EmptyShelf
              message={t("seriesHome.emptyLibrary")}
              actionLabel={t("seriesHome.exploreSeries")}
              actionHref="/(tabs)/explore"
            />
          ) : viewMode === "grid" ? (
            <PosterGrid items={continueWatching} onPressItem={handlePressItem} />
          ) : !nextEpisodesLoaded ? (
            <LibraryListSkeleton />
          ) : (
            <View style={styles.listRows}>
              {continueWatching.map((item) => {
                const nextEpisode = nextEpisodes.get(item.id);
                /**
                 * CORREÇÃO (bug real, reportado com print — "série já
                 * em dia ainda na Home", card com formato errado) —
                 * `nextEpisode` vem `undefined` tanto pra "ainda
                 * buscando" (tratado acima, via `nextEpisodesLoaded`)
                 * quanto pra "já buscou e essa série genuinamente não
                 * tem episódio pendente com data já passada" — ou
                 * seja, ela está em dia hoje, só o status no banco
                 * ainda não foi recalculado (o recálculo agora roda
                 * só 1x/dia). Antes, esse segundo caso caía pro card
                 * antigo (`MediaListRow`, sem código de episódio nem
                 * botão de check) — inconsistente e confuso. Mesma
                 * decisão já tomada no web (`ContinueWatchingCard.tsx`:
                 * `if (!episodes || !next) return null;`) — se não
                 * tem nada pendente pra assistir agora, o card
                 * simplesmente não aparece, em vez de aparecer errado.
                 */
                if (!nextEpisode) return null;
                return (
                  <ContinueWatchingListRow
                    key={item.id}
                    item={item}
                    nextEpisode={nextEpisode}
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
                    const nextEpisode = nextEpisodes.get(item.id);
                    // Mesma regra do "Continue assistindo": sem
                    // episódio pendente de verdade, não mostra card
                    // (evita card meia-boca, sem código nem selo).
                    if (!nextEpisode) return null;
                    return (
                      <ContinueWatchingListRow
                        key={item.id}
                        item={item}
                        nextEpisode={nextEpisode}
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
            <View style={styles.groupList}>
              {upcoming.groups.map((group) => (
                <View key={group.dateKey}>
                  <View style={styles.dayPillWrapper}>
                    <View style={styles.dayPill}>
                      <Text style={styles.dayPillText}>{translateDayLabel(group.label, t)}</Text>
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
  staleSection: {
    marginTop: spacing.xl,
  },
  staleTitle: {
    marginBottom: spacing.sm,
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
