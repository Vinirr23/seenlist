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
  original_title?: string; // filmes
  original_name?: string; // séries
  release_date?: string; // filmes
  first_air_date?: string; // séries
  poster_path: string | null;
  popularity?: number;
}

interface TmdbMultiSearchResponse {
  results: TmdbMultiSearchItem[];
}

function normalizeSearchItem(item: TmdbMultiSearchItem): MediaSearchResult {
  const mediaType: MediaType = item.media_type === "tv" ? "series" : "movie";
  const dateString = item.media_type === "tv" ? item.first_air_date : item.release_date;
  const originalTitle = item.media_type === "tv" ? item.original_name : item.original_title;

  return {
    id: item.id,
    mediaType,
    title: (item.media_type === "tv" ? item.name : item.title) ?? "Sem título",
    year: dateString ? Number(dateString.slice(0, 4)) || null : null,
    posterPath: item.poster_path,
    popularity: item.popularity,
    originalTitle: originalTitle && originalTitle.length > 0 ? originalTitle : undefined,
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
// Busca por ID externo — TVDB/IMDb (TASK-027L, importador TV Time Out)
// ---------------------------------------------------------------

interface TmdbFindResponse {
  movie_results: { id: number; title: string; release_date?: string; poster_path: string | null; popularity?: number }[];
  tv_results: { id: number; name: string; first_air_date?: string; poster_path: string | null; popularity?: number }[];
}

export interface FindByExternalIdResult {
  tvdbId: string;
  source: "tvdb_id" | "imdb_id";
  seriesTmdbId: number | null;
  movieTmdbId: number | null;
  /** TASK-027Q — campos diagnósticos, só pra auditoria de matching. Não influenciam qual ID é escolhido (isso continua sendo results[0], intocado). */
  seriesName: string | null;
  seriesYear: number | null;
}

/**
 * TASK-027L — o novo importador prioriza TVDB ID (e IMDb ID como
 * segunda opção) em vez de buscar por nome — muito mais confiável
 * que o "Wrecked (2016)" vs "Wrecked" que motivou a TASK-027F. O
 * endpoint /find do TMDB aceita um id externo de cada vez; batching
 * acontece em quem chama isto (a rota da API), não aqui.
 */
export async function findByExternalId(
  externalId: string,
  source: "tvdb_id" | "imdb_id"
): Promise<FindByExternalIdResult> {
  const data = await tmdbGet<TmdbFindResponse>(`/find/${externalId}`, { external_source: source });

  return {
    tvdbId: externalId,
    source,
    seriesTmdbId: data.tv_results[0]?.id ?? null,
    movieTmdbId: data.movie_results[0]?.id ?? null,
    seriesName: data.tv_results[0]?.name ?? null,
    seriesYear: data.tv_results[0]?.first_air_date ? Number(data.tv_results[0].first_air_date.slice(0, 4)) || null : null,
  };
}


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
 * Versão enxuta de `getSeriesDetails` — só temporadas/contagem de
 * episódios, sem elenco nem "semelhantes". Usada pelo importador do
 * TV Time (lib/tvtime-import) pra comparar o histórico assistido do
 * usuário contra a estrutura real de cada candidato ambíguo, sem
 * pagar o custo da chamada pesada de detalhe completo.
 */
export interface SeriesSeasonSummary {
  numberOfSeasons: number;
  seasons: { seasonNumber: number; episodeCount: number }[];
  /** Nomes alternativos/títulos em outros países — TASK-027.5, critério de "aliases". */
  alternativeTitles: string[];
  /**
   * TASK-166 — true quando a série já terminou de exibir (TMDB
   * status "Ended"/"Canceled"), mesmo campo que `getSeriesSummary`
   * já expõe pra Biblioteca/recalc ao vivo. Sem chamada nova ao TMDB
   * — já vem no mesmo request de `/tv/{id}`, só não era lido aqui.
   * Usado pelo importador GDPR pra aplicar a mesma correção
   * watching→completed que a Biblioteca já faz (ver
   * `correctStatusWithLiveTmdb.ts`).
   */
  ended: boolean;
}

interface TmdbAlternativeTitlesResponse {
  results?: { title: string }[];
}

export async function getSeriesSeasonSummary(seriesId: number): Promise<SeriesSeasonSummary> {
  const data = await tmdbGet<TmdbTvDetailsResponse & { alternative_titles?: TmdbAlternativeTitlesResponse }>(
    `/tv/${seriesId}`,
    { append_to_response: "alternative_titles" }
  );
  return {
    numberOfSeasons: data.number_of_seasons,
    seasons: data.seasons.map((season) => ({ seasonNumber: season.season_number, episodeCount: season.episode_count })),
    alternativeTitles: (data.alternative_titles?.results ?? []).map((entry) => entry.title),
    ended: data.status === "Ended" || data.status === "Canceled",
  };
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

interface TmdbSeriesSeasonsResponse {
  seasons: { season_number: number; episode_count: number }[];
}

/**
 * TASK-027R — "buscar todos os episódios no TMDB" pra comparar
 * air_date contra a data da exportação, não o total agregado. Busca
 * a lista de temporadas (leve) e depois TODAS as temporadas em
 * paralelo via getSeasonEpisodes (que já traz airDate por episódio),
 * com Promise.allSettled — uma temporada com problema não derruba as
 * outras. Ignora temporada 0 (especiais), mesma convenção do resto
 * do projeto.
 */
export async function getAllEpisodesWithAirDates(seriesId: string): Promise<Episode[]> {
  const seasonsData = await tmdbGet<TmdbSeriesSeasonsResponse>(`/tv/${seriesId}`);
  const seasonNumbers = seasonsData.seasons.filter((s) => s.season_number >= 1).map((s) => s.season_number);

  const settled = await Promise.allSettled(seasonNumbers.map((n) => getSeasonEpisodes(seriesId, n)));
  const episodes: Episode[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      episodes.push(...outcome.value);
    } else {
      console.error(
        `[tmdb] Falha ao buscar temporada ${seasonNumbers[index]} da série ${seriesId} — as demais temporadas não são afetadas.`,
        outcome.reason
      );
    }
  });
  return episodes;
}

interface TmdbEpisodeDetailsResponse {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  air_date: string | null;
  vote_average: number | null;
}

export interface EpisodeDetails {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  runtimeMinutes: number | null;
  airDate: string | null;
  voteAverage: number | null;
}

/**
 * TASK-030 — `getSeasonEpisodes` (usada na página da série) não traz
 * `overview`/`vote_average` de propósito, pra não pesar a lista
 * inteira de episódios de uma tacada. A tela de episódio dedicada
 * precisa exatamente desses dois campos a mais — por isso uma função
 * separada, que busca só UM episódio por vez.
 */
export async function getEpisodeDetails(
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number
): Promise<EpisodeDetails> {
  const data = await tmdbGet<TmdbEpisodeDetailsResponse>(`/tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`);

  return {
    id: data.id,
    seasonNumber: data.season_number,
    episodeNumber: data.episode_number,
    name: data.name,
    overview: data.overview,
    stillPath: data.still_path,
    runtimeMinutes: data.runtime,
    airDate: data.air_date,
    voteAverage: data.vote_average,
  };
}


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

interface TmdbSeriesWatchProvidersResponse {
  results?: Record<string, { flatrate?: { provider_id: number; provider_name: string; logo_path: string | null }[] }>;
}

/**
 * TASK-030 — providers de série nunca tinham sido buscados neste
 * projeto (só filmes, em getMovieDetails). TMDB não tem providers
 * por EPISÓDIO — é sempre no nível da série inteira; por isso a tela
 * de episódio usa esta função com o `seriesId`, não com dados do
 * episódio em si. Mesma região fixa (BR) e mesmo formato de
 * getMovieDetails, de propósito — mesma UI de "onde assistir"
 * reaproveitável dos dois lados.
 */
export async function getSeriesWatchProviders(seriesId: string): Promise<WatchProvider[]> {
  const data = await tmdbGet<TmdbSeriesWatchProvidersResponse>(`/tv/${seriesId}/watch/providers`);
  const regionProviders = data.results?.[WATCH_PROVIDERS_REGION];
  return (regionProviders?.flatrate ?? []).map((provider) => ({
    id: provider.provider_id,
    name: provider.provider_name,
    logoPath: provider.logo_path,
  }));
}

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
  /**
   * Só preenchido pra séries — true quando a série já terminou de
   * exibir (TMDB status "Ended"/"Canceled"). Sem isso não dá pra
   * distinguir "assistiu tudo que já saiu, mas a série continua no
   * ar" (categoria "Em dia") de "assistiu tudo porque a série
   * realmente acabou" (categoria "Concluídas").
   */
  ended?: boolean;
  /**
   * Minutos: pra filme, a duração do filme; pra série, a duração
   * MÉDIA de um episódio (TMDB não guarda a duração de cada episódio
   * assistido individualmente — calcular "tempo assistido" a partir
   * disso é uma estimativa: episódios assistidos × duração média,
   * não uma soma exata episódio por episódio). Vem do mesmo request
   * que já busca o resto do resumo — nenhuma chamada nova ao TMDB.
   */
  runtimeMinutes?: number;
  /** Só preenchido pra filme (TASK-148, app nativo). Formato TMDB (YYYY-MM-DD). */
  releaseDate?: string | null;
}

