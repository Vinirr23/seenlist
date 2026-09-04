import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DiscoverGridScreen } from "@/components/explore/DiscoverGridScreen";
import { useDiscoverByGenreInfinite } from "@/lib/useDiscoverList";
import type { GenreDiscoverKey } from "@/lib/discover";

/**
 * PORTE DO WEB (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile, não assuma nada") —
 * versão RN de
 * `apps/web/app/(main)/explore/genre/[mediaType]/[genreId]/page.tsx`.
 * Aberta pelos chips de `GenreChips.tsx`. Título vem do próprio
 * `genreMap` da resposta (mesmo raciocínio do web em
 * `GenreAllView.tsx` — não precisa de rota própria pra isso).
 */
export default function ExploreGenreScreen() {
  const { mediaType, genreId } = useLocalSearchParams<{ mediaType: string; genreId: string }>();
  const router = useRouter();

  const isValidMediaType = mediaType === "movie" || mediaType === "series";
  const parsedGenreId = Number(genreId);
  const isValidGenreId = Number.isInteger(parsedGenreId) && parsedGenreId > 0;
  const isValid = isValidMediaType && isValidGenreId;

  // Só os chips que a gente mesmo gera apontam pra cá (mesmo
  // comentário do web) — este ramo é praticamente inalcançável;
  // volta pra trás em vez de mostrar uma grade vazia/quebrada.
  useEffect(() => {
    if (!isValid) router.back();
  }, [isValid, router]);

  const kind: GenreDiscoverKey = mediaType === "series" ? "genre_series" : "genre_movies";
  const { items, genreMap, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useDiscoverByGenreInfinite(
    kind,
    isValid ? parsedGenreId : null
  );

  if (!isValid) return null;

  return (
    <DiscoverGridScreen
      title={genreMap?.[parsedGenreId] ?? "…"}
      items={items}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}
