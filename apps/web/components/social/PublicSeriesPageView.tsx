"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import { usePublicProfile } from "@/lib/queries/public-profile";
import { usePublicLibraryItems } from "@/lib/queries/public-library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { SERIES_CATEGORIES } from "@/lib/series-categories";
import { SectionPageHeader } from "@/components/profile/SectionPageHeader";
import { PosterGrid } from "@/components/profile/PosterGrid";
import { SectionTitle } from "@/components/media/SectionTitle";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { MediaListRow } from "@/components/media/MediaListRow";
import { PageError } from "@/components/media/PageError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { translateCategoryLabel } from "@/lib/i18n/seriesCategoryLabels";

/**
 * Sub-página "ver mais" de "Séries" no perfil público
 * (`/u/[username]/series`) — a pedido, 2026-08-26: "é pra ter
 * carrossel e ter sub páginas, igual ao perfil do usuário". Mesma
 * estrutura de `ProfileSeriesSection.tsx` (Perfil próprio): grade/lista
 * alternável + separado por categoria de status (Assistindo/Assistir
 * depois/Em dia/Assistidas/Interrompidas) — só que lendo a biblioteca
 * de OUTRO usuário (`usePublicLibraryItems`) em vez da própria
 * (`useLibraryItems`), e com `PosterGrid` `interactive={false}` (sem
 * pressionar-e-segurar — não faz sentido abrir um menu que muda
 * status na biblioteca de outra pessoa, mesmo critério já usado em
 * `PublicLibrarySection.tsx`).
 */
export function PublicSeriesPageView({ username }: { username: string }) {
  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
    refetch: refetchProfile,
  } = usePublicProfile(username);
  const { data: items, isLoading: isLoadingItems, isError, refetch } = usePublicLibraryItems(profile?.userId ?? null);
  const { viewMode, setViewMode } = useViewModePreference("public-series");
  const { t } = useTranslation();

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const nonEmptyCategories = useMemo(
    () =>
      SERIES_CATEGORIES.map((category) => ({
        ...category,
        items: series.filter(category.filter).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
      })).filter((category) => category.items.length > 0),
    [series]
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
      <SectionPageHeader title={t("nav.series")} backHref={`/u/${username}`} />

      {isLoadingItems ? (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : isError ? (
        <PageError message={t("social.errorLoadPublicLibrary")} onRetry={() => refetch()} />
      ) : nonEmptyCategories.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t("social.emptyPublicLibrary")}</p>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-end">
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
          <div className="space-y-6">
            {nonEmptyCategories.map((category) => (
              <div key={category.slug}>
                <SectionTitle>{translateCategoryLabel(category.slug, category.label, t)}</SectionTitle>
                {viewMode === "grid" ? (
                  <PosterGrid items={category.items} barColorClass={category.barColorClass} interactive={false} />
                ) : (
                  <div className="space-y-2">
                    {category.items.map((item) => (
                      <MediaListRow key={item.id} item={item} secondaryText="" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
