import { supabase } from "@/lib/supabase";

export async function fetchIsSaved(postId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.from("saved_posts").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleSavePost(postId: string, currentlySaved: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  if (currentlySaved) {
    const { error } = await supabase.from("saved_posts").delete().match({ user_id: user.id, post_id: postId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("saved_posts").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}
