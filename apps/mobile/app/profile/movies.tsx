import { useMemo } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useLibraryItems } from "@/lib/useLibraryItems";
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
 * TASK-116 (correção — Perfil) — porta de ProfileMoviesSection.tsx: só filmes "Assistido", sem categorias, sem barra de cor.
 *
 * CORREÇÃO (bug real, reportado — "desço um pouco e trava") — antes,
 * `ScrollView` + `.map()` desenhava TODOS os filmes assistidos de uma
 * vez, imagem por imagem, sem nenhuma virtualização — pra biblioteca
 * grande (centenas de filmes), isso trava a rolagem de verdade.
 * Mesma causa raiz e mesma correção já aplicada antes ao
 * `EpisodeCarousel` (`SeasonAccordion.tsx`/`EpisodeCarousel.tsx`):
 * trocado por `FlatList` de verdade, que só desenha o que está
 * visível na tela (mais uma margem pequena), soltando o que sai da
 * tela conforme rola.
 */
export default function ProfileMoviesScreen() {
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
  const { items, isLoading, isError, refetch } = useLibraryItems();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("profile-movies");
  const cardWidth = usePosterCardWidth();

  const watchedMovies = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.mediaType === "movie" && item.status === "completed")
        // CORREÇÃO (bug real, reportado — "ordem diferente do web") —
        // mesma correção de `app/profile/series.tsx`: faltava
        // ordenar por atividade mais recente, igual ao web
        // (`ProfileMoviesSection.tsx`).
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [items]
  );

  function handlePress(item: { mediaType: "movie" | "series"; id: number }) {
    router.push(item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("nav.movies")} />

      {/*
        * CORREÇÃO (bug real, reportado — "nenhuma dessas telas tem as
        * manchas azuis de fundo") — mesma correção de `favorite-series.tsx`
        * (ver comentário lá): `SUBPAGE_GLOW_BLOBS`, já usada em
        * `comments.tsx`/`edit-profile.tsx`.
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
        // CORREÇÃO (auditoria de consistência, 2026-09-25 — "erro de
        // rede escondido atrás de um vazio falso") — faltava este
        // ramo: sem ele, uma falha de busca mostrava "sem filmes
        // assistidos" (parece que a conta está vazia) em vez de um
        // erro de verdade com "tentar de novo". Mesmo padrão já usado
        // em `favorite-movies.tsx`.
        <View style={styles.content}>
          <PageError message={t("error.loadLibraryFailed")} onRetry={() => refetch()} />
        </View>
      ) : watchedMovies.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf message={t("profile.emptyWatchedMovies")} actionLabel={t("nav.explore")} actionHref="/(tabs)/explore" />
        </View>
      ) : viewMode === "grid" ? (
        <FlatList
          key="grid"
          data={watchedMovies}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePress} cardWidth={cardWidth} />}
        />
      ) : (
        <FlatList
          key="list"
          data={watchedMovies}
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
