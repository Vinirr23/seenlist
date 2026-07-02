"use client";

import { useSearchMedia } from "@/lib/queries/search";
import { MediaCard } from "./MediaCard";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";

export function SearchResults({ query }: { query: string }) {
  const { data, isLoading, isError } = useSearchMedia(query);

  if (!query.trim()) {
    return <EmptyState message="Pesquise um filme ou série" />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return <EmptyState message="Não foi possível buscar agora. Tente de novo em instantes." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState message="Nenhum resultado encontrado" />;
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <MediaCard key={`${item.mediaType}-${item.id}`} item={item} />
      ))}
    </div>
  );
}
