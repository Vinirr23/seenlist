export interface SeasonForEligibility {
  seasonNumber: number;
  episodes: { episodeNumber: number }[];
}

/**
 * TASK (Resumo da Temporada) — lógica da seção 3 da auditoria: decide,
 * só com o que já está carregado na tela de série (sem chamada nova),
 * se existe uma temporada anterior recém-concluída pra mostrar o card.
 *
 * Regra (exatamente a da auditoria): pra cada par de temporadas
 * adjacentes (N-1, N), mostra o card da N-1 quando o usuário ainda não
 * assistiu NADA da N e já assistiu TODA a N-1 (e a N-1 tem episódios
 * catalogados).
 *
 * V1 é só temporada 100% concluída — "Resumo até aqui" (usuário no
 * meio de uma temporada) é escopo futuro, deliberadamente de fora
 * aqui (ver seção 3/13 da auditoria).
 */
export function findCompletedPreviousSeason(
  seasons: SeasonForEligibility[],
  isWatched: (seasonNumber: number, episodeNumber: number) => boolean
): { seasonNumber: number } | null {
  const sorted = seasons.filter((s) => s.seasonNumber >= 1).sort((a, b) => a.seasonNumber - b.seasonNumber);

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const previous = sorted[i - 1]!;
    if (previous.episodes.length === 0) continue;

    const watchedInCurrent = current.episodes.filter((ep) => isWatched(current.seasonNumber, ep.episodeNumber)).length;
    const watchedInPrevious = previous.episodes.filter((ep) => isWatched(previous.seasonNumber, ep.episodeNumber)).length;

    if (watchedInCurrent === 0 && watchedInPrevious === previous.episodes.length) {
      return { seasonNumber: previous.seasonNumber };
    }
  }
  return null;
}
