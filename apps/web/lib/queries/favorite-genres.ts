"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLibraryItems } from "@/lib/queries/library";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TOP_GENRES_COUNT = 5;

interface SummaryGenres {
  id: number;
  genres?: string[];
}

interface LibrarySummariesGenresResponse {
  movies: SummaryGenres[];
  series: SummaryGenres[];
}

async function fetchGenresByIds(movieIds: number[], seriesIds: number[], language: string): Promise<LibrarySummariesGenresResponse> {
  const response = await fetch("/api/tmdb/library-summaries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movieIds, seriesIds, language }),
  });
  if (!response.ok) throw new Error("library-summaries fetch failed");
  return response.json();
}

interface GenreMaps {
  movie: Record<number, string>;
  tv: Record<number, string>;
}

async function fetchGenreMaps(language: string): Promise<GenreMaps> {
  const response = await fetch(`/api/tmdb/genres?language=${language}`);
  if (!response.ok) throw new Error("genre map fetch failed");
  const data = (await response.json()) as { movieGenreMap: Record<number, string>; tvGenreMap: Record<number, string> };
  return { movie: data.movieGenreMap, tv: data.tvGenreMap };
}

export interface FavoriteGenre {
  name: string;
  genreId: number;
  count: number;
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
 * Fase C da reformulação da Explorar (2026-08-21) — "Seus gêneros
 * favoritos" (chips) e "Para você" (carrossel filtrado pelo gênero
 * #1). Pergunta feita ao usuário (AskUserQuestion): qual fonte conta
 * pro cálculo — escolhido "só assistidos/concluídos" (status
 * "completed"/"up_to_date"), não a Biblioteca inteira nem só
 * favoritos. Peso 1 por título, sem diferenciar por nº de episódios —
 * mais simples que o Ano em Revisão (que pesa por episódio, mas é
 * escopo de 1 ano; aqui é "sempre", vindo de toda a Biblioteca
 * concluída, sem corte de data).
 *
 * IMPORTANTE (achado, evita um bug de idioma) — `media_summaries_cache`
 * guarda o NOME do gênero, cacheado por idioma (é parte da chave da
 * tabela). Pra bater o nome salvo de volta com o id que o TMDB espera
 * em `/discover`, o mapa de gênero (`/api/tmdb/genres`) tem que vir
 * buscado NO MESMO idioma desta chamada — por isso os dois fetches
 * abaixo recebem `locale` explicitamente.
 *
 * CORREÇÃO (achado real, reportado — "Principais séries para você"
 * sempre vazio) — filme e série NÃO compartilham o mesmo espaço de id
 * de gênero no TMDB ("Ação"=28 e "Aventura"=12 só existem no lado
 * filme; série usa "Ação e Aventura"=10759 em vez disso). A versão
 * anterior calculava UM gênero favorito combinando filme+série e
 * usava esse id pros dois `/discover` — quando o gênero vencedor vinha
 * majoritariamente de filmes concluídos, `/discover/tv?with_genres=28`
 * não dava erro nenhum, só nunca tinha resultado (nenhuma série carrega
 * esse id) — carrossel "vazio" sem nada de errado pra investigar.
 * Agora calcula RANKINGS SEPARADOS — `topMovieGenres` só a partir dos
 * filmes concluídos (mapeado pelo mapa de gênero de FILME) e
 * `topSeriesGenres` só a partir das séries concluídas (mapeado pelo
 * mapa de gênero de SÉRIE) — cada um sempre usa o id certo pro seu
 * próprio `/discover`.
 */
export function useFavoriteGenres() {
  const { data: libraryItems, isLoading: libraryLoading } = useLibraryItems();
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

  const genresQuery = useQuery({
    queryKey: ["favorite-genres-raw", completedIds.movieIds, completedIds.seriesIds, locale],
    queryFn: () => fetchGenresByIds(completedIds.movieIds, completedIds.seriesIds, locale),
    enabled: hasCompletedItems,
    staleTime: TEN_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
  });

  const genreMapsQuery = useQuery({
    queryKey: ["genre-maps", locale],
    queryFn: () => fetchGenreMaps(locale),
    enabled: hasCompletedItems,
    staleTime: ONE_DAY_MS,
    gcTime: ONE_DAY_MS,
  });

  const { topMovieGenres, topSeriesGenres } = useMemo(() => {
    if (!genresQuery.data || !genreMapsQuery.data) return { topMovieGenres: [] as FavoriteGenre[], topSeriesGenres: [] as FavoriteGenre[] };

    const movieNameToId = new Map(Object.entries(genreMapsQuery.data.movie).map(([id, name]) => [name, Number(id)]));
    const tvNameToId = new Map(Object.entries(genreMapsQuery.data.tv).map(([id, name]) => [name, Number(id)]));

    return {
      topMovieGenres: rankGenres(genresQuery.data.movies, movieNameToId),
      topSeriesGenres: rankGenres(genresQuery.data.series, tvNameToId),
    };
  }, [genresQuery.data, genreMapsQuery.data]);

  return {
    topMovieGenres,
    topSeriesGenres,
    isLoading: libraryLoading || (hasCompletedItems && (genresQuery.isLoading || genreMapsQuery.isLoading)),
    hasCompletedItems,
  };
}
