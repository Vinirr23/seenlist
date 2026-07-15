import { supabase, getCurrentAuthUser } from "@/lib/supabase";

export type LikeTargetType = "post" | "post_comment" | "comment" | "review" | "list";

/**
 * TASK-153 (correção — Feed lento, cada post buscando curtida
 * sozinho) — em vez de uma consulta de contagem + uma de "já
 * curti" POR ITEM, busca todas as curtidas dos itens visíveis de
 * uma vez (1 consulta só) e conta/verifica no aparelho mesmo.
 */
export async function fetchLikeInfoFor(targetType: LikeTargetType, targetIds: string[]): Promise<Map<string, { count: number; hasLiked: boolean }>> {
  const result = new Map<string, { count: number; hasLiked: boolean }>();
  if (targetIds.length === 0) return result;

  const {
    data: { user },
  } = await getCurrentAuthUser();

  const { data, error } = await supabase.from("likes").select("target_id, user_id").eq("target_type", targetType).in("target_id", targetIds);
  if (error) {
    console.error("[social/likes] Falha ao buscar curtidas em lote", error);
    throw error;
  }

  for (const row of data ?? []) {
    const current = result.get(row.target_id) ?? { count: 0, hasLiked: false };
    current.count += 1;
    if (user && row.user_id === user.id) current.hasLiked = true;
    result.set(row.target_id, current);
  }
  return result;
}

/** TASK-153 — mesma ideia, pra contagem de comentário de post (1 consulta pra todos os posts visíveis, não uma por post). */
export async function fetchCommentCountsFor(postIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (postIds.length === 0) return result;

  const { data, error } = await supabase.from("post_comments").select("post_id").in("post_id", postIds).is("deleted_at", null);
  if (error) {
    console.error("[post-comments] Falha ao contar comentários em lote", error);
    throw error;
  }
  for (const row of data ?? []) {
    result.set(row.post_id, (result.get(row.post_id) ?? 0) + 1);
  }
  return result;
}

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
  } = await getCurrentAuthUser();
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
  } = await getCurrentAuthUser();
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
