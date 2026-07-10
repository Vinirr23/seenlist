import { parseCsv, firstColumn, toNumberOrNull } from "./csv";

export interface RawGranularEpisode {
  tvShowName: string;
  seasonNumber: number;
  episodeNumber: number;
}

const NAME_ALIASES = ["tv_show_name"];
const SEASON_ALIASES = ["episode_season_number"];
const EPISODE_ALIASES = ["episode_number"];

/**
 * TASK-027B — usado para watched_on_episode.csv, rewatched_episode.csv
 * e seen_episode_latest.csv — os três únicos arquivos confirmados que
 * trazem temporada+episódio diretamente (ver /docs/tvtime-gdpr-spec.md).
 * `show_seen_episode_latest.csv` NÃO entra aqui: só tem `episode_id`,
 * sem número de temporada/episódio, e não existe no export nenhuma
 * tabela para resolver esse id.
 *
 * Estes três arquivos, JUNTOS, cobrem uma fração pequena da biblioteca
 * (confirmado: ~4% das séries com progresso, no arquivo inspecionado).
 * Nunca são a fonte principal — servem só para desambiguação (ver
 * disambiguateByHistory.ts) e como checagem cruzada de confiança (ver
 * reconstructProgress.ts).
 */
export function parseGranularEpisodes(csvContent: string): RawGranularEpisode[] {
  const { rows } = parseCsv(csvContent);
  return rows
    .map((row) => {
      const tvShowName = firstColumn(row, NAME_ALIASES);
      const seasonNumber = toNumberOrNull(firstColumn(row, SEASON_ALIASES));
      const episodeNumber = toNumberOrNull(firstColumn(row, EPISODE_ALIASES));
      if (!tvShowName || seasonNumber === null || episodeNumber === null) return null;
      return { tvShowName, seasonNumber, episodeNumber };
    })
    .filter((entry): entry is RawGranularEpisode => entry !== null);
}
