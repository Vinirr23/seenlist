const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export type TmdbImageSize = "w185" | "w300" | "w342" | "w500" | "w780" | "w1280";

export function tmdbImage(path: string | null, size: TmdbImageSize): string | null {
  return path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;
}
