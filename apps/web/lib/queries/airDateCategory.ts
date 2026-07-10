export interface LiveEpisodeAirDate {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
}

export interface AirDateDecision {
  category: "watching" | "up_to_date";
  reason: string;
}

/**
 * TASK-043 — extraído da lógica de importação (TASK-042) pra ser
 * reutilizado fora dela também. Achado real: marcar episódio direto
 * na tela (fora da importação) nunca recalculava categoria nenhuma —
 * só a importação decidia "Assistindo" vs "Em dia", então séries que
 * o usuário terminava de assistir manualmente (Rancho Dutton,
 * Demolidor, Dexter) ficavam presas em "Assistindo" pra sempre.
 *
 * Só decide entre os dois — quem chama decide SE essa distinção se
 * aplica. TASK-061: agora também é chamada pra séries em
 * "want_to_watch" (promoção no primeiro episódio marcado) — só
 * "paused" continua de fora, por ser decisão explícita do usuário.
 */
export function decideWatchingVsUpToDate(
  mainEpisodesWatched: number,
  liveEpisodes: LiveEpisodeAirDate[],
  specialEpisodeKeys: Set<string> = new Set()
): AirDateDecision {
  const nonSpecialLiveEpisodes = liveEpisodes.filter(
    (e) => !specialEpisodeKeys.has(`${e.seasonNumber}-${e.episodeNumber}`)
  );
  const today = new Date().toISOString().slice(0, 10);
  const airedByNow = nonSpecialLiveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today);
  const hasUnwatchedAiredEpisode = mainEpisodesWatched < airedByNow.length;

  if (hasUnwatchedAiredEpisode) {
    return {
      category: "watching",
      reason: `${airedByNow.length - mainEpisodesWatched} episódio(s) já lançado(s) (air_date <= ${today}) ainda não assistido(s).`,
    };
  }
  return {
    category: "up_to_date",
    reason: `Todos os ${airedByNow.length} episódios já lançados até ${today} foram assistidos.`,
  };
}
