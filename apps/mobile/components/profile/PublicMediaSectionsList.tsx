import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { usePublicLibraryItems, usePublicFavorites } from "@/lib/usePublicProfile";
import { PageError } from "@/components/media/PageError";
import { PublicMediaCarousel } from "./PublicMediaCarousel";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { spacing } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-03, mesma auditoria — ver comentário completo
 * em `PublicMediaCarousel.tsx`) — porta de
 * `apps/web/components/social/PublicMediaSectionsList.tsx`: junta os
 * dois hooks (biblioteca + favoritos) aqui dentro só pra poder
 * intercalar os 4 carrosséis na ordem certa — Séries → Séries
 * favoritas → Filmes → Filmes favoritos, a MESMA ordem do Perfil
 * PRÓPRIO (`ProfileSectionsList`/`(tabs)/profile.tsx`). Antes (mobile)
 * eram 2 componentes separados (`PublicFavoritesSection`, depois
 * `PublicLibrarySection`), dando a ordem errada Séries favoritas →
 * Filmes favoritos → Séries → Filmes — mesmo bug que o web já teve e
 * corrigiu (2026-08-26).
 *
 * `PublicFavoritesSection.tsx`/`PublicLibrarySection.tsx` ficam sem
 * uso a partir de agora (não apagados — mesmo padrão já usado antes
 * com `FavoriteCard.tsx`).
 */
export function PublicMediaSectionsList({ userId, username }: { userId: string; username: string }) {
  const { items: libraryItems, isLoading: isLoadingLibrary, isError: isLibraryError, refetch: refetchLibrary } = usePublicLibraryItems(userId);
  const { items: favoriteItems, isLoading: isLoadingFavorites } = usePublicFavorites(userId);
  const { t } = useTranslation();

  const series = useMemo(
    () =>
      (libraryItems ?? [])
        .filter((item) => item.mediaType === "series")
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [libraryItems]
  );
  // TASK-028, item 6 — filme conta só "Assistidos" (`completed`), mesma decisão do Perfil próprio/web.
  const watchedMovies = useMemo(
    () =>
      (libraryItems ?? [])
        .filter((item) => item.mediaType === "movie" && item.status === "completed")
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [libraryItems]
  );
  const favoriteSeries = useMemo(() => (favoriteItems ?? []).filter((item) => item.mediaType === "series"), [favoriteItems]);
  const favoriteMovies = useMemo(() => (favoriteItems ?? []).filter((item) => item.mediaType === "movie"), [favoriteItems]);

  if (isLibraryError) {
    return <PageError message={t("error.loadLibraryFailed")} onRetry={() => refetchLibrary()} />;
  }

  return (
    <View style={styles.wrapper}>
      <PublicMediaCarousel
        icon="tv"
        label={t("nav.series")}
        href={`/u/${username}/series`}
        items={series}
        isLoading={isLoadingLibrary}
      />
      <PublicMediaCarousel
        icon="star"
        label={t("profile.favoriteSeries")}
        href={`/u/${username}/favorite-series`}
        items={favoriteSeries}
        isLoading={isLoadingFavorites}
      />
      <PublicMediaCarousel
        icon="film"
        label={t("nav.movies")}
        href={`/u/${username}/movies`}
        items={watchedMovies}
        isLoading={isLoadingLibrary}
      />
      <PublicMediaCarousel
        icon="star"
        label={t("profile.favoriteMovies")}
        href={`/u/${username}/favorite-movies`}
        items={favoriteMovies}
        isLoading={isLoadingFavorites}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.lg,
  },
});
