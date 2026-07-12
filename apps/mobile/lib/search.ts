import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MediaSearchResult } from "@seenlist/types";

const SITE_URL = "https://seenlist.app";
const HISTORY_KEY = "seenlist:search-history";
const HISTORY_LIMIT = 8;

/** Idêntico ao lib/queries/search.ts do web — mesma rota, mesmo formato de resposta. */
export async function fetchSearchResults(query: string): Promise<MediaSearchResult[]> {
  const response = await fetch(`${SITE_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("search failed");
  const data = (await response.json()) as { results: MediaSearchResult[] };
  return data.results;
}

/**
 * TASK-094 (Explorar nativa) — mesmo histórico de 8 buscas do
 * `SearchBar.tsx` do web, só trocando `localStorage` (não existe em
 * React Native) por `AsyncStorage` — daí as funções serem
 * assíncronas aqui, diferente do web.
 */
export async function readSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function writeSearchHistory(history: string[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/** Adiciona no topo, sem duplicar (ignora maiúscula/minúscula), no máximo 8 — mesma regra do web. */
export async function addSearchHistoryTerm(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return readSearchHistory();
  const current = (await readSearchHistory()).filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
  const next = [trimmed, ...current].slice(0, HISTORY_LIMIT);
  await writeSearchHistory(next);
  return next;
}

export async function removeSearchHistoryTerm(term: string): Promise<string[]> {
  const next = (await readSearchHistory()).filter((t) => t !== term);
  await writeSearchHistory(next);
  return next;
}
