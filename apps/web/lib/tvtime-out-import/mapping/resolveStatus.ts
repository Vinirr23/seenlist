import type { ParsedEpisodeRow } from "../parser/episodesParser";

export type SeriesResolvedStatus = "watching" | "want_to_watch" | "paused" | "up_to_date" | "completed";

export interface StatusValidationInput {
  fileStatus: string;
  watchedNonSpecialCount: number;
  totalNonSpecialInFile: number;
}

/**
 * TASK-033 (correção) — item 1: `up_to_date` não vira mais
 * `watching`. Preservado como conceito distinto ("Em dia") — só a
 * validação final (ver validateSeriesStatus.ts, chamada em
 * runImport.ts com dado ao vivo do TMDB) pode promover pra
 * `completed` (série encerrada + tudo assistido) ou rebaixar pra
 * `watching` (episódio novo lançado depois da exportação). Esta
 * função continua sendo só o mapeamento direto do arquivo — a
 * validação mora em outro módulo, de propósito, porque só ela tem
 * acesso a dado ao vivo (esta função não sabe nada de TMDB).
 */
export function resolveSeriesStatus(input: StatusValidationInput): SeriesResolvedStatus {
  const { fileStatus } = input;

  switch (fileStatus) {
    case "not_started_yet":
      return "want_to_watch";

    case "watch_later":
      return "want_to_watch";

    case "stopped":
      return "paused";

    case "continuing":
      return "watching";

    case "up_to_date":
      return "up_to_date";

    default:
      return input.watchedNonSpecialCount === 0 ? "want_to_watch" : "watching";
  }
}

export interface SeriesEpisodeCounts {
  watchedNonSpecialCount: number;
  totalNonSpecialInFile: number;
  specialCount: number;
}

export function countSeriesEpisodes(episodes: ParsedEpisodeRow[]): SeriesEpisodeCounts {
  const nonSpecial = episodes.filter((e) => !e.special);
  return {
    watchedNonSpecialCount: nonSpecial.filter((e) => e.isWatched).length,
    totalNonSpecialInFile: nonSpecial.length,
    specialCount: episodes.filter((e) => e.special).length,
  };
}
