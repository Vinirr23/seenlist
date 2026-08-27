"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Tv, Star, Clapperboard } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useSeriesActivityIds, useMovieActivityIds, useFavoriteIds } from "@/lib/queries/profile-media-carousel";
import { fetchDisplaySummaries } from "@/lib/queries/library-state";
import type { MediaSummary } from "@/lib/tmdb/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import {
  ProfileMediaCarousel,
  PROFILE_CAROUSEL_PAGE_SIZE,
  PROFILE_CAROUSEL_SUMMARY_STALE_TIME,
} from "./ProfileMediaCarousel";
import { ProfileRecommendationsPreview } from "./ProfileRecommendationsPreview";
import { ProfileListsPreview } from "./ProfileListsPreview";

type SummaryBundle = { movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> };

/**
 * Grava, na MESMA chave de cache que `ProfileMediaCarousel.tsx` usa
 * pra sua 1ª página (`["profile-media-summaries", mediaType,
 * chunkIds.join(","), locale]`), o pedaço do resultado combinado que
 * pertence àquele carrossel específico — chamado de DENTRO do
 * `queryFn` da busca combinada abaixo, antes dela devolver, pra
 * garantir que o cache já esteja pronto no instante em que
 * `firstPagePending` vira `false` (ver comentário em
 * `ProfileMediaCarousel.tsx`).
 */
function seedCarouselFirstPage(
  queryClient: QueryClient,
  mediaType: "movie" | "series",
  chunkIds: number[],
  combined: SummaryBundle,
  locale: string
) {
  if (chunkIds.length === 0) return;
  const source = mediaType === "movie" ? combined.movies : combined.series;
  const map: Record<number, MediaSummary> = {};
  for (const id of chunkIds) {
    if (source[id]) map[id] = source[id];
  }
  const data: SummaryBundle = mediaType === "movie" ? { movies: map, series: {} } : { movies: {}, series: map };
  queryClient.setQueryData(["profile-media-summaries", mediaType, chunkIds.join(","), locale], data);
}

/**
 * TASK-177 (redesign, a pedido — referências de outros apps trazidas
 * pelo usuário) — "Séries"/"Filmes"/"Séries favoritas"/"Filmes
 * favoritos" deixaram de ser só uma linha com número: agora mostram
 * um carrossel de pôster de verdade, ordenado por atividade mais
 * recente, com rolagem infinita.
 *
 * TASK-178 — "Recomendações"/"Minhas listas" também ganharam prévia
 * visual de verdade (avatar de quem recomendou + pôster do baralho
 * de cada lista), em vez de só "0 >" — ver `ProfileRecommendationsPreview.tsx`/`ProfileListsPreview.tsx`.
 *
 * ACHADO DE PERFORMANCE ("Perfil mais lento", 16ª rodada de
 * perf_measurements, 2026-08-20) — os 4 `ProfileMediaCarousel` abaixo
 * montam juntos e, antes desta mudança, cada um buscava sua 1ª
 * página de pôster/título por conta própria — até 4-5 chamadas
 * simultâneas pra /api/tmdb/library-summaries disputando banda do
 * celular (roundtrip de 1.5-2.5s mesmo com o servidor respondendo em
 * <250ms; o fix do pool de conexões da rodada anterior continuava
 * funcionando — o servidor nunca foi o problema aqui). `combinedSummaries`
 * abaixo busca a 1ª página dos 4 JUNTOS, numa chamada só; cada
 * carrossel recebe `firstPagePending` e só liga sua própria busca da
 * 1ª página depois que a combinada resolve — e como o resultado já é
 * gravado na chave de cache exata de cada um (`seedCarouselFirstPage`),
 * não duplica o pedido.
 */
