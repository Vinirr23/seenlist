import { parseCsv, firstColumn, toNumberOrNull } from "../../tvtime-import/parser/csv";

/**
 * TASK-027L — "não reconstruir episódios, utilizar diretamente
 * tvtime-series-episodes.csv". Colunas confirmadas contra o export
 * real: series_tvdb_id, series_imdb_id, series_uuid, title, season,
 * episode, tvdb_id, is_watched, watched_at, rewatch_count, special.
 *
 * Achado real importante: `special` é um flag POR EPISÓDIO, não só
 * por temporada — 89 dos 3297 episódios especiais do export de teste
 * estão em temporadas normais (season >= 1), não em season 0. O
 * filtro antigo (excluir temporada inteira 0) nunca pegaria esses.
 */
export interface ParsedEpisodeRow {
  seriesUuid: string;
  seriesTvdbId: string | null;
  seriesImdbId: string | null;
  seasonNumber: number;
  episodeNumber: number;
  tvdbEpisodeId: string | null;
  isWatched: boolean;
  watchedAt: string | null;
  rewatchCount: number;
  special: boolean;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function parseEpisodesFile(content: string): ParsedEpisodeRow[] {
  const { rows } = parseCsv(content);
  const result: ParsedEpisodeRow[] = [];

  for (const row of rows) {
    const seriesUuid = firstColumn(row, ["series_uuid"]);
    const seasonNumber = toNumberOrNull(firstColumn(row, ["season"]));
    const episodeNumber = toNumberOrNull(firstColumn(row, ["episode"]));
    if (!seriesUuid || seasonNumber === null || episodeNumber === null) continue;

    result.push({
      seriesUuid,
      seriesTvdbId: firstColumn(row, ["series_tvdb_id"]) || null,
      seriesImdbId: firstColumn(row, ["series_imdb_id"]) || null,
      seasonNumber,
      episodeNumber,
      tvdbEpisodeId: firstColumn(row, ["tvdb_id"]) || null,
      isWatched: parseBoolean(firstColumn(row, ["is_watched"])),
      watchedAt: firstColumn(row, ["watched_at"]) || null,
      rewatchCount: toNumberOrNull(firstColumn(row, ["rewatch_count"])) ?? 0,
      special: parseBoolean(firstColumn(row, ["special"])),
    });
  }

  return result;
}

export function groupEpisodesBySeriesUuid(episodes: ParsedEpisodeRow[]): Map<string, ParsedEpisodeRow[]> {
  const map = new Map<string, ParsedEpisodeRow[]>();
  for (const episode of episodes) {
    const list = map.get(episode.seriesUuid) ?? [];
    list.push(episode);
    map.set(episode.seriesUuid, list);
  }
  for (const [uuid, list] of map) {
    map.set(uuid, deduplicateBySeasonEpisode(list));
  }
  return map;
}

/**
 * TASK-027L (correção) — achado real, não hipotético: 115 combinações
 * (série, temporada, episódio) aparecem DUAS VEZES no export real,
 * porque o TVDB às vezes cadastra dois episódios distintos (tvdb_id
 * diferente) com o mesmo número de temporada/episódio — ex.: "Young
 * Justice" T3E2 tem uma versão normal (assistida) e uma versão
 * "especial" (não assistida) com o mesmo número. A chave primária de
 * `watched_episodes` é (usuário, série, temporada, episódio) — não
 * tem como guardar as duas sem mudar o schema, e um upsert com dois
 * itens colidindo no mesmo comando faz o Postgres rejeitar com "ON
 * CONFLICT DO UPDATE command cannot affect row a second time".
 *
 * Critério de desempate, nessa ordem: prefere a linha NÃO especial
 * (é a que deveria contar pra progresso); se persistir empate,
 * prefere a assistida; se persistir, fica com a primeira do arquivo.
 * Isso roda ANTES de contar e ANTES de gravar — as duas etapas usam a
 * mesma lista deduplicada, pra nunca ficarem incoerentes entre si.
 */
function deduplicateBySeasonEpisode(episodes: ParsedEpisodeRow[]): ParsedEpisodeRow[] {
  const bestByKey = new Map<string, ParsedEpisodeRow>();

  for (const episode of episodes) {
    const key = `${episode.seasonNumber}-${episode.episodeNumber}`;
    const current = bestByKey.get(key);
    if (!current) {
      bestByKey.set(key, episode);
      continue;
    }

    const currentScore = (current.special ? 0 : 2) + (current.isWatched ? 1 : 0);
    const candidateScore = (episode.special ? 0 : 2) + (episode.isWatched ? 1 : 0);
    if (candidateScore > currentScore) {
      bestByKey.set(key, episode);
    }
  }

  return [...bestByKey.values()];
}
