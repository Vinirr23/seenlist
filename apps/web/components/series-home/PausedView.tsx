"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { useLibraryItems } from "@/lib/queries/library";
import { ShelfCard } from "./ShelfCard";
import { EmptyShelf } from "./EmptyShelf";

/**
 * TASK-027M — faltava um caminho, a partir da tela principal de
 * Séries, pra ver as "Interrompidas" (status "paused"). A categoria
 * já existia (SERIES_CATEGORIES, Perfil → Séries), e o importador da
 * extensão TV Time Out já grava esse status corretamente (arquivo
 * traz "stopped") — só não tinha tela dedicada aqui. Mesmo padrão de
 * WatchlistView.tsx, trocando o filtro.
 */
export function PausedView() {
  const { data: items, isLoading, isError } = useLibraryItems();

  const paused = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "series" && item.status === "paused"),
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
        <h1 className="text-xl font-bold text-text">Interrompidas</h1>
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
      ) : paused.length === 0 ? (
        <EmptyShelf message="Nenhuma série interrompida por aqui." actionLabel="Explorar séries" actionHref="/explore" />
      ) : (
        <div className="flex flex-wrap gap-3">
          {paused.map((item) => (
            <ShelfCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
