import { useMemo } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePublicProfile, usePublicFavorites } from "@/lib/usePublicProfile";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, ScreenHeader } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * PORTE DO WEB (2026-09-03, mesma auditoria — ver comentário completo
 * em `series.tsx` deste mesmo diretório) — subpágina "ver tudo" de
 * "Séries favoritas" no perfil público (`/u/[username]/favorite-series`),
 * porta de `PublicFavoriteSeriesPageView.tsx`/`PublicFavoritesLibraryView.tsx`.
 * Mesma estrutura de `app/profile/favorite-series.tsx` (Perfil
 * PRÓPRIO) — só lendo os favoritos de OUTRO usuário.
 */
export default function PublicFavoriteSeriesScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const { username: rawUsername } = useLocalSearchParams<{ username: string }>();
  const username = String(rawUsername);
  const { profile, isLoading: isLoadingProfile, isError: isProfileError, refetch: refetchProfile } = usePublicProfile(username);
  const { items, isLoading: isLoadingItems, isError, refetch } = usePublicFavorites(profile?.userId);
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("public-favorite-series");
  const cardWidth = usePosterCardWidth();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("profile.favoriteSeries")} />

      <View style={styles.toggleRow}>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {!viewModeReady ? (
        // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
        // instante" — ver `useViewModePreference.ts`).
        null
      ) : isLoadingProfile || isLoadingItems ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : isProfileError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadProfileFailed")} onRetry={() => refetchProfile()} />
        </View>
      ) : isError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadFavoritesFailed")} onRetry={() => refetch()} />
        </View>
      ) : series.length === 0 ? (
        /*
         * CORREÇÃO (FASE 2, consistência visual sistêmica, 2026-09-26
         * — "empty states do perfil público") — mesmo achado dos
         * outros 3 arquivos deste diretório: `<Text variant="muted">`
         * cru em vez do padrão `EmptyShelf` que
         * `app/profile/favorite-series.tsx` (Perfil PRÓPRIO) já usa pro
         * mesmo estado conceitual, com o mesmo `icon="heart"` (mesmo
         * papel: vazio de FAVORITOS). Sem `actionLabel`/`actionHref`
         * pelo mesmo motivo dos outros três: biblioteca de outra
         * pessoa.
         */
        <View style={styles.content}>
          <EmptyShelf icon="heart" message={t("profile.publicLibraryEmpty")} />
        </View>
      ) : viewMode === "grid" ? (
        <FlatList
          key="grid"
          data={series}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePress} cardWidth={cardWidth} />}
        />
      ) : (
        <FlatList
          key="list"
          data={series}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          contentContainerStyle={[styles.content, styles.listRows, { paddingBottom: espacoDoDock }]}
          renderItem={({ item }) => (
            <MediaListRow item={item} onPress={handlePress} secondaryText={item.year ? String(item.year) : ""} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  toggleRow: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  listRows: {
    gap: spacing.sm,
  },
});
