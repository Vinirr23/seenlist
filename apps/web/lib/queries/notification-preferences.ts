import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface NotificationPreferences {
  episodeNew: boolean;
  seasonPremiere: boolean;
  commentReply: boolean;
  commentLike: boolean;
  reviewLike: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  episodeNew: true,
  seasonPremiere: true,
  commentReply: true,
  commentLike: true,
  reviewLike: true,
};

function queryKey() {
  return ["notification-preferences"] as const;
}

/**
 * TASK-052 — se o usuário nunca abriu esta tela, não existe linha em
 * `notification_preferences` ainda (a tabela só ganha uma linha no
 * primeiro PATCH). Sem linha = tudo ligado por padrão (mesmo default
 * da coluna no banco) — não é um erro, é o estado inicial esperado.
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKey(),
    queryFn: async (): Promise<NotificationPreferences> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("episode_new, season_premiere, comment_reply, comment_like, review_like")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[notification-preferences] Falha ao buscar preferências", describeSupabaseError(error));
        throw error;
      }
      if (!data) return DEFAULT_PREFERENCES;

      return {
        episodeNew: data.episode_new,
        seasonPremiere: data.season_premiere,
        commentReply: data.comment_reply,
        commentLike: data.comment_like,
        reviewLike: data.review_like,
      };
    },
  });
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ field, value }: { field: keyof NotificationPreferences; value: boolean }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const columnByField: Record<keyof NotificationPreferences, string> = {
        episodeNew: "episode_new",
        seasonPremiere: "season_premiere",
        commentReply: "comment_reply",
        commentLike: "comment_like",
        reviewLike: "review_like",
      };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, [columnByField[field]]: value, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

      if (error) {
        console.error("[notification-preferences] Falha ao salvar preferência", describeSupabaseError(error));
        throw error;
      }
    },
    onMutate: async ({ field, value }) => {
      await queryClient.cancelQueries({ queryKey: queryKey() });
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey());
      queryClient.setQueryData<NotificationPreferences>(queryKey(), (current) => ({
        ...(current ?? DEFAULT_PREFERENCES),
        [field]: value,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey(), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey() });
    },
  });
}
