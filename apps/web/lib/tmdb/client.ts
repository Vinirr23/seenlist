import type {
  CastMember,
  Episode,
  MediaSearchResult,
  MediaType,
  MovieDetails,
  SeriesDetails,
  WatchProvider,
} from "@seenlist/types";
import { env } from "@/lib/env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Único helper de baixo nível que efetivamente chama api.themoviedb.org.
 * Todas as funções deste arquivo passam por aqui — é o que dá pra
 * chamar de "client centralizado" e evita duplicar a lógica de
 * montar URL/api_key/idioma em cada função.
 */
async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", env.tmdbApiKey());
  url.searchParams.set("language", "pt-BR");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    // TMDB muda pouco de um minuto pro outro — 5 min de cache no
    // fetch do Next complementa (não substitui) o cache de 5 min do
    // React Query no client.
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`TMDB respondeu ${response.status} em ${path}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Formato bruto de item retornado por /search/multi — só os campos
 * que a gente de fato usa. TMDB também devolve `media_type: "person"`
 * nesse endpoint, por isso o filtro em `searchMovieAndSeries`.
 */
interface TmdbMultiSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string; // filmes
  name?: string; // séries
  release_date?: string; // filmes
  first_air_date?: string; // séries
  poster_path: string | null;
}

interface TmdbMultiSearchResponse {
  results: TmdbMultiSearchItem[];
}

function normalizeSearchItem(item: TmdbMultiSearchItem): MediaSearchResult {
  const mediaType: MediaType = item.media_type === "tv" ? "series" : "movie";
  const dateString = item.media_type === "tv" ? item.first_air_date : item.release_date;

  return {
    id: item.id,
    mediaType,
    title: (item.media_type === "tv" ? item.name : item.title) ?? "Sem título",
    year: dateString ? Number(dateString.slice(0, 4)) || null : null,
    posterPath: item.poster_path,
  };
}

/** A rota `/api/search` é o único chamador. */
export async function searchMovieAndSeries(query: string): Promise<MediaSearchResult[]> {
  const data = await tmdbGet<TmdbMultiSearchResponse>("/search/multi", {
    query,
    include_adult: "false",
  });

  return data.results
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map(normalizeSearchItem);
}

// ---------------------------------------------------------------
// Página da série (TASK-005)
// ---------------------------------------------------------------

interface TmdbTvDetailsResponse {
  id: number;
  name: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  first_air_date: string | null;
  status: string;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  networks: { id: number; name: string }[];
  vote_average: number;
  seasons: { season_number: number; name: string; episode_count: number }[];
  credits?: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
  similar?: { results: TmdbMultiSearchItem[] };
}

/**
 * Detalhes da série + elenco + séries semelhantes numa chamada só
 * (via `append_to_response`) — evita 3 requests separados pra
 * montar uma única tela.
 */
export async function getSeriesDetails(
  seriesId: string
): Promise<Omit<SeriesDetails, "seasons">> {
  const data = await tmdbGet<TmdbTvDetailsResponse>(`/tv/${seriesId}`, {
    append_to_response: "credits,similar",
  });

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 15).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
  }));

  const similar: MediaSearchResult[] = (data.similar?.results ?? [])
    .slice(0, 12)
    .map((item) => normalizeSearchItem({ ...item, media_type: "tv" }));

  return {
    id: data.id,
    title: data.name,
    overview: data.overview,
    backdropPath: data.backdrop_path,
    posterPath: data.poster_path,
    firstAirDate: data.first_air_date,
    status: data.status,
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    genres: data.genres.map((genre) => genre.name),
    networks: data.networks.map((network) => network.name),
    voteAverage: data.vote_average,
    cast,
    similar,
  };
}

interface TmdbSeasonResponse {
  episodes: {
    id: number;
    season_number: number;
    episode_number: number;
    name: string;
    still_path: string | null;
    runtime: number | null;
    air_date: string | null;
  }[];
}

/** Lista de episódios de UMA temporada. Chamada uma vez por temporada, em paralelo, pela rota `/api/tmdb/series/[id]`. */
export async function getSeasonEpisodes(seriesId: string, seasonNumber: number): Promise<Episode[]> {
  const data = await tmdbGet<TmdbSeasonResponse>(`/tv/${seriesId}/season/${seasonNumber}`);

  return data.episodes.map((episode) => ({
    id: episode.id,
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    name: episode.name,
    stillPath: episode.still_path,
    runtimeMinutes: episode.runtime,
    airDate: episode.air_date,
  }));
}

/** Lista (número, nome) de temporadas — usada pra disparar as buscas de episódios em paralelo. */
export async function getSeriesSeasonList(
  seriesId: string
): Promise<{ seasonNumber: number; name: string }[]> {
  const data = await tmdbGet<TmdbTvDetailsResponse>(`/tv/${seriesId}`);
  // Temporada "0" do TMDB costuma ser especiais — fora do escopo pedido.
  return data.seasons
    .filter((season) => season.season_number > 0)
    .map((season) => ({ seasonNumber: season.season_number, name: season.name }));
}

// ---------------------------------------------------------------
// Página do filme (TASK-006)
// ---------------------------------------------------------------

interface TmdbWatchProvidersResponse {
  results?: Record<
    string,
    {
      flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[];
    }
  >;
}

interface TmdbMovieDetailsResponse {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  production_companies: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  original_language: string | null;
  budget: number;
  revenue: number;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
  similar?: { results: TmdbMultiSearchItem[] };
  "watch/providers"?: TmdbWatchProvidersResponse;
}

/** Região usada pra "onde assistir" — projeto é pt-BR de ponta a ponta, então fixamos BR. */
const WATCH_PROVIDERS_REGION = "BR";

/**
 * Detalhes do filme + elenco/direção + filmes semelhantes + onde
 * assistir, tudo numa chamada só (via `append_to_response`).
 */
export async function getMovieDetails(movieId: string): Promise<MovieDetails> {
  const data = await tmdbGet<TmdbMovieDetailsResponse>(`/movie/${movieId}`, {
    append_to_response: "credits,similar,watch/providers",
  });

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 15).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
  }));

  const director = data.credits?.crew.find((member) => member.job === "Director")?.name ?? null;

  const similar: MediaSearchResult[] = (data.similar?.results ?? [])
    .slice(0, 12)
    .map((item) => normalizeSearchItem({ ...item, media_type: "movie" }));

  const regionProviders = data["watch/providers"]?.results?.[WATCH_PROVIDERS_REGION];
  const watchProviders: WatchProvider[] = (regionProviders?.flatrate ?? []).map((provider) => ({
    id: provider.provider_id,
    name: provider.provider_name,
    logoPath: provider.logo_path,
  }));

  return {
    id: data.id,
    title: data.title,
    originalTitle: data.original_title,
    overview: data.overview,
    backdropPath: data.backdrop_path,
    posterPath: data.poster_path,
    releaseDate: data.release_date,
    runtimeMinutes: data.runtime,
    genres: data.genres.map((genre) => genre.name),
    voteAverage: data.vote_average,
    director,
    cast,
    studios: data.production_companies.map((company) => company.name),
    country: data.production_countries[0]?.name ?? null,
    language: data.original_language,
    budget: data.budget > 0 ? data.budget : null,
    revenue: data.revenue > 0 ? data.revenue : null,
    watchProviders,
    similar,
  };
}

// ---------------------------------------------------------------
// Biblioteca (TASK-007) — resumos leves, só pra exibição
// (poster/título/ano/total de episódios). O estado da Biblioteca em
// si (o que está em cada lista, status, progresso assistido) vem só
// do Supabase — isso aqui NUNCA decide o que aparece na Biblioteca,
// só decora o que já veio de lá.
// ---------------------------------------------------------------

export interface MediaSummary {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Só preenchido pra séries. */
  totalEpisodes?: number;
}

interface TmdbMovieSummaryResponse {
  id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
}

export async function getMovieSummary(movieId: number): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbMovieSummaryResponse>(`/movie/${movieId}`);
  return {
    id: data.id,
    title: data.title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
  };
}

interface TmdbSeriesSummaryResponse {
  id: number;
  name: string;
  first_air_date: string | null;
  poster_path: string | null;
  number_of_episodes: number;
}

export async function getSeriesSummary(seriesId: number): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbSeriesSummaryResponse>(`/tv/${seriesId}`);
  return {
    id: data.id,
    title: data.name,
    year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    totalEpisodes: data.number_of_episodes,
  };
}
