import type { SeriesResolvedStatus } from "./resolveStatus";

export interface EpisodeAirDate {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
}

export interface SeriesLiveTmdbData {
  /** Todos os episódios não-especiais da série, com data de exibição — vem de getAllEpisodesWithAirDates. */
  episodes: EpisodeAirDate[];
  ended: boolean;
}

export interface StatusValidationResult {
  status: SeriesResolvedStatus;
  reason: string | null;
  totalEpisodesAtExport: number;
  hasNewerEpisode: boolean;
}

/**
 * TASK-039 (correção) — causa raiz confirmada com dado real ("The
 * Walking Dead: Dead City", "O Senhor dos Anéis: Os Anéis de
 * Poder"): a regra anterior comparava contra `exportDate` — qualquer
 * episódio REGISTRADO no TMDB depois da exportação virava motivo pra
 * "watching", mesmo que esse episódio ainda não tivesse sido AO AR.
 * Uma temporada futura anunciada (air_date no futuro) não significa
 * que o usuário está atrasado — significa só que existe algo pra vir.
 *
 * A regra certa não usa o total absoluto do TMDB nem a data da
 * exportação pra decidir "watching" vs "up_to_date" — usa quantos
 * episódios já foram AO AR até HOJE (`air_date <= hoje`). Só um
 * episódio já lançado e não assistido justifica "watching"; um
 * episódio futuro nunca desqualifica "up_to_date".
 *
 * `exportDate`/`totalEpisodesAtExport` continuam existindo (outros
 * módulos de diagnóstico já consomem esse campo) — só deixaram de
 * decidir a categoria sozinhos.
 */
export function validateSeriesStatus(
  baseStatus: SeriesResolvedStatus,
  watchedNonSpecialCount: number,
  exportDate: string | null,
  liveTmdb: SeriesLiveTmdbData | null,
  specialEpisodeKeys?: Set<string>
): StatusValidationResult {
  if (!liveTmdb || liveTmdb.episodes.length === 0) {
    return { status: baseStatus, reason: null, totalEpisodesAtExport: 0, hasNewerEpisode: false };
  }

  const specials = specialEpisodeKeys ?? new Set<string>();
  const nonSpecialTmdbEpisodes = liveTmdb.episodes.filter(
    (e) => !specials.has(`${e.seasonNumber}-${e.episodeNumber}`)
  );

  const totalEpisodesAtExport = exportDate
    ? nonSpecialTmdbEpisodes.filter((e) => e.airDate !== null && e.airDate <= exportDate).length
    : 0;

  // Regra real: só conta episódio "pendente" quem JÁ FOI AO AR até hoje. Um episódio futuro/anunciado nunca entra nessa contagem.
  const today = new Date().toISOString().slice(0, 10);
  const episodesAiredByNow = nonSpecialTmdbEpisodes.filter((e) => e.airDate !== null && e.airDate <= today);
  const hasUnwatchedAiredEpisode = watchedNonSpecialCount < episodesAiredByNow.length;
  // Mantido só como dado de diagnóstico (outros módulos já leem esse campo) — não decide mais nada sozinho.
  const hasNewerEpisode = exportDate
    ? nonSpecialTmdbEpisodes.some((e) => e.airDate !== null && e.airDate > exportDate)
    : false;

  const fullyWatchedOverall =
    nonSpecialTmdbEpisodes.length > 0 && watchedNonSpecialCount >= nonSpecialTmdbEpisodes.length;

  if (liveTmdb.ended && fullyWatchedOverall && baseStatus !== "completed") {
    return {
      status: "completed",
      reason: `Série encerrada no TMDB e todos os ${nonSpecialTmdbEpisodes.length} episódios principais (não-especiais) assistidos — corrigido de "${baseStatus}" para "completed".`,
      totalEpisodesAtExport,
      hasNewerEpisode,
    };
  }

  if (baseStatus === "up_to_date" && hasUnwatchedAiredEpisode) {
    return {
      status: "watching",
      reason: `Existe(m) ${episodesAiredByNow.length - watchedNonSpecialCount} episódio(s) já lançado(s) (air_date <= ${today}) ainda não assistido(s) — corrigido para "watching".`,
      totalEpisodesAtExport,
      hasNewerEpisode,
    };
  }

  return { status: baseStatus, reason: null, totalEpisodesAtExport, hasNewerEpisode };
}
