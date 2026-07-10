import { parseCsv, firstColumn, toNumberOrNull } from "./csv";

export interface RawTvShowProgress {
  tvShowId: string;
  name: string;
  totalWatchEvents: number;
  isFavorite: boolean;
}

const ID_ALIASES = ["tv_show_id"];
const NAME_ALIASES = ["tv_show_name"];
const SEEN_ALIASES = ["nb_episodes_seen"];
const FAVORITE_ALIASES = ["is_favorited"];

/**
 * TASK-027B — user_tv_show_data.csv. `nb_episodes_seen` é a fonte
 * PRINCIPAL de progresso agora (ver /docs/tvtime-gdpr-spec.md) — uma
 * contagem agregada, não uma lista de episódios específicos. Essa é
 * a mudança de estratégia central desta tarefa.
 */
export function parseTvShowProgress(csvContent: string): RawTvShowProgress[] {
  const { rows } = parseCsv(csvContent);
  return rows
    .map((row) => {
      const tvShowId = firstColumn(row, ID_ALIASES);
      const name = firstColumn(row, NAME_ALIASES);
      const totalWatchEvents = toNumberOrNull(firstColumn(row, SEEN_ALIASES));
      if (!tvShowId || !name || totalWatchEvents === null) return null;

      return {
        tvShowId,
        name,
        totalWatchEvents,
        isFavorite: firstColumn(row, FAVORITE_ALIASES) === "1",
      };
    })
    .filter((entry): entry is RawTvShowProgress => entry !== null);
}
