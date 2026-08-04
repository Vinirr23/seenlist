"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Clapperboard, Plus } from "lucide-react";
import { fetchDisplaySummaries } from "@/lib/queries/library-state";
import type { MediaSummary } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";

const PAGE_SIZE = 20;
/** Mesma janela do cache de resumo TMDB usado no resto do app (fetch do Next em library-state.ts). */
const SUMMARY_STALE_TIME = 5 * 60 * 1000;

/**
 * TASK-177 — carrossel horizontal com prévia real dos pôsteres (em
 * vez de só uma linha "Séries  427 >"). Recebe a lista de IDs já
 * ordenada por atividade (`profile-media-carousel.ts`) e busca
 * resumo (pôster/título) só de quem está visível, em lotes de 20 —
 * carrega mais conforme rola pro fim, em vez de buscar tudo de uma
 * vez (com 427/994 itens, travaria a tela à toa).
 *
 * CORREÇÃO (achado de performance real — "Perfil lento") — antes,
 * cada lote era buscado com `useEffect` + estado local do próprio
 * componente: saía do Perfil e voltava, e os 4 carrosséis esqueciam
 * tudo, buscando os mesmos pôsteres de novo do zero. Agora cada lote
 * é uma consulta de verdade (`useQueries`, React Query) com chave
 * estável (`mediaType` + os ids exatos daquele lote) — voltar pro
 * Perfil pouco depois reaproveita o cache, sem round-trip novo.
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
  const [visibleCount, setVisibleCount] = useState(() => Math.min(PAGE_SIZE, ids.length));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reseta a "janela visível" quando a lista de ids muda de verdade
  // (ex.: resolveu de [] pro valor real, ou a atividade recente
  // mudou a ordem) — só o tamanho da janela, não o cache de resumos
  // (esse já cuida de si mesmo via React Query).
  useEffect(() => {
    setVisibleCount(Math.min(PAGE_SIZE, ids.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const chunks = useMemo(() => {
    const pageCount = Math.ceil(visibleCount / PAGE_SIZE);
    return Array.from({ length: pageCount }, (_, i) => ids.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)).filter(
      (chunk) => chunk.length > 0
    );
  }, [ids, visibleCount]);

  const chunkResults = useQueries({
    queries: chunks.map((chunkIds) => ({
      queryKey: ["profile-media-summaries", mediaType, chunkIds.join(",")],
      queryFn: () => fetchDisplaySummaries(mediaType === "movie" ? chunkIds : [], mediaType === "series" ? chunkIds : []),
      staleTime: SUMMARY_STALE_TIME,
    })),
  });

  const summaryMap = useMemo(() => {
    const map: Record<number, MediaSummary> = {};
    for (const result of chunkResults) {
      if (!result.data) continue;
      Object.assign(map, mediaType === "movie" ? result.data.movies : result.data.series);
    }
    return map;
  }, [chunkResults, mediaType]);

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
