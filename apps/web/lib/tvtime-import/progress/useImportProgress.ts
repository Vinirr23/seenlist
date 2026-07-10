import { useState } from "react";

export interface StepProgress {
  done: number;
  total: number;
  currentLabel: string | null;
}

const INITIAL: StepProgress = { done: 0, total: 0, currentLabel: null };

/**
 * Usado tanto na etapa de "buscando no TMDB" quanto na de
 * "importando" — as duas precisam da mesma forma de acompanhar
 * "quantas de quantas, processando X agora" (itens 6 e 9 da tarefa).
 */
export function useImportProgress() {
  const [progress, setProgress] = useState<StepProgress>(INITIAL);

  function reset(total: number) {
    setProgress({ done: 0, total, currentLabel: null });
  }

  function update(done: number, currentLabel?: string) {
    setProgress((current) => ({ ...current, done, currentLabel: currentLabel ?? current.currentLabel }));
  }

  const percentage = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return { progress, percentage, reset, update };
}
