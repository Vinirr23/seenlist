"use client";

import { useSearchMedia } from "@/lib/queries/search";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { MediaCard } from "./MediaCard";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { EmptyShelf } from "../media/EmptyShelf";

export function SearchResults({ query }: { query: string }) {
  const { data, isLoading, isError } = useSearchMedia(query);
  const { t } = useTranslation();

  if (!query.trim()) {
    return <EmptyShelf message={t("search.promptSearch")} />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return <EmptyShelf message={t("search.errorSearch")} />;
  }

  if (!data || data.length === 0) {
    return <EmptyShelf message={t("search.noResults")} />;
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <MediaCard key={`${item.mediaType}-${item.id}`} item={item} />
      ))}
    </div>
  );
}
