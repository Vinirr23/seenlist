"use client";

import { useMemo } from "react";
import { Tv, Star, Clapperboard } from "lucide-react";
import { usePublicLibraryItems } from "@/lib/queries/public-library";
import { usePublicFavorites } from "@/lib/queries/favorites";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PageError } from "@/components/media/PageError";
import { PublicMediaCarousel } from "./PublicMediaCarousel";

/**
 * Reorganização (perfil público, a pedido, 2026-08-26 — correção
 * seguinte: "a sequencia de 'séries,séries favoritas,filmes,filmes
 * favoritos' não está igual ao perfil usuário"). Antes, a ordem na
 * tela era Séries favoritas → Filmes favoritos → Séries → Filmes
 * (porque `PublicFavoritesSection` era renderizado ANTES de
 * `PublicLibrarySection` em `PublicProfileView.tsx`) — não batia com
 * a ordem real do Perfil próprio (`ProfileSectionsList.tsx`): Séries
 * → Séries favoritas → Filmes → Filmes favoritos.
 *
 * Este componente junta os dois (busca ambos os hooks — biblioteca e
 * favoritos — aqui dentro) só pra poder intercalar os 4 carrosséis na
 * ordem certa. `PublicFavoritesSection.tsx` e `PublicLibrarySection.tsx`
 * ficam sem uso a partir de agora (não apagados, só não chamados mais
 * por `PublicProfileView.tsx`) — mesmo padrão já usado antes com
 * `FavoriteCard.tsx` quando a 1ª tentativa foi corrigida.
 *
 * `dimHeadingBg` só no primeiro carrossel (Séries) — mesma regra do
 * Perfil próprio, onde só o carrossel mais perto do topo da página
 * (mais perto do brilho mais concentrado) precisa da mancha escura
 * extra atrás do título; os outros 3 já ficam legíveis só com o
 * text-shadow.
 */
export function PublicMediaSectionsList({ userId, username }: { userId: string; username: string }) {
  const { data: libraryItems, isLoading: isLoadingLibrary, isError: isLibraryError, refetch: refetchLibrary } =
    usePublicLibraryItems(userId);
  const { data: favoriteItems, isLoading: isLoadingFavorites } = usePublicFavorites(userId);
  const { t } = useTranslation();

  const series = useMemo(
    () =>
      (libraryItems ?? [])
        .filter((item) => item.mediaType === "series")
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [libraryItems]
  );
  // TASK-028, item 6 — filme conta só "Assistidos" (status
  // `completed`), decisão deliberada e mais simples que o Filmes
  // pessoal (que tem várias categorias) — ver histórico completo em
  // `PublicLibrarySection.tsx` (agora sem uso, mas com o comentário
  // original preservado ali).
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
    return <PageError message={t("social.errorLoadPublicLibrary")} onRetry={() => refetchLibrary()} />;
  }

  return (
    <div>
      <PublicMediaCarousel
        icon={Tv}
        label={t("nav.series")}
        href={`/u/${username}/series`}
        items={series}
        isLoading={isLoadingLibrary}
        dimHeadingBg
      />
      <PublicMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteSeries")}
        href={`/u/${username}/favorite-series`}
        items={favoriteSeries}
        isLoading={isLoadingFavorites}
      />
      <PublicMediaCarousel
        icon={Clapperboard}
        label={t("nav.movies")}
        href={`/u/${username}/movies`}
        items={watchedMovies}
        isLoading={isLoadingLibrary}
      />
      <PublicMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteMovies")}
        href={`/u/${username}/favorite-movies`}
        items={favoriteMovies}
        isLoading={isLoadingFavorites}
      />
    </div>
  );
}
