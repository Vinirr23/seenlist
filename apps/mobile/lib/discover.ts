const SITE_URL = "https://seenlist.app";

export type DiscoverListKey =
  | "trending_series"
  | "trending_movies"
  | "popular_series"
  | "popular_movies"
  | "upcoming_movies"
  | "on_the_air_series";

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

interface DiscoverListResponse {
  items: DiscoverItem[];
  genreMap: Record<number, string> | null;
}

/** Idêntico a lib/queries/discover.ts do web — mesma rota (/api/tmdb/explore, já liberada no middleware pro app nativo). */
export async function fetchDiscoverList(list: DiscoverListKey): Promise<DiscoverItem[]> {
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${list}`);
  if (!response.ok) throw new Error("discover fetch failed");
  const data = (await response.json()) as DiscoverListResponse;
  return data.items;
}
