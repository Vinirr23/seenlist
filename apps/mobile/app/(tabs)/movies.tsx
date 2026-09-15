import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { todayLocalKey } from "@/lib/localDate";
import { Screen, Text, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { SectionTitle } from "@/components/media/SectionTitle";
import { MediaListRow } from "@/components/media/MediaListRow";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { EmptyLibraryHero } from "@/components/media/EmptyLibraryHero";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { PageError } from "@/components/media/PageError";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { HOME_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, spacing } from "@/lib/theme";

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

function isReleased(releaseDate: string | null | undefined, todayKey: string): boolean {
  if (!releaseDate) return true; // sem data conhecida — trata como já lançado, mesmo padrão de "year: null" já usado no resto do app.
  return releaseDate <= todayKey;
}

function upcomingLabel(releaseDate: string, todayKey: string, t: TFunction, dateFormatter: Intl.DateTimeFormat): string {
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${releaseDate}T00:00:00`);
  const daysUntil = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (daysUntil === 0) return t("moviesHome.releasesToday");
  if (daysUntil === 1) return t("moviesHome.releasesTomorrow");
  if (daysUntil <= 30) return t("moviesHome.releasesInDays", { days: daysUntil });
  return t("moviesHome.releasesOn", { date: dateFormatter.format(target) });
}

/**
 * TASK-099 (correção — pedido do usuário) — tirei a categoria
 * "Assistindo" daqui. Diferente do web (que mantém as 3 categorias
 * lado a lado), a decisão pra este app é que filme não tem estado
 * "assistindo" que faça sentido mostrar como lista — só série tem
 * episódios/progresso pra acompanhar aos poucos. Filme é "quero
 * assistir" ou já foi assistido (o que muda o status pra "completed"
 * automaticamente, some daqui). Também removi o título "Filmes" no
 * topo — a barra de abas embaixo já diz em qual tela você está.
 *
 * TASK-148 (a pedido — diverge do web de propósito) — "Em breve" pro
 * web é um placeholder intencional (não existe conceito recorrente
 * de "próximo lançamento" pra filme, diferente de série). A pedido,
 * construído aqui mesmo assim: filme "Assistir depois" com data de
 * lançamento no futuro sai de "Assistir depois" e vai pra "Em breve"
 * automaticamente — sem precisar de nada manual.
 */
export default function MoviesScreen() {
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("movies-library");
  const { t, locale } = useTranslation();
  /**
   * PORTE DO WEB (2026-09-03, mesma auditoria — `movies-home/
   * MinhaListaSection.tsx`, empty state de "Assistir depois") —
   * mesma receita de `series/index.tsx`: fileira "Populares no
   * SeenList" (`trending_movies`) embaixo do card vazio, reaproveitando
   * `DiscoverCarousel`/`useDiscoverList` já usados no Explorar. Título
   * reaproveita a MESMA chave `seriesHome.popularSeries` — o texto já
   * é genérico de propósito no original (marca do app, não
   * "séries populares"), mesma decisão do web.
   */
  const trendingMovies = useDiscoverList("trending_movies");
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "long", year: "numeric" }),
    [locale]
  );

  const todayKey = useMemo(() => todayLocalKey(), []);

  const allWantToWatch = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "want_to_watch"),
    [items]
  );

  const wantToWatch = useMemo(() => allWantToWatch.filter((item) => isReleased(item.releaseDate, todayKey)), [allWantToWatch, todayKey]);

  const upcoming = useMemo(
    () =>
      allWantToWatch
        .filter((item) => !isReleased(item.releaseDate, todayKey))
        .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "")),
    [allWantToWatch, todayKey]
  );

  /*
   * CORREÇÃO (2026-09-10, mesmo achado do `series/index.tsx` —
   * "continue assistindo/switch de grid e lista aparecendo na
   * emptystate") — no web (`movies-home/MinhaListaSection.tsx`), o
   * cabeçalho (título "Assistir depois" + alternância grade/lista)
   * fica dentro de `{!isEmptyState && (...)}`, some quando a lista
   * está vazia porque o `EmptyLibraryHero` já tem título próprio.
   */
  const isEmptyState = viewModeReady && !isLoading && wantToWatch.length === 0;

  function handlePressItem(item: LibraryItem) {
    router.push(`/movies/${item.id}`);
  }

  return (
    <Screen padded={false}>
      {/*
        PORTE DO WEB (2026-09-09) — esta tela não tinha campo de manchas
        nenhum, e o `SeriesHome.tsx`/`MoviesHome.tsx` do web tem (cinco
        manchas, ver `HOME_GLOW_BLOBS`). Mesmo padrão já usado em
        Explorar/Perfil: o `GlassTargetProvider` envolve a tela inteira
        e é também o alvo de desfoque de qualquer `Glass` que venha a
        existir aqui.
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={HOME_GLOW_BLOBS} />}>
      <View style={styles.tabsRow}>
        <HomeTabs active={tab} onChange={setTab} />
      </View>

      {tab === "minha-lista" ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {!isError && !isEmptyState && (
            <View style={styles.sectionHeader}>
              <SectionTitle>{t("moviesHome.watchlist")}</SectionTitle>
              <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            </View>
          )}

          {isError ? (
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          ) : !viewModeReady ? (
            // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
            // instante" — ver `useViewModePreference.ts`).
            null
          ) : isLoading ? (
            viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />
          ) : wantToWatch.length === 0 ? (
            /*
              PORTE DO WEB (2026-09-10, auditoria — "Assistir depois"
              vazio) — o `EmptyShelf` (card com borda tracejada) saiu
              daqui: o web usa o `EmptyLibraryHero` (ilustração + título
              + subtítulo + botão + divisor "OU"), solto direto em cima
              do fundo, sem card nenhum em volta. Ver o componente novo
              (`EmptyLibraryHero.tsx`) pro porte completo.
            */
            <>
              <EmptyLibraryHero
                title={t("moviesHome.emptyWatchlistTitle")}
                subtitle={t("moviesHome.emptyWatchlistSubtitle")}
                actionLabel={t("moviesHome.exploreMovies")}
                actionHref="/(tabs)/explore"
                dividerLabel={t("seriesHome.or")}
              />
              {/** `mt-2` do web entre o divisor e a fileira "Populares". */}
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
                  items={trendingMovies.items}
                  isLoading={trendingMovies.isLoading}
                  viewAllHref="/explore/all/trending_movies"
                />
              </View>
            </>
          ) : viewMode === "grid" ? (
            <PosterGrid items={wantToWatch} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {wantToWatch.map((item) => (
                <MediaListRow key={item.id} item={item} onPress={handlePressItem} secondaryText={item.year ? String(item.year) : ""} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {/*
            CORREÇÃO (2026-09-10, auditoria web — `EmBreveSection.tsx`)
            — o web NÃO mostra título nenhum nesta aba, só o alternador
            grade/lista alinhado à direita (`mb-2 flex items-center
            justify-end`). Tinha um `SectionTitle` aqui que o web não
            tem.
          */}
          <View style={styles.upcomingHeader}>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          ) : !viewModeReady ? (
            // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
            // instante" — ver `useViewModePreference.ts`).
            null
          ) : isLoading ? (
            viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />
          ) : upcoming.length === 0 ? (
            <EmptyShelf message={t("moviesHome.emptyUpcoming")} />
          ) : viewMode === "grid" ? (
            <PosterGrid items={upcoming} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {upcoming.map((item) => (
                <MediaListRow
                  key={item.id}
                  item={item}
                  onPress={handlePressItem}
                  secondaryText={item.releaseDate ? upcomingLabel(item.releaseDate, todayKey, t, dateFormatter) : ""}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** O provedor precisa ocupar a tela toda pras manchas cobrirem tudo — mesmo estilo de `explore.tsx`/`profile.tsx`. */
  glassFill: {
    flex: 1,
  },
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
  /** `mb-3` = 12 no web (`MinhaListaSection.tsx`); estava `spacing.sm` = 8 (mesma correção já feita em `series/index.tsx`). */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  /** `mb-2 flex items-center justify-end` do `EmBreveSection.tsx` — sem título, só o alternador à direita. */
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: spacing.sm,
  },
  listRows: {
    gap: spacing.sm,
  },
  // Mesma margem negativa de `series/index.tsx` (ver comentário lá) —
  // `DiscoverCarousel` já tem seu próprio `paddingHorizontal`, e esta
  // tela já envolve tudo num `ScrollView` com `styles.content` pado.
  // CORREÇÃO (2026-09-03) — `marginHorizontal` era `-spacing.lg` pra
  // cancelar exatamente o `paddingHorizontal` do `content` (acima);
  // como o `content` virou `spacing.md`, esta margem precisa
  // acompanhar — senão o carrossel ficaria com 8px de respiro extra
  // (ou faltando) na borda em relação ao resto da tela.
  /**
   * CORREÇÃO (2026-09-10, agora que o vazio usa `EmptyLibraryHero`) —
   * `marginTop` era `spacing.lg` (24, distância do CARD antigo do
   * `EmptyShelf`); o web usa `mt-2` (8) entre o divisor "OU" e a
   * fileira "Populares", medido a partir do `EmptyLibraryHero.tsx`.
   */
  popularSection: {
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
  },
  flameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
