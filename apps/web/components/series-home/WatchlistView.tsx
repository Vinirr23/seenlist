"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useLibraryItems } from "@/lib/queries/library";
import { ShelfCard } from "./ShelfCard";
import { EmptyShelf } from "./EmptyShelf";

/**
 * TASK-023 (ajuste), item 3: tela dedicada aberta pelo botão da
 * Home. Mesmo hook de sempre (`useLibraryItems`), mesmo `ShelfCard`
 * já usado em "Continue assistindo" — como os cards têm largura
 * fixa, um `flex flex-wrap` já dá um efeito de grade sem precisar de
 * nenhum componente de card novo.
 */
export function WatchlistView() {
  const { data: items, isLoading, isError } = useLibraryItems();

  const wantToWatch = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "series" && item.status === "want_to_watch"),
    [items]
  );

  return (
    <div className="w-full px-2 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2 px-1">
        <Link
          href="/series"
          aria-label="Voltar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">Assistir depois</h1>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-3" aria-busy="true" aria-label="Carregando">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="w-36 space-y-2 sm:w-40 md:w-44">
              <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-surface" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyShelf message="Não foi possível carregar sua lista agora. Tente de novo em instantes." />
      ) : wantToWatch.length === 0 ? (
        <EmptyShelf message="Sua lista está vazia." actionLabel="Explorar séries" actionHref="/explore" />
      ) : (
        <div className="flex flex-wrap gap-3">
          {wantToWatch.map((item) => (
            <ShelfCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
