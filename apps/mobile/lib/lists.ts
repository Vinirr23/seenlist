import { supabase, getCurrentAuthUser } from "@/lib/supabase";

export interface UserList {
  id: string;
  name: string;
  createdAt: string;
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
