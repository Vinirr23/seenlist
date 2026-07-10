/**
 * Tipos de domínio compartilhados entre apps/web e apps/mobile.
 *
 * São todos moldados pelo TMDB (busca, série, filme) — os tipos de
 * linha do banco (watched_episodes, movie_status) ficam perto de
 * onde são usados em apps/web/lib/queries, não aqui, porque são
 * detalhes de persistência, não domínio compartilhado entre apps.
 */
export type MediaType = "movie" | "series";

export interface MediaSearchResult {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Só usado hoje pelo importador do TV Time, como critério de desempate entre candidatos com score parecido. */
  popularity?: number;
  /** Título original do TMDB (original_name/original_title) — usado pelo importador do TV Time pra comparar com o nome que o TV Time guarda, que costuma ser o original, não o localizado. */
  originalTitle?: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  stillPath: string | null;
  runtimeMinutes: number | null;
  airDate: string | null;
}

export interface SeasonWithEpisodes {
  seasonNumber: number;
  name: string;
  episodes: Episode[];
}

export interface WatchProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export type MovieWatchStatus = "watched" | "want_to_watch" | "watching";

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
  director: string | null;
  cast: CastMember[];
  studios: string[];
  country: string | null;
  language: string | null;
  budget: number | null;
  revenue: number | null;
  watchProviders: WatchProvider[];
  similar: MediaSearchResult[];
}

export interface SeriesDetails {
  id: number;
  title: string;
  overview: string;
  backdropPath: string | null;
  posterPath: string | null;
  firstAirDate: string | null;
  status: string;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  genres: string[];
  networks: string[];
  voteAverage: number;
  cast: CastMember[];
  similar: MediaSearchResult[];
  seasons: SeasonWithEpisodes[];
}

// ---------------------------------------------------------------
// Biblioteca (TASK-007)
// ---------------------------------------------------------------

/** Vocabulário normalizado da Biblioteca — não é 1:1 com o enum bruto
 * de movie_status ('watched' vira 'completed' na leitura).
 * TASK-033 — "up_to_date" ("Em dia") virou status de verdade,
 * decidido e gravado pelo importador — deixou de ser um flag
 * calculado na leitura (ver LibraryItem.isCaughtUp, removido). */
export type LibraryStatus = "want_to_watch" | "watching" | "completed" | "paused" | "up_to_date";

export interface LibraryProgress {
  watchedEpisodes: number;
  totalEpisodes: number;
  /** TASK-027J — total de visualizações do TV Time (inclui reassistidas), separado de propósito de `watchedEpisodes` (episódios únicos). undefined quando a série nunca foi importada — nesse caso, estatísticas usam `watchedEpisodes` como substituto razoável (não existe conceito de reassistir fora da importação ainda). */
  totalWatchEvents?: number;
}

export interface LibraryItem {
  mediaType: MediaType;
  id: number;
  status: LibraryStatus;
  createdAt: string;
  updatedAt: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Só séries. */
  progress?: LibraryProgress;
  /** Filme: duração do filme. Série: duração média de um episódio. Minutos. */
  runtimeMinutes?: number;
}
