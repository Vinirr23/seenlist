import type { CategoryResult, SeenListCategory } from "./types";
import { decideWatchingVsUpToDate, type LiveEpisodeAirDate } from "@/lib/queries/airDateCategory";

export type { LiveEpisodeAirDate };

const CSV_TO_CATEGORY: Record<string, SeenListCategory> = {
  continuing: "watching",
  watch_later: "want_to_watch",
  not_started_yet: "want_to_watch",
  stopped: "paused",
  up_to_date: "up_to_date",
};

/**
 * TASK-042/043 — bug real reportado com prova em tela: Reacher
 * (24/24 episódios já lançados assistidos, próximo é 2026-08-12,
 * futuro), "O Senhor dos Anéis: Os Anéis de Poder" (16/16 já
 * lançados, próximo 2026-11-11, futuro) e "Rancho Dutton" (9/9
 * assistidos) continuavam presos em "Assistindo" mesmo com tudo que
 * já saiu assistido. A decisão "Assistindo" vs "Em dia" propriamente
 * dita agora mora em decideWatchingVsUpToDate (compartilhada com a
 * recalculação ao vivo, TASK-043) — esta função só cuida do
 * mapeamento direto do arquivo e da promoção pra "completed".
 */
export function resolveCategory(
  csvStatus: string,
  mainEpisodesWatched: number,
  mainEpisodesTotal: number,
  seriesEnded: boolean,
  liveEpisodes: LiveEpisodeAirDate[] | null = null,
  specialEpisodeKeys: Set<string> = new Set()
): CategoryResult {
  const base = CSV_TO_CATEGORY[csvStatus];

  if (!base) {
    return {
      category: "want_to_watch",
      reason: `Status "${csvStatus}" não reconhecido — sem regra aplicável, mantido como padrão neutro.`,
    };
  }

  const nonSpecialLiveEpisodes = liveEpisodes
    ? liveEpisodes.filter((e) => !specialEpisodeKeys.has(`${e.seasonNumber}-${e.episodeNumber}`))
    : null;

  const totalKnown = nonSpecialLiveEpisodes ? nonSpecialLiveEpisodes.length : mainEpisodesTotal;
  const allEpisodesWatchedOverall = totalKnown > 0 && mainEpisodesWatched >= totalKnown;

  if (seriesEnded && allEpisodesWatchedOverall) {
    return {
      category: "completed",
      reason: `Série encerrada oficialmente e todos os ${totalKnown} episódios principais assistidos.`,
    };
  }

  if ((base === "watching" || base === "up_to_date") && liveEpisodes) {
    const decision = decideWatchingVsUpToDate(mainEpisodesWatched, liveEpisodes, specialEpisodeKeys);
    return decision;
  }

  return { category: base, reason: `Mapeamento direto do arquivo: "${csvStatus}".` };
}
