import type { ShowMatch } from "./mapping/types";

const STORAGE_KEY = "seenlist:tvtime-import:pending";

/**
 * TASK-027.5 — "as séries pendentes ficam para depois... nunca
 * bloquear a importação". Guardado no navegador, não no Supabase:
 * é um estado transitório de UM fluxo de importação, não dado do
 * usuário que precisa sincronizar entre dispositivos. Se o usuário
 * limpar o navegador antes de resolver, perde as pendências — uma
 * limitação aceitável dado que a alternativa seria criar uma tabela
 * só pra isso.
 */
export function savePendingMatches(matches: ShowMatch[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  } catch (error) {
    console.error("[tvtime-import] Falha ao guardar pendências localmente", error);
  }
}

export function loadPendingMatches(): ShowMatch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShowMatch[]) : [];
  } catch (error) {
    console.error("[tvtime-import] Falha ao ler pendências guardadas", error);
    return [];
  }
}

export function clearPendingMatches(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function countPendingMatches(): number {
  return loadPendingMatches().length;
}
