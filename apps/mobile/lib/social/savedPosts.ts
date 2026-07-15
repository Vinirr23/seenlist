import { supabase, getCurrentAuthUser } from "@/lib/supabase";

/** TASK-153 — mesma ideia do fetchLikeInfoFor: 1 consulta pra todos os posts visíveis, não uma por post. */
export async function fetchSavedStatusesFor(postIds: string[]): Promise<Set<string>> {
  const result = new Set<string>();
  if (postIds.length === 0) return result;

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return result;

  const { data, error } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds);
  if (error) throw error;
  for (const row of data ?? []) result.add(row.post_id);
  return result;
}

export async function fetchIsSaved(postId: string): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase.from("saved_posts").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleSavePost(postId: string, currentlySaved: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlySaved) {
    const { error } = await supabase.from("saved_posts").delete().match({ user_id: user.id, post_id: postId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("saved_posts").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}
