import type { WatchProvider } from "@seenlist/types";

const SITE_URL = "https://seenlist.app";

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

export interface EpisodePageData {
  episode: EpisodeDetails;
  watchProviders: WatchProvider[];
}

/** Idêntico a useEpisodeDetails do web — mesma rota (/api/tmdb/episode/..., já liberada no middleware pro app nativo). */
export async function fetchEpisodePage(seriesId: string, season: number, episode: number): Promise<EpisodePageData> {
  const response = await fetch(`${SITE_URL}/api/tmdb/episode/${seriesId}/${season}/${episode}`);
  if (!response.ok) throw new Error("episode fetch failed");
  return response.json() as Promise<EpisodePageData>;
}
