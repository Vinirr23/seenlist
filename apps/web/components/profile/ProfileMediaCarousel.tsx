"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Clapperboard, Plus } from "lucide-react";
import { fetchDisplaySummaries } from "@/lib/queries/library-state";
import type { MediaSummary } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";

const PAGE_SIZE = 20;

/**
 * TASK-177 — carrossel horizontal com prévia real dos pôsteres (em
 * vez de só uma linha "Séries  427 >"). Recebe a lista de IDs já
 * ordenada por atividade (`profile-media-carousel.ts`) e busca
 * resumo (pôster/título) só de quem está visível, em lotes de 20 —
 * carrega mais conforme rola pro fim, em vez de buscar tudo de uma
 * vez (com 427/994 itens, travaria a tela à toa). Cada lote busca só
 * os IDs NOVOS (não refaz busca dos que já carregaram antes).
 */
export function ProfileMediaCarousel({
  icon: Icon,
  label,
  href,
  mediaType,
  ids,
  isLoadingIds,
  emptyLabel,
  emptyHref,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  mediaType: "movie" | "series";
  ids: number[];
  isLoadingIds: boolean;
  emptyLabel?: string;
  emptyHref?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [summaryMap, setSummaryMap] = useState<Record<number, MediaSummary>>({});
  const fetchedUpTo = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchedUpTo.current = 0;
    setSummaryMap({});
    setVisibleCount(Math.min(PAGE_SIZE, ids.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  useEffect(() => {
    if (visibleCount <= fetchedUpTo.current) return;
    const newIds = ids.slice(fetchedUpTo.current, visibleCount);
    fetchedUpTo.current = visibleCount;
    fetchDisplaySummaries(mediaType === "movie" ? newIds : [], mediaType === "series" ? newIds : []).then((result) => {
      const newMap = mediaType === "movie" ? result.movies : result.series;
      setSummaryMap((prev) => ({ ...prev, ...newMap }));
    });
  }, [visibleCount, ids, mediaType]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      const remaining = el.scrollWidth - el.scrollLeft - el.clientWidth;
      if (remaining < 400) setVisibleCount((c) => Math.min(c + PAGE_SIZE, ids.length));
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [ids.length]);

  if (isLoadingIds) {
    return (
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-base font-bold text-text">{label}</h2>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 w-24 shrink-0 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      </section>
    );
  }

  if (ids.length === 0) {
    // "Séries"/"Filmes" vazios: não mostra nada (biblioteca vazia,
    // não é um convite a fazer nada específico). Só favoritos (que
    // passam `emptyLabel`) mostram o card de convite.
    if (!emptyLabel) return null;
    return (
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-2 px-1">
          <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-base font-bold text-text">{label}</h2>
        </div>
        <Link
          href={emptyHref ?? href}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-8 text-center transition-colors hover:border-primary/40"
        >
          <Plus className="h-6 w-6 text-muted" strokeWidth={2} />
          <p className="text-sm font-semibold text-text">{emptyLabel}</p>
        </Link>
      </section>
    );
  }

  const visibleIds = ids.slice(0, visibleCount);

  return (
    <section className="mb-6">
      <Link href={href} className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-base font-bold text-text">{label}</h2>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
      </Link>
      <div ref={scrollRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {visibleIds.map((id) => {
          const summary = summaryMap[id];
          const posterUrl = tmdbImage(summary?.posterPath ?? null, "w185");
          const itemHref = mediaType === "movie" ? `/movies/${id}` : `/series/${id}`;
          return (
            <Link key={id} href={itemHref} className="w-24 shrink-0">
              <div className="relative h-36 w-24 overflow-hidden rounded-lg bg-surface">
                {posterUrl ? (
                  <Image src={posterUrl} alt={summary?.title ?? ""} fill sizes="96px" className="object-cover" />
                ) : summary ? (
                  <div className="flex h-full items-center justify-center">
                    <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                  </div>
                ) : (
                  <div className="h-full w-full animate-pulse bg-surface" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
