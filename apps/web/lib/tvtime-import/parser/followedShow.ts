import { parseCsv, firstColumn } from "./csv";

export interface RawFollowedShow {
  tvShowId: string;
  name: string;
}

const ID_ALIASES = ["tv_show_id"];
const NAME_ALIASES = ["tv_show_name"];

/**
 * TASK-027B — followed_tv_show.csv, confirmado por inspeção real
 * (ver /docs/tvtime-gdpr-spec.md). Colunas reais incluem também
 * `active`/`archived`, que existem mas cuja correlação com
 * status real (pausada/concluída) não é confiável — de propósito,
 * este parser não lê essas colunas pra nada.
 */
export function parseFollowedShows(csvContent: string): RawFollowedShow[] {
  const { rows } = parseCsv(csvContent);
  return rows
    .map((row) => {
      const tvShowId = firstColumn(row, ID_ALIASES);
      const name = firstColumn(row, NAME_ALIASES);
      if (!tvShowId || !name) return null;
      return { tvShowId, name };
    })
    .filter((show): show is RawFollowedShow => show !== null);
}
