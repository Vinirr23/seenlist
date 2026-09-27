import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

export interface UserList {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * CACHE DE MÓDULO (2026-09-27, Etapa 3 — bug real reportado: "quando
 * entro nas bibliotecas... minhas listas... recarrega") — `app/lists/
 * index.tsx` é uma rota de PRIMEIRO NÍVEL (fora de `(tabs)`), então
 * desmonta de verdade sempre que você sai e volta — sem cache nenhum,
 * `useMyLists` refazia a busca do zero (com esqueleto) toda vez.
 *
 * Mesmo padrão já validado nesta auditoria pra `movieDetails.ts`/
 * `seriesDetails.ts` (`peekCachedMovieDetails`/`peekCachedSeriesDetails`):
 * TTL curto (5 min — as próprias listas mudam pouco, e criar/remover
 * lista já chama `refetch()` explicitamente, então não depende do TTL
 * pra ficar em dia), e o hook consumidor decide ANTES de mostrar
 * esqueleto se já tem algo em cache pra mostrar na hora.
 *
 * Chave por `userId` (não é dado global como `useDiscoverList` — é a
 * lista de UMA pessoa) — sem isso, trocar de conta no mesmo aparelho
 * sem reiniciar o app poderia mostrar as listas da conta anterior.
 */
const MY_LISTS_CACHE_TTL_MS = 5 * 60 * 1000;
let myListsCache: { userId: string; data: UserList[]; expiresAt: number } | null = null;

export function peekCachedMyLists(userId: string): UserList[] | null {
  return myListsCache && myListsCache.userId === userId && myListsCache.expiresAt > Date.now()
    ? myListsCache.data
    : null;
}

export interface ListItem {
  id: string;
  mediaType: "movie" | "series";
  mediaId: number;
  title: string;
  posterPath: string | null;
}

export interface ListWithPreview extends UserList {
  previewPosters: (string | null)[];
  itemCount: number;
}

/** Idêntico a useMyLists do web. */
export async function fetchMyLists(): Promise<UserList[]> {
  const { data, error } = await supabase.from("lists").select("id, name, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  const result = (data ?? []).map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (user) {
    myListsCache = { userId: user.id, data: result, expiresAt: Date.now() + MY_LISTS_CACHE_TTL_MS };
  }

  return result;
}

/** Idêntico a useCreateList do web. */
export async function createList(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("lists").insert({ user_id: user.id, name: trimmed });
  if (error) throw error;
}

/** Idêntico a useAddToList do web — upsert ignora duplicata (mesmo item não entra duas vezes na mesma lista). */
export async function addToList(listId: string, mediaType: "movie" | "series", mediaId: number): Promise<void> {
  const { error } = await supabase
    .from("list_items")
    .upsert({ list_id: listId, media_type: mediaType, media_id: mediaId }, { onConflict: "list_id,media_type,media_id", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * TASK-172 (achado real — mesmo do web) — faltava desde sempre: dava
 * pra criar lista e adicionar item, mas nunca pra ver o que tinha
 * dentro. Junta `list_items` com o resumo do TMDB (título/pôster).
 */
export async function fetchListItems(listId: string, language = "pt-BR"): Promise<ListItem[]> {
  const { data: rows, error } = await supabase
    .from("list_items")
    .select("id, media_type, media_id, added_at")
    .eq("list_id", listId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const movieIds = rows.filter((r) => r.media_type === "movie").map((r) => r.media_id);
  const seriesIds = rows.filter((r) => r.media_type === "series").map((r) => r.media_id);
  const summaries = await fetchDisplaySummaries(movieIds, seriesIds, language);

  return rows.map((row) => {
    const summary = row.media_type === "movie" ? summaries.movies[row.media_id] : summaries.series[row.media_id];
    return {
      id: row.id,
      mediaType: row.media_type as "movie" | "series",
      mediaId: row.media_id,
      title: summary?.title ?? (row.media_type === "movie" ? `Filme #${row.media_id}` : `Série #${row.media_id}`),
      posterPath: summary?.posterPath ?? null,
    };
  });
}

export async function removeFromList(itemId: string): Promise<void> {
  const { error } = await supabase.from("list_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw error;
}

/**
 * Porta de `useMyListsWithPreview` do web — "Minhas listas" com
 * efeito baralho (até 4 pôsteres mais recentes por lista, o resto só
 * conta pra `itemCount`). Uma única consulta busca os itens de TODAS
 * as listas de uma vez (não uma consulta por lista), evitando N+1.
 */
export async function fetchMyListsWithPreview(language = "pt-BR"): Promise<ListWithPreview[]> {
  const { data: lists, error } = await supabase.from("lists").select("id, name, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  if (!lists || lists.length === 0) return [];

  const listIds = lists.map((l) => l.id);
  const { data: allItems, error: itemsError } = await supabase
    .from("list_items")
    .select("list_id, media_type, media_id, added_at")
    .in("list_id", listIds)
    .order("added_at", { ascending: false });
  if (itemsError) throw itemsError;

  const previewItemsByList = new Map<string, { media_type: "movie" | "series"; media_id: number }[]>();
  const countByList = new Map<string, number>();
  for (const item of allItems ?? []) {
    countByList.set(item.list_id, (countByList.get(item.list_id) ?? 0) + 1);
    const bucket = previewItemsByList.get(item.list_id) ?? [];
    if (bucket.length < 4) {
      bucket.push({ media_type: item.media_type as "movie" | "series", media_id: item.media_id });
      previewItemsByList.set(item.list_id, bucket);
    }
  }

  const movieIds: number[] = [];
  const seriesIds: number[] = [];
  for (const items of previewItemsByList.values()) {
    for (const item of items) {
      if (item.media_type === "movie") movieIds.push(item.media_id);
      else seriesIds.push(item.media_id);
    }
  }
  const { movies, series } = await fetchDisplaySummaries(movieIds, seriesIds, language);

  return lists.map((list) => {
    const items = previewItemsByList.get(list.id) ?? [];
    const previewPosters = items.map((item) => {
      const summary = item.media_type === "movie" ? movies[item.media_id] : series[item.media_id];
      return summary?.posterPath ?? null;
    });
    return {
      id: list.id,
      name: list.name,
      createdAt: list.created_at,
      previewPosters,
      itemCount: countByList.get(list.id) ?? 0,
    };
  });
}
