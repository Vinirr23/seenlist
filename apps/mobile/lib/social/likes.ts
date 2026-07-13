import { supabase } from "@/lib/supabase";

export type LikeTargetType = "post" | "post_comment" | "review" | "list";

export async function fetchLikeCount(targetType: LikeTargetType, targetId: string): Promise<number> {
  const { count, error } = await supabase
    .from("likes")
    .select("id", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) {
    console.error("[social/likes] Falha ao contar curtidas", error);
    throw error;
  }
  return count ?? 0;
}

export async function fetchHasLiked(targetType: LikeTargetType, targetId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("likes")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[social/likes] Falha ao checar curtida", error);
    throw error;
  }
  return Boolean(data);
}

export async function toggleLike(targetType: LikeTargetType, targetId: string, currentlyLiked: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyLiked) {
    const { error } = await supabase.from("likes").delete().match({ user_id: user.id, target_type: targetType, target_id: targetId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("likes")
      .upsert({ user_id: user.id, target_type: targetType, target_id: targetId }, { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

export async function fetchPostCommentCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from("post_comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId)
    .is("deleted_at", null);
  if (error) {
    console.error("[post-comments] Falha ao contar comentários", error);
    throw error;
  }
  return count ?? 0;
}
