import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface SocialCounts {
  commentsGiven: number;
  reviewsGiven: number;
  likesGiven: number;
}

/**
 * TASK-054 — "avaliações, curtidas, comentários" pedidos nas duas
 * abas. Dado real, tabelas já existentes (comments/reviews/likes,
 * TASK-031) — nunca tinha sido contado por usuário antes. Só
 * `count: "exact", head: true` em cada uma — não baixa nenhuma linha.
 */
export function useSocialCounts() {
  return useQuery({
    queryKey: ["social-counts"],
    queryFn: async (): Promise<SocialCounts> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const [comments, reviews, likes] = await Promise.all([
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("reviews").select("*", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      if (comments.error || reviews.error || likes.error) {
        const error = comments.error ?? reviews.error ?? likes.error;
        console.error("[social-counts] Falha ao contar interações", describeSupabaseError(error!));
        throw error;
      }

      return {
        commentsGiven: comments.count ?? 0,
        reviewsGiven: reviews.count ?? 0,
        likesGiven: likes.count ?? 0,
      };
    },
  });
}
