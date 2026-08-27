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
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** Exportado — `ProfileSectionsList.tsx` usa o MESMO valor pra calcular a "página 0" de cada carrossel antes de combinar as 4 buscas numa só (ver `firstPagePending` abaixo). */
export const PROFILE_CAROUSEL_PAGE_SIZE = 20;
/** Mesma janela do cache de resumo TMDB usado no resto do app (fetch do Next em library-state.ts). Exportado pelo mesmo motivo acima. */
export const PROFILE_CAROUSEL_SUMMARY_STALE_TIME = 5 * 60 * 1000;
const PAGE_SIZE = PROFILE_CAROUSEL_PAGE_SIZE;
const SUMMARY_STALE_TIME = PROFILE_CAROUSEL_SUMMARY_STALE_TIME;

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
 *
 * ACHADO DE PERFORMANCE ("Perfil mais lento", 16ª rodada de
 * perf_measurements, 2026-08-20) — os 4 carrosséis desta tela
 * (Séries, Séries favoritas, Filmes, Filmes favoritos) montam ao
 * mesmo tempo e, cada um buscando sua 1ª página por conta própria
 * (chave de cache diferente por carrossel — sem dedupe entre eles),
 * disparavam até 4-5 chamadas simultâneas pra
 * /api/tmdb/library-summaries. O servidor respondia rápido (58-246ms
 * — o fix do pool de conexões da rodada anterior continua valendo),
 * mas o roundtrip total ficava em 1.5-2.5s por disputa de banda no
 * celular — mesmo padrão já visto em /series com 10 páginas
 * simultâneas, só que nunca tinha sido investigado aqui.
 *
 * Correção: `ProfileSectionsList.tsx` agora busca a 1ª página dos 4
 * carrosséis JUNTOS, numa única chamada combinada. Enquanto essa
 * chamada não resolve, a busca própria da 1ª página de CADA
 * carrossel fica desligada (`firstPagePending` abaixo) — assim que a
 * combinada resolve, o resultado já é gravado na MESMA chave de
 * cache que o `useQueries` daqui usa (`queryClient.setQueryData` em
 * `ProfileSectionsList.tsx`), então quando a busca própria liga, ela
 * já encontra o dado pronto e não faz um 2º round-trip. Páginas
 * seguintes (rolar o carrossel) continuam cada uma buscando por si,
 * como antes — só a 1ª página (a que dispara no load da tela) foi
 * consolidada.
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
  firstPagePending = false,
  dimHeadingBg = false,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  mediaType: "movie" | "series";
  ids: number[];
  isLoadingIds: boolean;
  emptyLabel?: string;
  emptyHref?: string;
  /** true enquanto `ProfileSectionsList.tsx` ainda espera a busca combinada da 1ª página — mantém a busca própria da 1ª página deste carrossel desligada até lá (ver comentário acima). */
  firstPagePending?: boolean;
  /** Escurece o fundo bem atrás do título (ver comentário no cabeçalho, estado "carregando") — só o carrossel "Séries" (mais perto do topo) liga isso. */
  dimHeadingBg?: boolean;
}) {
  const { locale } = useTranslation();
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
    queries: chunks.map((chunkIds, index) => ({
      queryKey: ["profile-media-summaries", mediaType, chunkIds.join(","), locale],
      queryFn: () => fetchDisplaySummaries(mediaType === "movie" ? chunkIds : [], mediaType === "series" ? chunkIds : [], locale),
      staleTime: SUMMARY_STALE_TIME,
      // Só a 1ª página (index 0) espera a combinada do pai — páginas
      // seguintes (rolagem) sempre buscam por conta própria.
      enabled: index > 0 || !firstPagePending,
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
      <section className="mb-8">
        <div className="relative mb-3 flex items-center gap-2 px-1">
          {/*
           * Correção (achado real via console — getComputedStyle provou
           * que cor/sombra do texto são IDÊNTICAS em todos os títulos da
           * tela, "Séries" incluso; não era bug de CSS nenhum. O
           * "azulado" que sobrava era o brilho de fundo mais concentrado
           * perto do topo da página vazando por trás — resolvido
           * escurecendo só o fundo aqui, não mexendo mais no texto.
           * `dimHeadingBg` liga isso só neste carrossel (o "Séries" mais
           * perto do topo) — os outros 3 (Séries favoritas/Filmes/Filmes
           * favoritos) já liam certo, não recebem isso. Sem z-index (a
           * mesma armadilha de pintura já resolvida antes nesta tela) —
           * `relative` só pra entrar na mesma fase de pintura do ícone/
           * título seguintes, que ficam por cima por ordem no DOM.
           */}
          {dimHeadingBg && (
            <div
              className="pointer-events-none absolute -inset-x-3 -inset-y-3 rounded-2xl blur-xl"
              style={{ background: "radial-gradient(closest-side, rgba(5,7,12,0.55), transparent 75%)" }}
              aria-hidden="true"
            />
          )}
          <Icon className="relative h-4 w-4 text-primary" strokeWidth={2} />
          {/* Sombra mais forte (mesmo motivo/ajuste de ProfileListsPreview.tsx) — título sentado direto sobre o brilho azul ambiente, sem card de vidro por baixo. */}
          <h2 className="relative text-lg font-extrabold tracking-tight text-text [text-shadow:0_0_2px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.75),0_1px_6px_rgba(0,0,0,0.6)]">{label}</h2>
        </div>
        {/* w-36 (aspect-[2/3]) + gap-2 — mesmo padrão de tamanho/espaçamento da Explorar (a pedido), ver `DiscoverCard.tsx`/`DiscoverCarousel.tsx`. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto overflow-y-hidden px-4 pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-2xl bg-surface" />
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
      <section className="mb-8">
        <div className="relative mb-3 flex items-center gap-2 px-1">
          {/* Mesmo ajuste do estado "carregando" acima — ver comentário lá (dimHeadingBg só liga aqui pro carrossel "Séries"). */}
          {dimHeadingBg && (
            <div
              className="pointer-events-none absolute -inset-x-3 -inset-y-3 rounded-2xl blur-xl"
              style={{ background: "radial-gradient(closest-side, rgba(5,7,12,0.55), transparent 75%)" }}
              aria-hidden="true"
            />
          )}
          <Icon className="relative h-4 w-4 text-primary" strokeWidth={2} />
          {/* Sombra mais forte (mesmo motivo/ajuste de ProfileListsPreview.tsx) — título sentado direto sobre o brilho azul ambiente, sem card de vidro por baixo. */}
          <h2 className="relative text-lg font-extrabold tracking-tight text-text [text-shadow:0_0_2px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.75),0_1px_6px_rgba(0,0,0,0.6)]">{label}</h2>
        </div>
        <Link
          href={emptyHref ?? href}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-8 text-center transition-colors hover:border-primary/40"
        >
          <Plus className="h-6 w-6 text-muted" strokeWidth={2} />
          <p className="text-sm font-semibold text-text">{emptyLabel}</p>
        </Link>
      </section>
    );
  }

  const visibleIds = ids.slice(0, visibleCount);

  return (
    <section className="mb-8">
      <Link href={href} className="mb-3 flex items-center justify-between px-1">
        <span className="relative flex items-center gap-2">
          {/* Mesmo ajuste dos estados "carregando"/"vazio" acima — ver comentário no primeiro (dimHeadingBg só liga aqui pro carrossel "Séries"). */}
          {dimHeadingBg && (
            <div
              className="pointer-events-none absolute -inset-x-3 -inset-y-3 rounded-2xl blur-xl"
              style={{ background: "radial-gradient(closest-side, rgba(5,7,12,0.55), transparent 75%)" }}
              aria-hidden="true"
            />
          )}
          <Icon className="relative h-4 w-4 text-primary" strokeWidth={2} />
          {/* Sombra mais forte (mesmo motivo/ajuste de ProfileListsPreview.tsx) — título sentado direto sobre o brilho azul ambiente, sem card de vidro por baixo. */}
          <h2 className="relative text-lg font-extrabold tracking-tight text-text [text-shadow:0_0_2px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.75),0_1px_6px_rgba(0,0,0,0.6)]">{label}</h2>
        </span>
        {/*
         * CORREÇÃO (a pedido — "remove esse botão, de perfil e deixa só
         * o > igual no explorar") — o botão circular âmbar (gel, mesmo
         * design do "Ver detalhes") foi removido; volta a ser só o
         * ChevronRight solto, agora `text-muted` pra bater exatamente
         * com o cabeçalho dos carrosséis da Explorar
         * (`DiscoverCarousel.tsx`) — mesmo tamanho/peso de traço.
         * `span`, não outro `Link` (a linha inteira já é um Link — não
         * dá pra aninhar <a> dentro de <a>).
         */}
        <span className="shrink-0 text-muted">
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </Link>
      {/* w-36 (aspect-[2/3]) + gap-2 — mesmo padrão de tamanho/espaçamento da Explorar (a pedido — "deixa o tamanho dos cards do perfil, no mesmo padrão de explorar"), ver `DiscoverCard.tsx`/`DiscoverCarousel.tsx`. Era `h-48 w-32` (128x192px) fixo — trocado por `aspect-[2/3] w-36` (144px de largura, mesma proporção 2:3), igual à Explorar. */}
      <div ref={scrollRef} className="-mx-4 flex gap-2 overflow-x-auto overflow-y-hidden px-4 pb-1">
        {visibleIds.map((id) => {
          const summary = summaryMap[id];
          const posterUrl = tmdbImage(summary?.posterPath ?? null, "w185");
          const itemHref = mediaType === "movie" ? `/movies/${id}` : `/series/${id}`;
          return (
            <Link key={id} href={itemHref} className="w-36 shrink-0">
              {/*
               * Correção (a pedido — "apenas em minhas listas, os cards
               * ficaram com efeito de vidro... quero que todas [Séries,
               * Séries favoritas, Filmes, Filmes favoritos] tenham esse
               * efeito") — mesmo vidro do mockup (`.deck`) e o mesmo já
               * aplicado em ProfileListsPreview.tsx: borda clara +
               * blur/saturação + fundo com gradiente radial translúcido,
               * em vez de `border-primary/10 bg-surface` (opaco, sem
               * vidro nenhum). O pôster (quando carrega) cobre a
               * textura por cima; sem pôster, o vidro aparece por trás
               * do ícone-placeholder.
               */}
              <div
                className="relative aspect-[2/3] w-36 overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-black/40 backdrop-blur-[14px] backdrop-saturate-[180%]"
                style={{
                  background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                }}
              >
                {/* Correção (a pedido — "tira os nomes de dentro dos cards") — removido o gradiente + título por cima do pôster, mesmo padrão da Explorar (`DiscoverCard.tsx`), que também não mostra nome nenhum. */}
                {posterUrl ? (
                  <Image src={posterUrl} alt={summary?.title ?? ""} fill sizes="144px" className="object-cover" />
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
