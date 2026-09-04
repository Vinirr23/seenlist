import { useMemo } from "react";
import { View, Pressable, StyleSheet, SectionList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { usePublicProfile, usePublicLibraryItems } from "@/lib/usePublicProfile";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { SERIES_CATEGORIES } from "@/lib/seriesCategories";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
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
 * PORTE DO WEB (2026-09-03, auditoria "implementar tudo que não
 * envolve redesign" — "Perfil público, ordem") — subpágina "ver
 * tudo" de "Séries" no perfil público (`/u/[username]/series`), porta
 * de `PublicSeriesPageView.tsx`. Mesma estrutura de `app/profile/
 * series.tsx` (Perfil PRÓPRIO — categorias com cor própria, grade/
 * lista alternável, `SectionList` virtualizada) — só lendo a
 * biblioteca de OUTRO usuário (`usePublicLibraryItems`, resolvido a
 * partir do `username` da rota via `usePublicProfile`) em vez da
 * própria.
 */
export default function PublicSeriesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { username: rawUsername } = useLocalSearchParams<{ username: string }>();
  const username = String(rawUsername);
  const { profile, isLoading: isLoadingProfile, isError: isProfileError, refetch: refetchProfile } = usePublicProfile(username);
  const { items, isLoading: isLoadingItems, isError, refetch } = usePublicLibraryItems(profile?.userId);
  const { viewMode, setViewMode } = useViewModePreference("public-series");
  const cardWidth = usePosterCardWidth();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const nonEmptyCategories = useMemo(
    () =>
      SERIES_CATEGORIES.map((category) => ({
        ...category,
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

      {isLoadingProfile || isLoadingItems ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : isProfileError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadProfileFailed")} onRetry={() => refetchProfile()} />
        </View>
      ) : isError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadLibraryFailed")} onRetry={() => refetch()} />
        </View>
      ) : nonEmptyCategories.length === 0 ? (
        <View style={styles.content}>
          <Text variant="muted" style={styles.emptyText}>
            {t("profile.publicLibraryEmpty")}
          </Text>
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
                  <MediaListRow key={`${rowItem.mediaType}-${rowItem.id}`} item={rowItem} onPress={handlePress} secondaryText="" />
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  toggleRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
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
  emptyText: {
    fontSize: 13,
  },
});