interface TmdbMovieSummaryResponse {
  id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  runtime: number | null;
}

export async function getMovieSummary(movieId: number): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbMovieSummaryResponse>(`/movie/${movieId}`);
  return {
    id: data.id,
    title: data.title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    runtimeMinutes: data.runtime ?? undefined,
    releaseDate: data.release_date ?? null,
  };
}

interface TmdbSeriesSummaryResponse {
  id: number;
  name: string;
  first_air_date: string | null;
  poster_path: string | null;
  number_of_episodes: number;
  /** "Returning Series" | "Ended" | "Canceled" | "In Production" | "Planned" | "Pilot" */
  status: string;
  /** Nem toda série preenche isso no TMDB — por isso o fallback abaixo. */
  episode_run_time: number[];
  seasons: { season_number: number; episode_count: number }[];
}

const DEFAULT_EPISODE_RUNTIME_MINUTES = 45;

/**
 * TASK-030 (correção) — achado real: `number_of_episodes` do TMDB
 * inclui a temporada 0 (especiais). A contagem de episódios
 * assistidos usada em `library-state.ts` (`entry.watchedCount`)
 * EXCLUI especiais (`is_special = false`, coluna adicionada pra
 * preservar essa informação sem contaminar progresso). Comparar um
 * total COM especiais contra uma contagem SEM especiais fazia
 * "assistiu tudo" ficar praticamente impossível de bater pra
 * qualquer série com especiais no TMDB — e por isso "Em dia" e
 * "Concluída" praticamente nunca disparavam, mesmo com a importação
 * gravando tudo certo. Agora soma só temporada >= 1, mesma convenção
 * já usada em reconstructProgress.ts/resolveStatus.ts.
 */
