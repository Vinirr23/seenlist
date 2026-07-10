import type { ExtractedArchive } from "../parser/zip";
import { parseFollowedShows } from "../parser/followedShow";
import { parseTvShowProgress } from "../parser/tvShowProgress";
import { parseSpecialStatus, isForLaterStatus } from "../parser/specialStatus";
import { parseGranularEpisodes } from "../parser/granularEpisodes";
import type { ParsedArchive, ParsedShow, GranularEpisodeSignal } from "./types";

/**
 * TASK-027B — reconstruído em torno dos arquivos reais (ver
 * /docs/tvtime-gdpr-spec.md). `followed_tv_show.csv` é a lista base
 * (uma linha por série); os outros arquivos enriquecem cada série
 * por `tv_show_id` (ou por nome, quando o arquivo não tem id — caso
 * dos três arquivos granulares).
 */
export function buildParsedArchive(
  extracted: ExtractedArchive,
  diagnostics?: {
    onFileParsed?: (file: string, rowCount: number) => void;
  }
): ParsedArchive {
  const missingFiles = (
    [
      "followed_tv_show.csv",
      "user_tv_show_data.csv",
      "user_show_special_status.csv",
      "watched_on_episode.csv",
      "rewatched_episode.csv",
      "seen_episode_latest.csv",
    ] as const
  ).filter((file) => !extracted.files[file]);

  const followed = extracted.files["followed_tv_show.csv"]
    ? parseFollowedShows(extracted.files["followed_tv_show.csv"])
    : [];
  const progress = extracted.files["user_tv_show_data.csv"]
    ? parseTvShowProgress(extracted.files["user_tv_show_data.csv"])
    : [];
  const specialStatus = extracted.files["user_show_special_status.csv"]
    ? parseSpecialStatus(extracted.files["user_show_special_status.csv"])
    : [];

  const granularFiles = ["watched_on_episode.csv", "rewatched_episode.csv", "seen_episode_latest.csv"] as const;
  const granular = granularFiles.flatMap((file) => {
    const content = extracted.files[file];
    if (!content) return [];
    const parsed = parseGranularEpisodes(content);
    diagnostics?.onFileParsed?.(file, parsed.length);
    return parsed;
  });

  diagnostics?.onFileParsed?.("followed_tv_show.csv", followed.length);
  diagnostics?.onFileParsed?.("user_tv_show_data.csv", progress.length);
  diagnostics?.onFileParsed?.("user_show_special_status.csv", specialStatus.length);

  const progressById = new Map(progress.map((entry) => [entry.tvShowId, entry]));
  const forLaterIds = new Set(specialStatus.filter((entry) => isForLaterStatus(entry.status)).map((e) => e.tvShowId));

  // Granular só tem nome, não id — agrupa por nome normalizado.
  const granularByName = new Map<string, GranularEpisodeSignal[]>();
  for (const episode of granular) {
    const key = episode.tvShowName.trim().toLowerCase();
    const list = granularByName.get(key) ?? [];
    list.push({ seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber });
    granularByName.set(key, list);
  }

  const shows: ParsedShow[] = followed.map((show) => {
    const progressEntry = progressById.get(show.tvShowId);
    const nameKey = show.name.trim().toLowerCase();

    return {
      tvTimeId: show.tvShowId,
      name: show.name,
      year: null,
      totalWatchEvents: progressEntry?.totalWatchEvents ?? 0,
      isFavorite: progressEntry?.isFavorite ?? false,
      isExplicitlyForLater: forLaterIds.has(show.tvShowId),
      knownEpisodes: granularByName.get(nameKey) ?? [],
    };
  });

  const favoriteCount = shows.filter((show) => show.isFavorite).length;
  const totalSeen = shows.reduce((sum, show) => sum + show.totalWatchEvents, 0);

  console.log(
    `[tvtime-import] ${shows.length} séries encontradas, ${totalSeen} episódios vistos (contagem agregada), ${favoriteCount} favoritos`
  );

  return { shows, favoriteCount, missingFiles };
}
