import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MediaSearchResult } from "@seenlist/types";
import { supabase } from "@/lib/supabase";

const HISTORY_KEY = "seenlist:search-history";
const HISTORY_LIMIT = 8;

/**
 * CONTINUAÇÃO DA FASE 1 (migração mobile sem Vercel, 2026-10-20) —
 * passou a chamar a operação "search" da Supabase Edge Function
 * `tmdb-catalog` em vez da rota Vercel `/api/search`. MESMO contrato
 * de saída (`{ results }`) — ver `supabase/functions/tmdb-catalog/index.ts`.
 */
export async function fetchSearchResults(query: string, language = "pt-BR"): Promise<MediaSearchResult[]> {
  const { data, error } = await supabase.functions.invoke("tmdb-catalog", {
    body: { operation: "search", query, language },
  });
  if (error) throw new Error("search failed");
  const body = data as { results: MediaSearchResult[] };
  return body.results;
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
