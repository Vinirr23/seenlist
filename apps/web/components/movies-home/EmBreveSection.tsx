import { HomeEmptyState } from "../media/HomeEmptyState";

/**
 * TASK-020, item 1: "A aba Em Breve pode permanecer como
 * placeholder" — de propósito, sem lógica nenhuma ainda. Filmes não
 * têm uma data de estreia futura recorrente do mesmo jeito que
 * episódios de série têm (um filme já lançado não tem "próximo
 * episódio"); quando isso for definido, esta seção ganha conteúdo
 * real, do mesmo jeito que `series-home/EmBreveSection.tsx`.
 */
export function EmBreveSection() {
  return <HomeEmptyState message="Em breve — ainda não disponível para filmes." />;
}
