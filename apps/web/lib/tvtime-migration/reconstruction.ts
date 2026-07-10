import type { ParsedEpisodeRow } from "../tvtime-out-import/parser/episodesParser";

export interface ReconstructedEpisodes {
  mainWatched: { seasonNumber: number; episodeNumber: number; watchedAt: string | null; rewatchCount: number }[];
  mainTotalInFile: number;
  specialsWatchedInFile: { seasonNumber: number; episodeNumber: number }[];
  specialsNotWatchedInFile: { seasonNumber: number; episodeNumber: number }[];
}

/**
 * TASK-035 — "reconstruir somente episódios principais. Ignorar
 * completamente reassistidas, estatísticas de reassistidas, horas
 * reassistidas." `rewatch_count` é carregado junto (pra estatística
 * futura, como a tarefa autoriza), mas NUNCA usado aqui pra decidir
 * quantos episódios existem ou quantos foram assistidos — isso é
 * sempre contagem de linhas únicas, uma vez cada.
 *
 * Especiais: só entram na lista "watched" se o arquivo disser
 * explicitamente `is_watched=true` — nunca inferido a partir de
 * nada. Os não-assistidos ficam separados pra pergunta ao usuário no
 * fim da importação.
 */
export function reconstructEpisodes(episodes: ParsedEpisodeRow[]): ReconstructedEpisodes {
  const main = episodes.filter((e) => !e.special);
  const specials = episodes.filter((e) => e.special);

  return {
    mainWatched: main
      .filter((e) => e.isWatched)
      .map((e) => ({
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        watchedAt: e.watchedAt,
        rewatchCount: e.rewatchCount,
      })),
    mainTotalInFile: main.length,
    specialsWatchedInFile: specials
      .filter((e) => e.isWatched)
      .map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })),
    specialsNotWatchedInFile: specials
      .filter((e) => !e.isWatched)
      .map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })),
  };
}
