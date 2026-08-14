import { useMemo } from "react";
import { View, Pressable, StyleSheet, SectionList } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { SERIES_CATEGORIES } from "@/lib/seriesCategories";
import { Screen, Text } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * TASK-116 (correção — Perfil) — porta de `ProfileSeriesPageView.tsx`
 * + `ProfileSeriesSection.tsx`: 5 categorias com cor própria,
 * alternando grade/lista. Diferente da aba Séries (bottom nav), que
 * só mostra "Continue assistindo" + atalhos — esta tela mostra TUDO,
 * categorizado, de uma vez.
 *
 * CORREÇÃO (bug real, reportado — "desço um pouco e trava", mesma
 * causa de `movies.tsx`/`favorite-series.tsx`/`favorite-movies.tsx`)
 * — trocado `ScrollView`+`.map()` por `SectionList` virtualizada (o
 * equivalente do `FlatList` usado nos outros 3, mas com cabeçalho de
 * categoria — `FlatList` sozinha não suporta seção). Modo grade não
 * tem suporte nativo a colunas no `SectionList`, então cada "linha"
 * da lista já vem pré-agrupada em até 3 pôsteres (`chunk`), desenhada
 * lado a lado — a virtualização continua funcionando normalmente,
 * só a UNIDADE que ela desenha por vez é "uma fileira de 3", não "um
 * pôster".
 */
export default function ProfileSeriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { items, isLoading } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("profile-series");
  const cardWidth = usePosterCardWidth();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const nonEmptyCategories = useMemo(
    () =>
      SERIES_CATEGORIES.map((category) => ({
        ...category,
        // CORREÇÃO (bug real, reportado — "ordem diferente do web") —
        // faltava ordenar por atividade mais recente primeiro, igual
        // ao web (`ProfileSeriesSection.tsx`) — antes ficava na
        // ordem crua que `useLibraryItems` devolvia, sem
        // significado nenhum pra quem usa.
        items: series.filter(category.filter).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
      })).filter((c) => c.items.length > 0),
    [series]
  );

  const sections = useMemo(
    () =>
      nonEmptyCategories.map((category) => ({
        slug: category.slug,
        title: t(category.labelKey),
        barColor: category.barColor,
        // Cada "linha" da lista virtualizada já vem pronta como um
        // array — 1 item por linha no modo lista, até 3 no modo
        // grade. Normaliza os dois modos pro MESMO formato de linha
        // (array), senão o TypeScript não aceita o tipo do
        // `SectionList` variar entre os dois modos.
        data: chunk(category.items, viewMode === "grid" ? 3 : 1),
      })),
    [nonEmptyCategories, viewMode, t]
  );

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("nav.series")}</Text>
      </View>

      <View style={styles.toggleRow}>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {isLoading ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : nonEmptyCategories.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf message={t("profile.emptyLibrarySeries")} actionLabel={t("nav.explore")} actionHref="/(tabs)/explore" />
        </View>
      ) : (
        <SectionList
          key={viewMode}
          sections={sections}
          keyExtractor={(row, index) => row.map((i) => i.id).join("-") + index}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text variant="subtitle" style={styles.categoryTitle}>
              {section.title}
            </Text>
          )}
          renderItem={({ item: row, section }) =>
            viewMode === "grid" ? (
              <View style={styles.gridRow}>
                {row.map((posterItem) => (
                  <PosterGridItem
                    key={`${posterItem.mediaType}-${posterItem.id}`}
                    item={posterItem}
                    onPress={handlePress}
                    barColor={section.barColor}
                    cardWidth={cardWidth}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.listRowWrapper}>
                {row.map((rowItem) => (
                  <MediaListRow
                    key={`${rowItem.mediaType}-${rowItem.id}`}
                    item={rowItem}
                    onPress={handlePress}
                    secondaryText={
                      rowItem.progress && rowItem.progress.totalEpisodes > 0
                        ? t("seriesHome.episodeProgress", {
                            watched: rowItem.progress.watchedEpisodes,
                            total: rowItem.progress.totalEpisodes,
                          })
                        : ""
                    }
                  />
                ))}
              </View>
            )
          }
          SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  toggleRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryTitle: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionGap: {
    height: spacing.lg,
  },
  gridRow: {
    flexDirection: "row",
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  listRowWrapper: {
    marginBottom: spacing.sm,
  },
});
