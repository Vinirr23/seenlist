"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { notFound } from "next/navigation";
import { useLibraryItems } from "@/lib/queries/library";
import { getSeriesCategoryBySlug } from "@/lib/series-categories";
import { PosterGrid } from "@/components/profile/PosterGrid";

export function ProfileSeriesCategoryView({ slug }: { slug: string }) {
  const category = getSeriesCategoryBySlug(slug);
  const { data: items, isLoading } = useLibraryItems();

  const series = useMemo(() => {
    if (!category) return [];
    return (items ?? []).filter((item) => item.mediaType === "series").filter(category.filter);
  }, [items, category]);

  if (!category) {
    notFound();
  }

  return (
    <div className="w-full px-2 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2 px-1">
        <Link
          href="/profile"
          aria-label="Voltar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{category.label}</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : series.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma série nesta categoria.</p>
      ) : (
        <PosterGrid items={series} barColorClass={category.barColorClass} />
      )}
    </div>
  );
}
