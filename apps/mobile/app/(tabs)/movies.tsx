import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { todayLocalKey } from "@/lib/localDate";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { PageError } from "@/components/media/PageError";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
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
  const { viewMode, setViewMode } = useViewModePreference("movies-library");
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

  function handlePressItem(item: LibraryItem) {
    router.push(`/movies/${item.id}`);
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
            <Text variant="subtitle">{t("moviesHome.watchlist")}</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          ) : isLoading ? (
            viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />
          ) : wantToWatch.length === 0 ? (
            <>
              <EmptyShelf message={t("moviesHome.emptyWatchlist")} actionLabel={t("moviesHome.exploreMovies")} actionHref="/(tabs)/explore" />
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
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">{t("seriesHome.tab.upcoming")}</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
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
  // Mesma margem negativa de `series/index.tsx` (ver comentário lá) —
  // `DiscoverCarousel` já tem seu próprio `paddingHorizontal`, e esta
  // tela já envolve tudo num `ScrollView` com `styles.content` pado.
  // CORREÇÃO (2026-09-03) — `marginHorizontal` era `-spacing.lg` pra
  // cancelar exatamente o `paddingHorizontal` do `content` (acima);
  // como o `content` virou `spacing.md`, esta margem precisa
  // acompanhar — senão o carrossel ficaria com 8px de respiro extra
  // (ou faltando) na borda em relação ao resto da tela.
  popularSection: {
    marginTop: spacing.lg,
    marginHorizontal: -spacing.md,
  },
  flameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
