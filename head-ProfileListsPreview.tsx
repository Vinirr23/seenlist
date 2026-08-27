"use client";

import Link from "next/link";
import Image from "next/image";
import { ListChecks, Plus } from "lucide-react";
import { useMyListsWithPreview } from "@/lib/queries/lists";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-178 ÔÇö "Minhas listas" ganha o efeito "baralho" (p├┤steres
 * empilhados/levemente rotacionados) das refer├¬ncias trazidas antes
 * ÔÇö cada lista vira um cart├úo com os p├┤steres dela por tr├ís do nome,
 * numa fileira horizontal (uma lista do lado da outra). Vazio segue
 * o mesmo padr├úo dos favoritos: convite pra criar a primeira.
 */
export function ProfileListsPreview() {
  const { data: lists, isLoading } = useMyListsWithPreview();
  const { t } = useTranslation();

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2 px-1">
        <ListChecks className="h-4 w-4 text-primary" strokeWidth={2} />
        <h2 className="text-base font-bold text-text">{t("profile.section.lists")}</h2>
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
          <p className="text-sm font-semibold text-text">{t("profile.createFirstList")}</p>
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
                    // TASK-178 ÔÇö index 0 ├® o item mais recente (a
                    // consulta j├í vem ordenada assim) ÔÇö fica na
                    // frente (maior z-index, sem rota├º├úo); os de
                    // tr├ís (mais antigos) ficam levemente girados,
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
                {list.itemCount} {list.itemCount === 1 ? t("profile.item") : t("profile.items")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
