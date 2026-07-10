import type { ParsedSeriesFileRow } from "../tvtime-out-import/parser/seriesParser";
import type { DiscardedSeries } from "./types";

/**
 * TASK-035 — "descartar automaticamente: séries removidas, registros
 * inválidos, séries sem identificador suficiente". Verifica de
 * verdade, linha por linha, sem heurística nenhuma (só ausência
 * objetiva de dado).
 */
export function filterDiscardedSeries(rows: ParsedSeriesFileRow[]): {
  kept: ParsedSeriesFileRow[];
  discarded: DiscardedSeries[];
} {
  const kept: ParsedSeriesFileRow[] = [];
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
