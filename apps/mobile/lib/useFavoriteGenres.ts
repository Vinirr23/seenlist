import { useEffect, useMemo, useState } from "react";
import { useLibraryItems } from "./useLibraryItems";
import { useTranslation } from "./i18n/LocaleProvider";

const SITE_URL = "https://seenlist.app";
const TOP_GENRES_COUNT = 5;

interface SummaryGenres {
  id: number;
  genres?: string[];
}

interface LibrarySummariesGenresResponse {
  movies: SummaryGenres[];
  series: SummaryGenres[];
}

interface GenreMaps {
  movie: Record<number, string>;
  tv: Record<number, string>;
}

export interface FavoriteGenre {
  name: string;
  genreId: number;
  count: number;
}

async function fetchGenresByIds(movieIds: number[], seriesIds: number[], language: string): Promise<LibrarySummariesGenresResponse> {
  const response = await fetch(`${SITE_URL}/api/tmdb/library-summaries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movieIds, seriesIds, language }),
  });
  if (!response.ok) throw new Error("library-summaries fetch failed");
  return response.json();
}

async function fetchGenreMaps(language: string): Promise<GenreMaps> {
  const response = await fetch(`${SITE_URL}/api/tmdb/genres?language=${language}`);
  if (!response.ok) throw new Error("genre map fetch failed");
  const data = (await response.json()) as { movieGenreMap: Record<number, string>; tvGenreMap: Record<number, string> };
  return { movie: data.movieGenreMap, tv: data.tvGenreMap };
}

function rankGenres(summaries: SummaryGenres[], nameToId: Map<string, number>): FavoriteGenre[] {
  const counts = new Map<string, number>();
  for (const summary of summaries) {
    for (const genre of summary.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, genreId: nameToId.get(name) }))
    .filter((genre): genre is FavoriteGenre => genre.genreId !== undefined)
    .slice(0, TOP_GENRES_COUNT);
}

/**
 * PORTE DO WEB (2026-09-02 — "vamos implementar as mudanças que
 * foram feitas no web", reformulação completa da Explorar) — mesma
 * lógica exata de `apps/web/lib/queries/favorite-genres.ts` ("Para
 * você"/"Seus gêneros favoritos": só conta título "completed"/
 * "up_to_date", rankings SEPARADOS pra filme e série porque os dois
 * NÃO compartilham o mesmo espaço de id de gênero no TMDB — ver o
 * histórico completo de bug real no arquivo do web, mesma causa raiz
 * vale aqui). Só troca `useQuery` (react-query, não usado no mobile)
 * por `useState`+`useEffect` manual, mesmo padrão de todo hook de
 * dado remoto deste app. Sem cache no `AsyncStorage` — dado calculado
 * a partir da Biblioteca, que já tem seu próprio cache local; cachear
 * de novo aqui só arriscaria mostrar um gênero desatualizado depois
 * de a pessoa concluir algo novo.
 */
export function useFavoriteGenres() {
  const { items: libraryItems, isLoading: libraryLoading } = useLibraryItems();
  const { locale } = useTranslation();

  const completedIds = useMemo(() => {
    const movieIds: number[] = [];
    const seriesIds: number[] = [];
    for (const item of libraryItems ?? []) {
      if (item.status !== "completed" && item.status !== "up_to_date") continue;
      if (item.mediaType === "movie") movieIds.push(item.id);
      else seriesIds.push(item.id);
    }
    return { movieIds, seriesIds };
  }, [libraryItems]);

  const hasCompletedItems = completedIds.movieIds.length + completedIds.seriesIds.length > 0;
  const movieIdsKey = completedIds.movieIds.join(",");
  const seriesIdsKey = completedIds.seriesIds.join(",");

  const [topMovieGenres, setTopMovieGenres] = useState<FavoriteGenre[]>([]);
  const [topSeriesGenres, setTopSeriesGenres] = useState<FavoriteGenre[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!hasCompletedItems) {
      setTopMovieGenres([]);
      setTopSeriesGenres([]);
      return;
    }
    let cancelled = false;
    setIsFetching(true);
    Promise.all([fetchGenresByIds(completedIds.movieIds, completedIds.seriesIds, locale), fetchGenreMaps(locale)])
      .then(([genres, genreMaps]) => {
        if (cancelled) return;
        const movieNameToId = new Map(Object.entries(genreMaps.movie).map(([id, name]) => [name, Number(id)]));
        const tvNameToId = new Map(Object.entries(genreMaps.tv).map(([id, name]) => [name, Number(id)]));
        setTopMovieGenres(rankGenres(genres.movies, movieNameToId));
        setTopSeriesGenres(rankGenres(genres.series, tvNameToId));
      })
      .catch((error) => {
        console.error("[useFavoriteGenres] Falha ao calcular gêneros favoritos", error);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieIdsKey, seriesIdsKey, locale, hasCompletedItems]);

  return {
    topMovieGenres,
    topSeriesGenres,
    isLoading: libraryLoading || (hasCompletedItems && isFetching),
    hasCompletedItems,
  };
}
