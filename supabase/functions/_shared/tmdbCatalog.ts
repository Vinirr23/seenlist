// supabase/functions/_shared/tmdbCatalog.ts
//
// CONTINUAÇÃO DA FASE 1 (migração mobile sem Vercel, 2026-10-20 —
// varredura das rotas pendentes pedida pelo usuário: "/api/search",
// "/api/tmdb/movie/[id]", "/api/tmdb/explore", "/api/tmdb/upcoming",
// "/api/tmdb/genres"). Todas as 5 rotas desta lista são repasse PURO
// de TMDB — nenhuma toca o Supabase (confirmado lendo
// `apps/web/lib/tmdb/client.ts` função por função: `searchMovieAndSeries`,
// `getMovieDetails`, as listas de descoberta, `getNextEpisodeToAir`,
// `getGenreMap`/`getGenreMaps` — nenhuma delas importa `createAdminClient`
// nem toca em tabela nenhuma).
//
// DECISÃO DE ARQUITETURA (consistente com a decisão já tomada pelo
// usuário pra operação "episode" de `series-data`, 2026-10-20: "Edge
// Function também pra esta rota") — mesmo sendo passthrough puro, não
// podem virar chamada DIRETA do mobile ao TMDB: `apps/mobile/.env` tem
// `TMDB_API_KEY`, mas SEM o prefixo `EXPO_PUBLIC_` que o Expo exige pra
// inlinar uma env var no bundle JS do app, e a chave também não está
// em `app.json` → `extra` (o outro mecanismo do Expo). Ou seja, o
// mobile hoje NÃO TEM NENHUMA FORMA de ler essa chave em runtime — pra
// chamar o TMDB direto, seria preciso expor a chave no bundle (extraível
// de qualquer apk/ipa), que é exatamente a mudança de modelo de
// credencial que o usuário já decidiu NÃO fazer pra "episode". A
// mesma decisão se aplica aqui, pela mesma razão exata, por isso não
// repeti a pergunta — ver "AskUserQuestion" original em `series-data/index.ts`
// pro histórico completo da decisão.
//
// CONSOLIDAÇÃO (a pedido de sempre do usuário — "sem criar uma função
// nova para cada endpoint") — as 5 rotas (nenhuma tem efeito colateral
// em comum que justifique entrar em `series-data`, que é sobre
// série/episódio) foram agrupadas numa Edge Function nova só,
// `tmdb-catalog`, com uma operação por rota — mesmo padrão de
// `series-data`, em vez de 5 functions quase vazias.
//
// Texto/lógica idênticos a `apps/web/lib/tmdb/client.ts` — a rota web
// NÃO foi tocada, isto é uma CÓPIA fiel.

import { tmdbGet, translateTvGenreName, dedupeWatchProviders } from "./tmdb.ts";

// ---------------------------------------------------------------
// Busca (/api/search) — apps/web/lib/tmdb/client.ts: searchMovieAndSeries
// ---------------------------------------------------------------
export interface MediaSearchResult {
  id: number;
  mediaType: "movie" | "series";
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage?: number;
  popularity?: number;
  originalTitle?: string;
}

interface TmdbMultiSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  popularity?: number;
  vote_average?: number;
}

interface TmdbMultiSearchResponse {
  results: TmdbMultiSearchItem[];
}

function normalizeSearchItem(item: TmdbMultiSearchItem): MediaSearchResult {
  const mediaType: "movie" | "series" = item.media_type === "tv" ? "series" : "movie";
  const dateString = item.media_type === "tv" ? item.first_air_date : item.release_date;
  const originalTitle = item.media_type === "tv" ? item.original_name : item.original_title;

  return {
    id: item.id,
    mediaType,
    title: (item.media_type === "tv" ? item.name : item.title) ?? "Sem título",
    year: dateString ? Number(dateString.slice(0, 4)) || null : null,
    posterPath: item.poster_path,
    voteAverage: item.vote_average,
    popularity: item.popularity,
    originalTitle: originalTitle && originalTitle.length > 0 ? originalTitle : undefined,
  };
}

export async function searchMovieAndSeries(query: string, language = "pt-BR"): Promise<MediaSearchResult[]> {
  const data = await tmdbGet<TmdbMultiSearchResponse>("/search/multi", {
    query,
    include_adult: "false",
    language,
  });
  return data.results.filter((item) => item.media_type === "movie" || item.media_type === "tv").map(normalizeSearchItem);
}

// ---------------------------------------------------------------
// Detalhe de filme (/api/tmdb/movie/[id]) — apps/web/lib/tmdb/client.ts: getMovieDetails
// ---------------------------------------------------------------
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface MovieDetails {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  voteAverage: number;
  trailerKey: string | null;
  director: string | null;
  cast: CastMember[];
  studios: string[];
  country: string | null;
  language: string | null;
  budget: number | null;
  revenue: number | null;
  watchProviders: WatchProvider[];
  similar: MediaSearchResult[];
  certification: string | null;
  gallery: string[];
}

const WATCH_PROVIDERS_REGION = "BR";

