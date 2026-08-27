"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clapperboard, Loader2 } from "lucide-react";
import { useDiscoverSimilarInfinite, flattenDiscoverPages, type SimilarDiscoverKey } from "@/lib/queries/discover";
import { useLibraryItems } from "@/lib/queries/library";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { highlightTitle } from "@/lib/i18n/highlightTitle";
import { useInfiniteScrollSentinel } from "@/lib/useInfiniteScrollSentinel";
import { AddToLibraryButton } from "./AddToLibraryButton";

/**
 * Fase D da reformulação da Explorar (2026-08-22) — tela "ver todos"
 * do carrossel "Porque você assistiu a [X]", aberta pela seta no
 * cabeçalho (mesmo padrão de grade 3 colunas de `GenreAllView.tsx`,
 * ver comentário lá pro histórico completo do layout).
 *
 * `anchorTitle` vem pronto da própria URL (`?title=`, ver
 * `app/(main)/explore/similar/[mediaType]/[anchorId]/page.tsx`) — não
 * é recalculado aqui via `useAnchorTitle`. Diferente de `GenreAllView`
 * (onde o nome do gênero vem de `genreMap`, parte da própria resposta
 * da API), este carrossel não tem um "mapa" equivalente pra título —
 * passar pela URL evita qualquer risco de mostrar um título diferente
 * do carrossel que a pessoa realmente clicou, caso a Biblioteca mude
 * (ex. novo episódio marcado) entre um render e outro.
 *
 * CORREÇÃO (a pedido — paginação, 2026-08-22) — trocado
 * `useDiscoverSimilar` por `useDiscoverSimilarInfinite`, mesmo padrão
 * de `DiscoverAllView.tsx`/`GenreAllView.tsx` (ver comentário completo
 * em `discover.ts` sobre a complicação extra desta lista — origem
 * `recommendations`/`similar` precisa ficar fixa entre páginas).
 */
export function SimilarAllView({
  mediaType,
  anchorId,
  anchorTitle,
}: {
  mediaType: "movie" | "series";
  anchorId: number;
  anchorTitle: string | null;
}) {
  const kind: SimilarDiscoverKey = mediaType === "movie" ? "similar_movies" : "similar_series";
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useDiscoverSimilarInfinite(kind, anchorId);
  const { data: libraryItems } = useLibraryItems();
  const { t } = useTranslation();
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage });

  const libraryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of libraryItems ?? []) keys.add(`${item.mediaType}:${item.id}`);
    return keys;
  }, [libraryItems]);
  const items = useMemo(
    () => flattenDiscoverPages(data?.pages).filter((item) => !libraryKeys.has(`${item.mediaType}:${item.id}`)),
    [data, libraryKeys]
  );

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        {/* "Vidro" (mesmo padrão dos ícones de editar/configurações do Perfil, ProfileHeader.tsx) — círculo com borda clara + blur/saturação + brilho num canto, em vez do ícone solto. */}
        <Link
          href="/explore"
          aria-label={t("common.back")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-text backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90"
          style={{
            background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
          }}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
        </Link>
        <h1 className="text-xl font-bold text-text">
          {anchorTitle ? highlightTitle(t("explore.discover.becauseYouWatched"), anchorTitle) : "…"}
        </h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 px-4 pt-4">
            {items.map((item) => {
              const posterUrl = tmdbImage(item.posterPath, "w342");
              const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
              return (
                <Link key={`${item.mediaType}-${item.id}`} href={href} className="block">
                  {/* "Vidro" (mesmo padrão de DiscoverCard.tsx) — borda clara + blur/saturação + gradiente radial translúcido, em vez de `bg-surface` opaco. */}
                  <div
                    className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
                    style={{
                      background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                    }}
                  >
                    {posterUrl ? (
                      <Image src={posterUrl} alt="" fill sizes="120px" loading="lazy" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Clapperboard className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                      </div>
                    )}
                    <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} className="absolute right-1.5 top-1.5" />
                  </div>
                </Link>
              );
            })}
          </div>

          {hasNextPage && (
            <div ref={sentinelRef} className="flex justify-center px-4 pt-4">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-text backdrop-blur-[10px] backdrop-saturate-[160%] transition-colors disabled:opacity-60"
                style={{
                  background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
                }}
              >
                {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                {t("explore.discover.loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
