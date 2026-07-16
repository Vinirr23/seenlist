import { useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export type FeedbackType = "bug" | "suggestion" | "other";

/** TASK-076 — envia feedback direto pelo app (Configurações → Enviar feedback). Sem tela de leitura no app — consulta-se depois pelo Supabase. */
export function useSendFeedback() {
  return useMutation({
    mutationFn: async ({ type, message }: { type: FeedbackType; message: string }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("user_feedback").insert({ user_id: user.id, type, message });
      if (error) {
        console.error("[feedback] Falha ao enviar feedback", describeSupabaseError(error));
        throw error;
      }
    },
  });
}