interface TmdbWatchProvidersResponse {
  results?: Record<string, { flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[] }>;
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
  recommendations?: { results: TmdbMultiSearchItem[] };
  "watch/providers"?: TmdbWatchProvidersResponse;
  videos?: { results: { key: string; site: string; type: string; official?: boolean }[] };
  images?: { backdrops: { file_path: string }[] };
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
}

function pickBrazilianMovieCertification(
  results: { iso_3166_1: string; release_dates: { certification: string }[] }[] | undefined
): string | null {
  const brEntry = results?.find((entry) => entry.iso_3166_1 === "BR");
  const certification = brEntry?.release_dates.find((release) => release.certification.trim().length > 0)?.certification;
  return certification?.trim() || null;
}

export async function getMovieDetails(movieId: string, language = "pt-BR"): Promise<MovieDetails> {
  const data = await tmdbGet<TmdbMovieDetailsResponse>(`/movie/${movieId}`, {
    append_to_response: "credits,recommendations,similar,watch/providers,videos,images,release_dates",
    language,
    include_image_language: "null,pt-BR,en",
  });

  const cast: CastMember[] = (data.credits?.cast ?? []).slice(0, 15).map((member) => ({
    id: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
  }));

  const director = data.credits?.crew.find((member) => member.job === "Director")?.name ?? null;

  const recommendedMovies = data.recommendations?.results ?? [];
  const similarMoviesFallback = data.similar?.results ?? [];
  const similar: MediaSearchResult[] = (recommendedMovies.length > 0 ? recommendedMovies : similarMoviesFallback)
    .slice(0, 12)
    .map((item) => normalizeSearchItem({ ...item, media_type: "movie" }));

  const regionProviders = data["watch/providers"]?.results?.[WATCH_PROVIDERS_REGION];
  const watchProviders: WatchProvider[] = dedupeWatchProviders(
    (regionProviders?.flatrate ?? []).map((provider) => ({
      id: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path,
    }))
  );

  const videos = data.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    videos.find((v) => v.site === "YouTube");

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
    trailerKey: trailer?.key ?? null,
    director,
    cast,
    studios: data.production_companies.map((company) => company.name),
    country: data.production_countries[0]?.name ?? null,
    language: data.original_language,
    budget: data.budget > 0 ? data.budget : null,
    revenue: data.revenue > 0 ? data.revenue : null,
    watchProviders,
    similar,
    certification: pickBrazilianMovieCertification(data.release_dates?.results),
    gallery: (data.images?.backdrops ?? []).slice(0, 8).map((img) => img.file_path),
  };
}

// ---------------------------------------------------------------
// "Em breve" (/api/tmdb/upcoming) — apps/web/lib/tmdb/client.ts: getNextEpisodeToAir
// ---------------------------------------------------------------
export interface NextEpisodeToAir {
  seriesId: number;
  seriesTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
  networks: string[];
}

interface TmdbNextEpisodeResponse {
  id: number;
  name: string;
  poster_path: string | null;
  networks: { name: string }[];
  next_episode_to_air: {
    season_number: number;
    episode_number: number;
    name: string;
    air_date: string | null;
  } | null;
}

export async function getNextEpisodeToAir(seriesId: number, language = "pt-BR"): Promise<NextEpisodeToAir | null> {
  const data = await tmdbGet<TmdbNextEpisodeResponse>(`/tv/${seriesId}`, { language });
  const next = data.next_episode_to_air;
  if (!next || !next.air_date) return null;

  return {
    seriesId: data.id,
    seriesTitle: data.name,
    posterPath: data.poster_path,
    seasonNumber: next.season_number,
    episodeNumber: next.episode_number,
    name: next.name,
    airDate: next.air_date,
    networks: data.networks.map((n) => n.name),
  };
}

// ---------------------------------------------------------------
// Explorar (/api/tmdb/explore) — apps/web/lib/tmdb/client.ts: listas
// de descoberta (trending/popular/upcoming/on_the_air/by-genre/similar)
// + getGenreMap. Mesmo formato de resposta (DiscoverPage).
// ---------------------------------------------------------------
export interface DiscoverItem {
  id: number;
  mediaType: "movie" | "series";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  genreIds: number[];
  voteAverage: number;
}

export interface DiscoverPage {
  items: DiscoverItem[];
  page: number;
  totalPages: number;
}

interface TmdbListResponse {
  page: number;
  total_pages: number;
  results: {
    id: number;
    title?: string;
    name?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    first_air_date?: string;
    genre_ids: number[];
    vote_average: number;
  }[];
}

function fromListRow(row: TmdbListResponse["results"][number], mediaType: "movie" | "series"): DiscoverItem {
  const dateStr = row.release_date || row.first_air_date || null;
  return {
    id: row.id,
    mediaType,
    title: row.title || row.name || "",
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    year: dateStr ? Number(dateStr.slice(0, 4)) : null,
    genreIds: row.genre_ids,
    voteAverage: row.vote_average,
  };
}

