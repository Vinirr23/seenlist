import { parseCsv, firstColumn } from "../../tvtime-import/parser/csv";

/**
 * TASK-027L — colunas confirmadas contra um export REAL da extensão
 * "TV Time Out" (tvtime-series-*.csv): uuid, tvdb_id, imdb_id, title,
 * status, created_at. Diferente do parser do GDPR (que nunca viu um
 * arquivo real quando foi escrito), este já nasce verificado.
 *
 * Achado real que vale registrar aqui: no arquivo de teste, 432 de
 * 432 séries têm tvdb_id preenchido e 0 têm imdb_id — o cruzamento
 * por IMDb (item 2 da cascata de matching) é implementado mesmo
 * assim, defensivamente, mas pode nunca ser exercido na prática.
 */
export type TvTimeOutSeriesStatus = "up_to_date" | "stopped" | "continuing" | "watch_later" | "not_started_yet";

export interface ParsedSeriesFileRow {
  uuid: string;
  tvdbId: string | null;
  imdbId: string | null;
  title: string;
  /** Valor bruto do arquivo — valores além dos 5 confirmados no export real são preservados como string, nunca descartados silenciosamente. */
  status: string;
  createdAt: string | null;
}

export function parseSeriesFile(content: string): ParsedSeriesFileRow[] {
  const { rows } = parseCsv(content);
  const result: ParsedSeriesFileRow[] = [];

  for (const row of rows) {
    const uuid = firstColumn(row, ["uuid"]);
    const title = firstColumn(row, ["title"]);
    if (!uuid || !title) continue;

    result.push({
      uuid,
      tvdbId: firstColumn(row, ["tvdb_id"]) || null,
      imdbId: firstColumn(row, ["imdb_id"]) || null,
      title,
      status: firstColumn(row, ["status"]) ?? "",
      createdAt: firstColumn(row, ["created_at"]) || null,
    });
  }

  return result;
}
