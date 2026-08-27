"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import { usePublicProfile } from "@/lib/queries/public-profile";
import { usePublicLibraryItems } from "@/lib/queries/public-library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { SectionPageHeader } from "@/components/profile/SectionPageHeader";
import { PosterGrid } from "@/components/profile/PosterGrid";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { MediaListRow } from "@/components/media/MediaListRow";
import { PageError } from "@/components/media/PageError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * Sub-página "ver mais" de "Filmes" no perfil público
 * (`/u/[username]/movies`) — mesma estrutura de
 * `ProfileMoviesPageView.tsx`/`ProfileMoviesSection.tsx` (Perfil
 * próprio): só filmes "Assistidos" (status `completed`), sem
 * categorias, grade/lista alternável — lendo a biblioteca de OUTRO
 * usuário, `PosterGrid` `interactive={false}` (mesmo critério de
 * `PublicSeriesPageView.tsx`).
 */
export function PublicMoviesPageView({ username }: { username: string }) {
  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    refetch: refetchProfile,
  } = usePublicProfile(username);
  const { data: items, isLoading: isLoadingItems, isError, refetch } = usePublicLibraryItems(profile?.userId ?? null);
  const { viewMode, setViewMode } = useViewModePreference("public-movies");
  const { t } = useTranslation();

  const watchedMovies = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.mediaType === "movie" && item.status === "completed")
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [items]
  );

  if (isLoadingProfile) {
    return (
      <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
        <div className="h-8 w-40 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (isProfileError) {
    return <PageError message={t("social.errorLoadProfile")} onRetry={() => refetchProfile()} />;
  }

  if (!profile) {
    notFound();
  }

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title={t("nav.movies")} backHref={`/u/${username}`} />

      {isLoadingItems ? (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : isError ? (
        <PageError message={t("social.errorLoadPublicLibrary")} onRetry={() => refetch()} />
      ) : watchedMovies.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t("social.emptyPublicLibrary")}</p>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-end">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
          {viewMode === "grid" ? (
            <PosterGrid items={watchedMovies} interactive={false} />
          ) : (
            <div className="space-y-2">
              {watchedMovies.map((item) => (
                <MediaListRow key={item.id} item={item} secondaryText={item.year ? String(item.year) : ""} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
