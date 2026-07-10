import type { MediaSearchResult } from "@seenlist/types";
import { normalizeName } from "./scoring";

/**
 * Item 3 — cache em memória, só dura o tempo da importação (não
 * precisa persistir em lugar nenhum: é só pra não repetir a mesma
 * busca de "Smallville" 40 vezes seguidas no mesmo processo).
 */
const cache = new Map<string, Promise<MediaSearchResult[]>>();

export function cachedSeriesSearch(
  name: string,
  fetcher: (name: string) => Promise<MediaSearchResult[]>
): Promise<MediaSearchResult[]> {
  const key = normalizeName(name);
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = fetcher(name);
  cache.set(key, promise);
  return promise;
}

export function clearSearchCache() {
  cache.clear();
}
