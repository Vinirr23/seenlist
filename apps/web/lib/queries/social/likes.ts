import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import type { LikeTargetType } from "./types";

function likeCountKey(targetType: LikeTargetType, targetId: string) {
  return ["like-count", targetType, targetId] as const;
}
function hasLikedKey(targetType: LikeTargetType, targetId: string) {
  return ["has-liked", targetType, targetId] as const;
}

/**
 * TASK-031 — "contadores públicos" via COUNT direto — não
 * denormalizado. Uma função só serve comentário, review ou lista;
 * muda só `targetType`.
 */
export function useLikeCount(targetType: LikeTargetType, targetId: string) {
  return useQuery({
    queryKey: likeCountKey(targetType, targetId),
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (error) {
        console.error("[social/likes] Falha ao contar curtidas", describeSupabaseError(error));
        throw error;
      }
      return count ?? 0;
    },
  });
}

export function useHasLiked(targetType: LikeTargetType, targetId: string) {
  return useQuery({
    queryKey: hasLikedKey(targetType, targetId),
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
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
        console.error("[social/likes] Falha ao checar curtida", describeSupabaseError(error));
        throw error;
      }
      return Boolean(data);
    },
  });
}

export function useToggleLike(targetType: LikeTargetType, targetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      if (currentlyLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .match({ user_id: user.id, target_type: targetType, target_id: targetId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .upsert(
            { user_id: user.id, target_type: targetType, target_id: targetId },
            { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: likeCountKey(targetType, targetId) });
      queryClient.invalidateQueries({ queryKey: hasLikedKey(targetType, targetId) });
    },
    onError: (error) => {
      console.error("[social/likes] Falha ao curtir/descurtir", describeSupabaseError(error));
    },
  });
}
