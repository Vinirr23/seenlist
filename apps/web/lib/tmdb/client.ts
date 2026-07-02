import type { CastMember, Episode, MediaSearchResult, MediaType, SeriesDetails } from "@seenlist/types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error("TMDB_API_KEY não configurada.");
  }
  return key;
}

/**
 * Único helper de baixo nível que efetivamente chama api.themoviedb.org.
 * Todas as funções deste arquivo passam por aqui — é o que dá pra
 * chamar de "client centralizado" e evita duplicar a lógica de
 * montar URL/api_key/idioma em cada função.
 */
async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey());
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
