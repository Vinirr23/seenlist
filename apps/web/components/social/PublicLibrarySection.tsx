"use client";

import { useMemo } from "react";
import { usePublicLibraryItems } from "@/lib/queries/public-library";
import { SERIES_CATEGORIES } from "@/lib/series-categories";
import { PosterGrid } from "@/components/profile/PosterGrid";
import { SectionTitle } from "@/components/media/SectionTitle";

/**
 * TASK-028, item 6 — "somente categorias que possuem conteúdo" pras
 * séries (mesma regra já usada no Perfil próprio). Pra filme, só uma
 * categoria ("Assistidos"), bem mais simples que as 3 do Filmes
 * pessoal — é o que o item 6 pede explicitamente pro perfil público.
 *
 * Item 11: este componente só existe (e só busca dado) quando o
 * perfil público realmente renderiza a seção de biblioteca — as
 * informações básicas do cabeçalho (nome, username, bio) vêm de uma
 * query separada e mais leve (`usePublicProfile`), carregada antes.
 */
export function PublicLibrarySection({ userId }: { userId: string }) {
  const { data: items, isLoading, isError } = usePublicLibraryItems(userId);

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const watchedMovies = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "completed"),
    [items]
  );

  const nonEmptySeriesCategories = useMemo(
    () =>
      SERIES_CATEGORIES.map((category) => ({ ...category, items: series.filter(category.filter) })).filter(
        (category) => category.items.length > 0
      ),
    [series]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label="Carregando biblioteca">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-muted">Não foi possível carregar a biblioteca agora.</p>;
  }

  if (nonEmptySeriesCategories.length === 0 && watchedMovies.length === 0) {
    return <p className="text-sm text-muted">Este perfil ainda não tem biblioteca pública ou está vazia.</p>;
  }

  return (
    <div className="space-y-6">
      {nonEmptySeriesCategories.length > 0 && (
        <section>
          <h2 className="mb-4 px-1 text-lg font-bold text-text">Séries</h2>
          <div className="space-y-6">
            {nonEmptySeriesCategories.map((category) => (
              <div key={category.slug}>
                <SectionTitle>{category.label}</SectionTitle>
                <PosterGrid items={category.items} barColorClass={category.barColorClass} interactive={false} />
              </div>
            ))}
          </div>
        </section>
      )}

      {watchedMovies.length > 0 && (
        <section>
          <h2 className="mb-4 px-1 text-lg font-bold text-text">Filmes</h2>
          <SectionTitle>Assistidos</SectionTitle>
          <PosterGrid items={watchedMovies} interactive={false} />
        </section>
      )}
    </div>
  );
}
