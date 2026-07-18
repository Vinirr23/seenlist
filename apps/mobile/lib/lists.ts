import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

export interface UserList {
  id: string;
  name: string;
  createdAt: string;
}

export interface ListItem {
  id: string;
  mediaType: "movie" | "series";
  mediaId: number;
  title: string;
  posterPath: string | null;
}

/** Idêntico a useMyLists do web. */
export async function fetchMyLists(): Promise<UserList[]> {
  const { data, error } = await supabase.from("lists").select("id, name, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
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
export async function fetchListItems(listId: string): Promise<ListItem[]> {
  const { data: rows, error } = await supabase
    .from("list_items")
    .select("id, media_type, media_id, added_at")
    .eq("list_id", listId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const movieIds = rows.filter((r) => r.media_type === "movie").map((r) => r.media_id);
  const seriesIds = rows.filter((r) => r.media_type === "series").map((r) => r.media_id);
  const summaries = await fetchDisplaySummaries(movieIds, seriesIds);

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
