"use client";

import { useEffect, useMemo, useState } from "react";
import type { LibraryStatus } from "@seenlist/types";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { LibraryTabs } from "./LibraryTabs";
import { LibraryFilters, type LibraryTypeFilter, type LibrarySort } from "./LibraryFilters";
import { LibrarySeriesCard } from "./LibrarySeriesCard";
import { LibraryMovieCard } from "./LibraryMovieCard";
import { EmptyLibrary } from "./EmptyLibrary";
import { LoadingSkeleton } from "../search/LoadingSkeleton";
import { EmptyState } from "../search/EmptyState";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { mark } from "@/lib/perfMarks";

export function LibraryView() {
  const [tab, setTab] = useState<LibraryStatus>("watching");
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const { t, locale } = useTranslation();

  // TEMPORÁRIO — ver lib/perfMarks.ts. Equivalente web do
  // `series_home_render` do mobile — não dá pra marcar direto no
  // corpo do componente como lá, porque esta função TAMBÉM roda no
  // servidor (SSR) antes de hidratar; `mark()` já se protege com o
  // guard de `window`, mas o `useEffect` garante que isto só conta o
  // primeiro paint de verdade no navegador da pessoa.
  useEffect(() => {
    mark("library_view_mounted");
  }, []);

  useLibraryRealtimeSync();
  const { data: items, isLoading, isError } = useLibraryItems();

  // TEMPORÁRIO — ver lib/perfMarks.ts. Equivalente web do
  // `series_home_data_loaded` do mobile.
  useEffect(() => {
    if (!isLoading) mark("library_data_loaded");
  }, [isLoading]);

  const visibleItems = useMemo(() => {
    const filtered = (items ?? [])
      .filter((item) => item.status === tab)
      .filter((item) => typeFilter === "all" || item.mediaType === typeFilter);

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, INTL_LOCALES[locale]);
      if (sort === "added") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return sorted;
  }, [items, tab, typeFilter, sort, locale]);

  return (
    <div className="space-y-4">
      <LibraryTabs active={tab} onChange={setTab} />
      <LibraryFilters
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        sort={sort}
        onSortChange={setSort}
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <EmptyState message={t("seriesHome.errorLoadLibrary")} />
      ) : visibleItems.length === 0 ? (
        <EmptyLibrary message={t("library.emptyThisList")} actionLabel={t("nav.explore")} actionHref="/explore" />
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) =>
            item.mediaType === "series" ? (
              <LibrarySeriesCard key={`series-${item.id}`} item={item} />
            ) : (
              <LibraryMovieCard key={`movie-${item.id}`} item={item} />
            )
          )}
        </div>
      )}
    </div>
  );
}