export function ProfileSectionsList() {
  const { data: user } = useCurrentUser();
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();

  const seriesIds = useSeriesActivityIds(user?.id ?? null);
  const movieIds = useMovieActivityIds(user?.id ?? null);
  const favoriteSeriesIds = useFavoriteIds(user?.id ?? null, "series");
  const favoriteMovieIds = useFavoriteIds(user?.id ?? null, "movie");

  const allIdsLoaded =
    !seriesIds.isLoading && !movieIds.isLoading && !favoriteSeriesIds.isLoading && !favoriteMovieIds.isLoading;

  const seriesPage0 = useMemo(() => (seriesIds.data ?? []).slice(0, PROFILE_CAROUSEL_PAGE_SIZE), [seriesIds.data]);
  const favSeriesPage0 = useMemo(
    () => (favoriteSeriesIds.data ?? []).slice(0, PROFILE_CAROUSEL_PAGE_SIZE),
    [favoriteSeriesIds.data]
  );
  const moviesPage0 = useMemo(() => (movieIds.data ?? []).slice(0, PROFILE_CAROUSEL_PAGE_SIZE), [movieIds.data]);
  const favMoviesPage0 = useMemo(
    () => (favoriteMovieIds.data ?? []).slice(0, PROFILE_CAROUSEL_PAGE_SIZE),
    [favoriteMovieIds.data]
  );

  const combinedMovieIds = useMemo(
    () => Array.from(new Set([...moviesPage0, ...favMoviesPage0])),
    [moviesPage0, favMoviesPage0]
  );
  const combinedSeriesIds = useMemo(
    () => Array.from(new Set([...seriesPage0, ...favSeriesPage0])),
    [seriesPage0, favSeriesPage0]
  );

  const combinedSummaries = useQuery({
    queryKey: ["profile-media-summaries-combined", combinedMovieIds.join(","), combinedSeriesIds.join(","), locale],
    queryFn: async () => {
      const result = await fetchDisplaySummaries(combinedMovieIds, combinedSeriesIds, locale);
      seedCarouselFirstPage(queryClient, "series", seriesPage0, result, locale);
      seedCarouselFirstPage(queryClient, "series", favSeriesPage0, result, locale);
      seedCarouselFirstPage(queryClient, "movie", moviesPage0, result, locale);
      seedCarouselFirstPage(queryClient, "movie", favMoviesPage0, result, locale);
      return result;
    },
    enabled: allIdsLoaded && (combinedMovieIds.length > 0 || combinedSeriesIds.length > 0),
    staleTime: PROFILE_CAROUSEL_SUMMARY_STALE_TIME,
  });

  // isPending cobre tanto "ainda buscando" quanto "desabilitada, sem
  // dado ainda" — vira false assim que resolve, com sucesso OU erro
  // (erro cai pro fallback: cada carrossel busca por conta própria).
  const firstPagePending = combinedSummaries.isPending;

  return (
    <div className="mb-2">
      <section className="mb-6">
        <ProfileRecommendationsPreview />
      </section>

      <ProfileListsPreview />

      <ProfileMediaCarousel
        icon={Tv}
        label={t("nav.series")}
        href="/profile/series"
        mediaType="series"
        ids={seriesIds.data ?? []}
        isLoadingIds={seriesIds.isLoading}
        firstPagePending={firstPagePending}
        // Este é o carrossel mais perto do topo da página, onde o brilho
        // azul de fundo é mais concentrado — ver comentário em
        // ProfileMediaCarousel.tsx ("Correção... getComputedStyle
        // provou..."). Os outros 3 abaixo não precisam disso.
        dimHeadingBg
      />

      <ProfileMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteSeries")}
        href="/profile/favorite-series"
        mediaType="series"
        ids={favoriteSeriesIds.data ?? []}
        isLoadingIds={favoriteSeriesIds.isLoading}
        emptyLabel={t("profile.section.addFavoriteSeries")}
        emptyHref="/profile/series"
        firstPagePending={firstPagePending}
      />

      <ProfileMediaCarousel
        icon={Clapperboard}
        label={t("nav.movies")}
        href="/profile/movies"
        mediaType="movie"
        ids={movieIds.data ?? []}
        isLoadingIds={movieIds.isLoading}
        firstPagePending={firstPagePending}
      />

      <ProfileMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteMovies")}
        href="/profile/favorite-movies"
        mediaType="movie"
        ids={favoriteMovieIds.data ?? []}
        isLoadingIds={favoriteMovieIds.isLoading}
        emptyLabel={t("profile.section.addFavoriteMovies")}
        emptyHref="/profile/movies"
        firstPagePending={firstPagePending}
      />
    </div>
  );
}
