import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export type FeedbackType = "bug" | "suggestion" | "other";

export interface MyFeedbackItem {
  id: string;
  type: FeedbackType;
  message: string;
  createdAt: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
}

/** TASK-076 — envia feedback direto pelo app (Configurações → Enviar feedback). */
export function useSendFeedback() {
  const queryClient = useQueryClient();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-feedback"] });
    },
  });
}

/**
 * A PEDIDO (2026-09-16 — "quero poder responder o feedback, e o
 * usuário receber a resposta") — histórico do que o próprio usuário
 * já mandou, com a resposta (se já respondida). A migration nova
 * (`20260916000000_feedback_replies.sql`) deu a `user_feedback` uma
 * policy de SELECT pro próprio usuário (não existia — só INSERT) e as
 * colunas `admin_reply`/`admin_replied_at`, além do gatilho que
 * dispara a notificação (`feedback_reply`) quando você responde pelo
 * Supabase direto.
 */
export function useMyFeedback() {
  return useQuery({
    queryKey: ["my-feedback"],
    queryFn: async (): Promise<MyFeedbackItem[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_feedback")
        .select("id, type, message, created_at, admin_reply, admin_replied_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("[feedback] Falha ao buscar histórico", describeSupabaseError(error));
        throw error;
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        type: row.type as FeedbackType,
        message: row.message,
        createdAt: row.created_at,
        adminReply: row.admin_reply,
        adminRepliedAt: row.admin_replied_at,
      }));
    },
  });
}
