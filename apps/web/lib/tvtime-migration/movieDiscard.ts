import type { ParsedMovieFileRow } from "../tvtime-out-import/parser/moviesParser";
import type { DiscardedSeries } from "./types";

export function filterDiscardedMovies(rows: ParsedMovieFileRow[]): {
  kept: ParsedMovieFileRow[];
  discarded: DiscardedSeries[];
} {
  const kept: ParsedMovieFileRow[] = [];
  const discarded: DiscardedSeries[] = [];

  for (const row of rows) {
    if (!row.uuid) {
      discarded.push({ uuid: "", title: row.title || "(sem título)", reason: "Registro sem uuid — inválido." });
      continue;
    }
    if (!row.title || !row.title.trim()) {
      discarded.push({ uuid: row.uuid, title: "(sem título)", reason: "Registro sem título." });
      continue;
    }
    if (!row.tvdbId && !row.imdbId) {
      discarded.push({
        uuid: row.uuid,
        title: row.title,
        reason: "Sem identificador suficiente — tvdb_id e imdb_id ambos ausentes.",
      });
      continue;
    }
    kept.push(row);
  }

  return { kept, discarded };
}