function toDiscoverPage(data: TmdbListResponse, mediaType: "movie" | "series"): DiscoverPage {
  return {
    items: data.results.map((r) => fromListRow(r, mediaType)),
    page: data.page,
    totalPages: data.total_pages,
  };
}

export async function getTrendingSeries(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/trending/tv/week", { language, page: String(page) });
  return toDiscoverPage(data, "series");
}

export async function getTrendingMovies(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/trending/movie/week", { language, page: String(page) });
  return toDiscoverPage(data, "movie");
}

export async function getPopularSeries(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/tv/popular", { language, page: String(page) });
  return toDiscoverPage(data, "series");
}

export async function getPopularMovies(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/movie/popular", { language, page: String(page) });
  return toDiscoverPage(data, "movie");
}

export async function getUpcomingMovies(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/movie/upcoming", { language, page: String(page) });
  return toDiscoverPage(data, "movie");
}

export async function getOnTheAirSeries(page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/tv/on_the_air", { language, page: String(page) });
  return toDiscoverPage(data, "series");
}

export async function getMoviesByGenre(genreId: number, page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/discover/movie", {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    language,
    page: String(page),
  });
  return toDiscoverPage(data, "movie");
}

export async function getSeriesByGenre(genreId: number, page = 1, language = "pt-BR"): Promise<DiscoverPage> {
  const data = await tmdbGet<TmdbListResponse>("/discover/tv", {
    with_genres: String(genreId),
    sort_by: "popularity.desc",
    language,
    page: String(page),
  });
  return toDiscoverPage(data, "series");
}

export type SimilarSource = "recommendations" | "similar";

export interface SimilarDiscoverPage extends DiscoverPage {
  source: SimilarSource;
}

export async function getSimilarMoviesForId(
  movieId: number,
  page = 1,
  language = "pt-BR",
  source?: SimilarSource
): Promise<SimilarDiscoverPage> {
  if (source === "similar") {
    const data = await tmdbGet<TmdbListResponse>(`/movie/${movieId}/similar`, { page: String(page), language });
    return { ...toDiscoverPage(data, "movie"), source: "similar" };
  }
  const recommended = await tmdbGet<TmdbListResponse>(`/movie/${movieId}/recommendations`, { page: String(page), language });
  if (page === 1 && recommended.results.length === 0) {
    const fallback = await tmdbGet<TmdbListResponse>(`/movie/${movieId}/similar`, { page: "1", language });
    return { ...toDiscoverPage(fallback, "movie"), source: "similar" };
  }
  return { ...toDiscoverPage(recommended, "movie"), source: "recommendations" };
}

export async function getSimilarSeriesForId(
  seriesId: number,
  page = 1,
  language = "pt-BR",
  source?: SimilarSource
): Promise<SimilarDiscoverPage> {
  if (source === "similar") {
    const data = await tmdbGet<TmdbListResponse>(`/tv/${seriesId}/similar`, { page: String(page), language });
    return { ...toDiscoverPage(data, "series"), source: "similar" };
  }
  const recommended = await tmdbGet<TmdbListResponse>(`/tv/${seriesId}/recommendations`, { page: String(page), language });
  if (page === 1 && recommended.results.length === 0) {
    const fallback = await tmdbGet<TmdbListResponse>(`/tv/${seriesId}/similar`, { page: "1", language });
    return { ...toDiscoverPage(fallback, "series"), source: "similar" };
  }
  return { ...toDiscoverPage(recommended, "series"), source: "recommendations" };
}

// ---------------------------------------------------------------
// Gêneros (/api/tmdb/genres) — apps/web/lib/tmdb/client.ts: getGenreMap/getGenreMaps
// ---------------------------------------------------------------
interface TmdbGenreListResponse {
  genres: { id: number; name: string }[];
}

async function fetchRawGenreLists(language: string): Promise<{ movie: TmdbGenreListResponse; tv: TmdbGenreListResponse }> {
  const [movie, tv] = await Promise.all([
    tmdbGet<TmdbGenreListResponse>("/genre/movie/list", { language }),
    tmdbGet<TmdbGenreListResponse>("/genre/tv/list", { language }),
  ]);
  return {
    movie,
    tv: { genres: tv.genres.map((g) => ({ ...g, name: translateTvGenreName(g.name, language) })) },
  };
}

export async function getGenreMap(language = "pt-BR"): Promise<Record<number, string>> {
  const { movie, tv } = await fetchRawGenreLists(language);
  const map: Record<number, string> = {};
  for (const g of [...movie.genres, ...tv.genres]) map[g.id] = g.name;
  return map;
}

export async function getGenreMaps(language = "pt-BR"): Promise<{ movie: Record<number, string>; tv: Record<number, string> }> {
  const { movie: movieGenres, tv: tvGenres } = await fetchRawGenreLists(language);
  const movie: Record<number, string> = {};
  for (const g of movieGenres.genres) movie[g.id] = g.name;
  const tv: Record<number, string> = {};
  for (const g of tvGenres.genres) tv[g.id] = g.name;
  return { movie, tv };
}