export async function getSeriesSummary(seriesId: number): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbSeriesSummaryResponse>(`/tv/${seriesId}`);
  const totalEpisodesExcludingSpecials = data.seasons
    .filter((season) => season.season_number >= 1)
    .reduce((sum, season) => sum + season.episode_count, 0);

  return {
    id: data.id,
    title: data.name,
    year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    totalEpisodes: totalEpisodesExcludingSpecials || data.number_of_episodes,
    ended: data.status === "Ended" || data.status === "Canceled",
    runtimeMinutes: data.episode_run_time?.[0] || DEFAULT_EPISODE_RUNTIME_MINUTES,
  };
}

// ---------------------------------------------------------------
// "Em breve" (TASK-019) — próximo episódio a estrear de cada série
// acompanhada. O TMDB já devolve isso pronto em `next_episode_to_air`
// dentro de /tv/{id} — não precisa de nenhuma chamada extra.
// ---------------------------------------------------------------

export interface NextEpisodeToAir {
  seriesId: number;
  seriesTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
  /** TASK-051 — mesma chamada de sempre (/tv/{id}) já trazia isso, só não estava sendo lido. TMDB não tem horário de exibição (só data) — por isso não existe airTime aqui, seria inventar dado. */
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

export async function getNextEpisodeToAir(seriesId: number): Promise<NextEpisodeToAir | null> {
  const data = await tmdbGet<TmdbNextEpisodeResponse>(`/tv/${seriesId}`);
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

/**
 * TASK-058 — aba Explorar. Todas essas usam endpoints de LISTAGEM do
 * TMDB (trending/popular/discover/on_the_air), que trazem
 * poster/título/data/genre_ids de vários itens numa chamada só — bem
 * mais barato que buscar detalhe completo item por item. `genre_ids`
 * vem cru (números); a tradução pra nome de gênero é uma chamada só,
 * separada e cacheada (`getGenreMap`), reaproveitada por todos os
 * cards.
 */
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

interface TmdbListResponse {
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

export async function getTrendingSeries(): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbListResponse>("/trending/tv/week");
  return data.results.map((r) => fromListRow(r, "series"));
}

export async function getTrendingMovies(): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbListResponse>("/trending/movie/week");
  return data.results.map((r) => fromListRow(r, "movie"));
}

export async function getPopularSeries(): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbListResponse>("/tv/popular");
  return data.results.map((r) => fromListRow(r, "series"));
}

export async function getPopularMovies(): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbListResponse>("/movie/popular");
  return data.results.map((r) => fromListRow(r, "movie"));
}

export async function getUpcomingMovies(): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbListResponse>("/movie/upcoming");
  return data.results.map((r) => fromListRow(r, "movie"));
}

export async function getOnTheAirSeries(): Promise<DiscoverItem[]> {
  const data = await tmdbGet<TmdbListResponse>("/tv/on_the_air");
  return data.results.map((r) => fromListRow(r, "series"));
}

interface TmdbGenreListResponse {
  genres: { id: number; name: string }[];
}

/** Mapa id→nome de gênero, série + filme juntos (os ids não colidem entre os dois na prática do TMDB). Uma chamada só, cacheada pelo mesmo `next.revalidate` de `tmdbGet`. */
export async function getGenreMap(): Promise<Record<number, string>> {
  const [movieGenres, tvGenres] = await Promise.all([
    tmdbGet<TmdbGenreListResponse>("/genre/movie/list"),
    tmdbGet<TmdbGenreListResponse>("/genre/tv/list"),
  ]);
  const map: Record<number, string> = {};
  for (const g of [...movieGenres.genres, ...tvGenres.genres]) map[g.id] = g.name;
  return map;
}
