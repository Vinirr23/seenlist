import { parseCsv, firstColumn, toNumberOrNull } from "../../tvtime-import/parser/csv";

/**
 * TASK-027L — colunas confirmadas: uuid, tvdb_id, imdb_id, title,
 * year, created_at, watched_at, is_watched, rewatch_count. Diferente
 * de séries, aqui `imdb_id` VEM preenchido no export real (formato
 * "tt1234567") — o TMDB tem endpoint de find por imdb_id nativo,
 * então filmes têm um caminho de matching mais direto que séries.
 */
export interface ParsedMovieFileRow {
  uuid: string;
  tvdbId: string | null;
  imdbId: string | null;
  title: string;
  year: number | null;
  createdAt: string | null;
  watchedAt: string | null;
  isWatched: boolean;
  rewatchCount: number;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function parseMoviesFile(content: string): ParsedMovieFileRow[] {
  const { rows } = parseCsv(content);
  const result: ParsedMovieFileRow[] = [];

  for (const row of rows) {
    const uuid = firstColumn(row, ["uuid"]);
    const title = firstColumn(row, ["title"]);
    if (!uuid || !title) continue;

    result.push({
      uuid,
      tvdbId: firstColumn(row, ["tvdb_id"]) || null,
      imdbId: firstColumn(row, ["imdb_id"]) || null,
      title,
      year: toNumberOrNull(firstColumn(row, ["year"])),
      createdAt: firstColumn(row, ["created_at"]) || null,
      watchedAt: firstColumn(row, ["watched_at"]) || null,
      isWatched: parseBoolean(firstColumn(row, ["is_watched"])),
      rewatchCount: toNumberOrNull(firstColumn(row, ["rewatch_count"])) ?? 0,
    });
  }

  return result;
}
