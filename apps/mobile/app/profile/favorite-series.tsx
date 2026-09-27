import { useMemo } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePublicFavorites } from "@/lib/usePublicProfile";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, ScreenHeader, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { spacing } from "@/lib/theme";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-116 (correção — Perfil) — porta de FavoriteSeriesPageView.tsx, reaproveitando usePublicFavorites (já existia, perfil público) com o próprio userId.
 *
 * CORREÇÃO (bug real, reportado — "desço um pouco e trava", mesma
 * causa de `movies.tsx`/`series.tsx`) — trocado `ScrollView`+`.map()`
 * (desenha tudo de uma vez) por `FlatList` de verdade (virtualizada).
 */
export default function FavoriteSeriesScreen() {
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
  const { session } = useAuth();
  // CORREÇÃO (2026-09-03, causa raiz — ver comentário grande em
  // `usePublicProfile.ts`) — era `session?.user.id ?? ""`, disparava a
  // busca com uuid vazio (erro passageiro) enquanto a sessão ainda
  // carregava. O hook agora aceita `undefined` direto e só busca
  // quando o id chega.
  const { items, isLoading, isError, refetch } = usePublicFavorites(session?.user.id);
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("profile-favorite-series");
  const cardWidth = usePosterCardWidth();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("profile.favoriteSeries")} />

      {/*
        * CORREÇÃO (bug real, reportado — "nenhuma dessas telas tem as
        * manchas azuis de fundo") — esta tela (e as outras 5 subpáginas
        * do Perfil: favorite-movies, movies, series, recommendations,
        * stats) nunca tinha ganhado o `GlassTargetProvider`/`AmbientGlow`
        * que o resto do app usa (`profile.tsx`, `edit-profile.tsx`,
        * `comments.tsx`) — mesma paleta azul `SUBPAGE_GLOW_BLOBS` já
        * usada em `comments.tsx`/`edit-profile.tsx`, por serem o mesmo
        * tipo de tela (subpágina do Perfil, não uma aba principal).
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      <View style={styles.toggleRow}>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </View>

      {!viewModeReady ? (
        // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
        // instante" — ver `useViewModePreference.ts`).
        null
      ) : isLoading ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : isError ? (
        <View style={styles.content}>
          <PageError message={t("error.loadFavoritesFailed")} onRetry={() => refetch()} />
        </View>
      ) : series.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf
            icon="heart"
            message={t("profile.emptyFavoriteSeries")}
            actionLabel={t("seriesHome.exploreSeries")}
            actionHref="/(tabs)/explore"
          />
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
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
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
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  listRows: {
    gap: spacing.sm,
  },
});
