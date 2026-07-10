import { useWatchedEpisodes, isEpisodeWatched } from "@/lib/queries/watched-episodes-state";

/**
 * TASK-031, "melhoria importante" — "o SeenList já conhece o
 * progresso do usuário". Literalmente verdade: não precisou de
 * coluna nem tabela nova, só reaproveitar `useWatchedEpisodes` (já
 * existe desde a tela de episódios da série). Interpretação da regra:
 * "assistiu até o episódio 5, abre o episódio 9" → oculta porque o
 * usuário NÃO assistiu especificamente o episódio 9 ainda — não
 * precisa reconstruir ordem cronológica pra isso, só checar se ESTE
 * episódio específico já foi marcado.
 *
 * Só entra em ação pra comentários DE EPISÓDIO (season/episode não
 * nulos) — comentário de série/filme inteiro não tem "progresso" pra
 * comparar contra, esses continuam usando só o `contains_spoiler`
 * manual.
 */
export function useSpoilerProtection(seriesId: number, seasonNumber: number, episodeNumber: number) {
  const { data: watched, isLoading } = useWatchedEpisodes(seriesId);

  const hasWatchedThisEpisode = isEpisodeWatched(watched, seasonNumber, episodeNumber);

  return {
    isLoading,
    /** true = oculta os comentários por padrão, mostrando o aviso. */
    shouldHideByDefault: !isLoading && !hasWatchedThisEpisode,
  };
}
