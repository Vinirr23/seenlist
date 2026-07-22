"use client";

import Link from "next/link";
import Image from "next/image";
import { ListChecks, Plus } from "lucide-react";
import { useMyListsWithPreview } from "@/lib/queries/lists";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * TASK-178 — "Minhas listas" ganha o efeito "baralho" (pôsteres
 * empilhados/levemente rotacionados) das referências trazidas antes
 * — cada lista vira um cartão com os pôsteres dela por trás do nome,
 * numa fileira horizontal (uma lista do lado da outra). Vazio segue
 * o mesmo padrão dos favoritos: convite pra criar a primeira.
 */
export function ProfileListsPreview() {
  const { data: lists, isLoading } = useMyListsWithPreview();

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2 px-1">
        <ListChecks className="h-4 w-4 text-primary" strokeWidth={2} />
        <h2 className="text-base font-bold text-text">Minhas listas</h2>
      </div>

      {isLoading ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 w-28 shrink-0 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : !lists || lists.length === 0 ? (
        <Link
          href="/profile/lists"
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-8 text-center transition-colors hover:border-primary/40"
        >
          <Plus className="h-6 w-6 text-muted" strokeWidth={2} />
          <p className="text-sm font-semibold text-text">Criar sua primeira lista</p>
        </Link>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {lists.map((list) => (
            <Link key={list.id} href={`/profile/lists/${list.id}`} className="w-28 shrink-0">
              <div className="relative h-28 w-28">
                {list.previewPosters.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center rounded-lg bg-surface">
                    <ListChecks className="h-6 w-6 text-muted/40" strokeWidth={1.5} />
                  </div>
                ) : (
                  list.previewPosters.slice(0, 4).map((posterPath, index, arr) => {
                    const posterUrl = tmdbImage(posterPath, "w185");
                    // TASK-178 — index 0 é o item mais recente (a
                    // consulta já vem ordenada assim) — fica na
                    // frente (maior z-index, sem rotação); os de
                    // trás (mais antigos) ficam levemente girados,
                    // alternando o lado, tipo um baralho de verdade.
                    const zIndex = arr.length - index;
                    const rotation = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1) * index * 4;
                    const translateY = index === 0 ? 0 : index * -3;
                    return (
                      <div
                        key={index}
                        className="absolute inset-0 overflow-hidden rounded-lg border border-border bg-background shadow-md"
                        style={{ transform: `translateY(${translateY}px) rotate(${rotation}deg)`, zIndex }}
                      >
                        {posterUrl && <Image src={posterUrl} alt="" fill sizes="112px" className="object-cover" />}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="mt-1.5 truncate text-xs font-medium text-text">{list.name}</p>
              <p className="text-[11px] text-muted">
                {list.itemCount} {list.itemCount === 1 ? "item" : "itens"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
