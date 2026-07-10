"use client";

import { useMemo } from "react";
import { usePublicFavorites } from "@/lib/queries/favorites";
import { FavoriteCard } from "./FavoriteCard";
import { SectionTitle } from "@/components/media/SectionTitle";

const SCROLL_ROW_CLASS =
  "-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Item 6 — "Séries favoritas" e "Filmes favoritos", cada um em carrossel horizontal, separado. */
export function PublicFavoritesSection({ userId }: { userId: string }) {
  const { data: items, isLoading } = usePublicFavorites(userId);

  const favoriteSeries = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const favoriteMovies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Carregando favoritos">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-52 w-36 shrink-0 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (favoriteSeries.length === 0 && favoriteMovies.length === 0) return null;

  return (
    <div className="space-y-6">
      {favoriteSeries.length > 0 && (
        <section>
          <SectionTitle>Séries favoritas</SectionTitle>
          <div className={SCROLL_ROW_CLASS}>
            {favoriteSeries.map((item) => (
              <FavoriteCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {favoriteMovies.length > 0 && (
        <section>
          <SectionTitle>Filmes favoritos</SectionTitle>
          <div className={SCROLL_ROW_CLASS}>
            {favoriteMovies.map((item) => (
              <FavoriteCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
