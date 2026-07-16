import { useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

/**
 * TASK-059 (fase 4) — denunciar post. Só grava a denúncia
 * (`post_reports`, já na migration) — não existe painel de
 * moderação ainda (fora de escopo desta fase, e não foi pedido).
 * `unique(post_id, user_id)` no banco já impede denúncia duplicada
 * do mesmo usuário pro mesmo post — o erro correspondente é tratado
 * como sucesso silencioso aqui (já denunciou, não precisa avisar
 * como falha).
 */
export function useReportPost(postId: string) {
  return useMutation({
    mutationFn: async (reason: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("post_reports").insert({ post_id: postId, user_id: user.id, reason });
      if (error && error.code !== "23505") {
        // 23505 = unique_violation — já denunciou antes, não é erro pro usuário
        console.error("[post-reports] Falha ao denunciar", describeSupabaseError(error));
        throw error;
      }
    },
  });
}
