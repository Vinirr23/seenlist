/**
 * Tipos de domínio compartilhados entre apps/web e apps/mobile.
 *
 * A modelagem de banco (Vazio de propósito — sem banco de dados
 * ainda) continua fora daqui. O que já existe (TASK-004) são os
 * tipos do resultado de busca do TMDB, porque tanto web quanto o
 * futuro mobile vão precisar do mesmo formato normalizado.
 */
export type MediaType = "movie" | "series";

export interface MediaSearchResult {
  id: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
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
