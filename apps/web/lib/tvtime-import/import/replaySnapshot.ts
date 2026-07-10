import type { ShowMatch } from "../mapping/types";
import type { SeasonSummary } from "../mapping/reconstructProgress";

const STORAGE_KEY = "seenlist:tvtime-import:replay-snapshot";

export interface ReplaySnapshot {
  matches: ShowMatch[];
  seasonSummaries: [number, SeasonSummary][];
  savedAt: string;
}

/**
 * TASK-027K, "melhoria adicionada" — salva o estado logo ANTES da
 * gravação no banco (depois de parsear o ZIP, casar com o TMDB e
 * buscar a estrutura de temporadas — as três etapas caras/lentas).
 * Guardado no localStorage, mesmo padrão já usado em
 * pendingStorage.ts — mesma limitação conhecida: não sincroniza
 * entre dispositivos, e se o navegador for limpo antes de usar o
 * replay, o snapshot se perde (aceitável, é ferramenta de depuração
 * local, não dado do usuário).
 */
export function saveReplaySnapshot(matches: ShowMatch[], seasonSummaries: Map<number, SeasonSummary>): void {
  try {
    const snapshot: ReplaySnapshot = {
      matches,
      seasonSummaries: [...seasonSummaries.entries()],
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    console.log(
      `[tvtime-import] Snapshot de replay salvo (${matches.length} séries, ${seasonSummaries.size} estruturas de temporada) — dá pra repetir reconstrução+gravação sem reimportar o ZIP nem consultar o TMDB de novo.`
    );
  } catch (error) {
    console.error("[tvtime-import] Falha ao salvar snapshot de replay (não afeta a importação em si)", error);
  }
}

export function loadReplaySnapshot(): { matches: ShowMatch[]; seasonSummaries: Map<number, SeasonSummary> } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as ReplaySnapshot;
    return { matches: snapshot.matches, seasonSummaries: new Map(snapshot.seasonSummaries) };
  } catch (error) {
    console.error("[tvtime-import] Falha ao carregar snapshot de replay", error);
    return null;
  }
}

export function hasReplaySnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearReplaySnapshot(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
