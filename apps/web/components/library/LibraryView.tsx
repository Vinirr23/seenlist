"use client";

import { useMemo, useState } from "react";
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

export function LibraryView() {
  const [tab, setTab] = useState<LibraryStatus>("watching");
  const [typeFilter, setTypeFilter] = useState<LibraryTypeFilter>("all");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const { t, locale } = useTranslation();

  useLibraryRealtimeSync();
  const { data: items, isLoading, isError } = useLibraryItems();

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
        <EmptyLibrary message={t("library.emptyThisList")} />
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
