import type { SeriesDetails } from "@seenlist/types";
import { episodeKey, type WatchedEpisodeKey } from "./seriesDetails";

export type SeriesCaughtUpBadge = "ongoing" | "ended" | null;

/** TASK-170 — porta de `lib/seriesCaughtUpBadge.ts` do web. Ver comentário lá pro raciocínio completo. */
export function computeSeriesCaughtUpBadge(
  series: Pick<SeriesDetails, "seasons" | "status">,
  watched: Set<WatchedEpisodeKey> | undefined
): SeriesCaughtUpBadge {
  const today = new Date().toISOString().slice(0, 10);

  const airedNonSpecialEpisodes = series.seasons
    .filter((season) => season.seasonNumber > 0)
    .flatMap((season) => season.episodes)
    .filter((episode) => episode.airDate !== null && episode.airDate <= today);

  if (airedNonSpecialEpisodes.length === 0) return null;

  const watchedSet = watched ?? new Set<WatchedEpisodeKey>();
  const allAiredWatched = airedNonSpecialEpisodes.every((episode) =>
    watchedSet.has(episodeKey(episode.seasonNumber, episode.episodeNumber))
  );
  if (!allAiredWatched) return null;

  const seriesEnded = series.status === "Ended" || series.status === "Canceled";
  return seriesEnded ? "ended" : "ongoing";
}
