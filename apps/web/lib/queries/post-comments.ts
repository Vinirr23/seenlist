import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  parentCommentId: string | null;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

function queryKey(postId: string) {
  return ["post-comments", postId] as const;
}

/** TASK-073 — contagem só (sem baixar os comentários), pro número aparecer sempre no card do Feed, igual à curtida — mesmo padrão de `useCommentCount` (comments de mídia). `initial`: mesma ideia de `useLikeCount` — quando o Feed já buscou em lote, não busca de novo. */
export function usePostCommentCount(postId: string, initial?: number) {
  return useQuery({
    queryKey: [...queryKey(postId), "count"],
    initialData: initial,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", postId)
        .is("deleted_at", null);
      if (error) {
        console.error("[post-comments] Falha ao contar comentários", describeSupabaseError(error));
        throw error;
      }
      return count ?? 0;
    },
    enabled: Boolean(postId),
  });
}

/** AUDITORIA — mesma ideia de `useLikeInfoBatch`: 1 consulta pra contar comentários de todos os posts visíveis, não uma por post. `count("exact", head: true)` não serve aqui porque precisamos do total POR post, não um total geral — busca só `post_id` de cada comentário não apagado e conta em memória (leve: nenhum outro campo baixado). */
export function useCommentCountsBatch(postIds: string[]) {
  return useQuery({
    queryKey: ["post-comment-counts-batch", postIds.slice().sort().join(",")] as const,
    queryFn: async (): Promise<Map<string, number>> => {
      const result = new Map<string, number>();
      if (postIds.length === 0) return result;

      const supabase = createClient();
      const { data, error } = await supabase.from("post_comments").select("post_id").in("post_id", postIds).is("deleted_at", null);
      if (error) {
        console.error("[post-comments] Falha ao contar comentários em lote", describeSupabaseError(error));
        throw error;
      }
      for (const row of data ?? []) {
        result.set(row.post_id, (result.get(row.post_id) ?? 0) + 1);
      }
      return result;
    },
    enabled: postIds.length > 0,
  });
}

/**
 * TASK-059 (fase 3) — comentários de post. Mesma estrutura em árvore
 * (parent_comment_id) que os comentários de mídia já usam
 * (social/comments.ts), mas SEM oclusão de spoiler — um post não tem
 * temporada/episódio associado do mesmo jeito, então esse conceito
 * simplesmente não se aplica aqui. Perfis buscados à parte, mesmo
 * padrão de posts.ts/activity-feed.ts.
 */
export function usePostComments(postId: string) {
  return useQuery({
    queryKey: queryKey(postId),
    queryFn: async (): Promise<PostComment[]> => {
      const supabase = createClient();

      const { data: rows, error } = await supabase
        .from("post_comments")
        .select("id, post_id, user_id, parent_comment_id, body, created_at")
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[post-comments] Falha ao buscar comentários", describeSupabaseError(error));
        throw error;
      }

      const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds)
        : { data: [] };
      const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      return (rows ?? [])
        .map((row) => {
          const profile = profileById.get(row.user_id);
          if (!profile) return null;
          return {
            id: row.id,
            postId: row.post_id,
            userId: row.user_id,
            parentCommentId: row.parent_comment_id,
            authorName: profile.display_name || profile.username,
            authorUsername: profile.username,
            authorAvatarUrl: profile.avatar_url,
            body: row.body,
            createdAt: row.created_at,
          };
        })
        .filter((c): c is PostComment => c !== null);
    },
    enabled: Boolean(postId),
  });
}

export function useCreatePostComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ body, parentCommentId }: { body: string; parentCommentId?: string | null }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase
        .from("post_comments")
        .insert({ post_id: postId, user_id: user.id, body, parent_comment_id: parentCommentId ?? null });
      if (error) {
        console.error("[post-comments] Falha ao comentar", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(postId) });
    },
  });
}
