import { supabase, getCurrentAuthUser } from "@/lib/supabase";

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

const COLUMN_BY_FIELD: Record<keyof NotificationPreferences, string> = {
  episodeNew: "episode_new",
  seasonPremiere: "season_premiere",
  commentReply: "comment_reply",
  commentLike: "comment_like",
  reviewLike: "review_like",
};

/**
 * TASK-114 (Notificações) — porta de `notification-preferences.ts`.
 * Se o usuário nunca abriu essa tela, não existe linha em
 * `notification_preferences` ainda (a tabela só ganha uma linha no
 * primeiro PATCH) — sem linha = tudo ligado por padrão, mesmo
 * default da coluna no banco, não é um erro.
 */
export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("episode_new, season_premiere, comment_reply, comment_like, review_like")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_PREFERENCES;

  return {
    episodeNew: data.episode_new,
    seasonPremiere: data.season_premiere,
    commentReply: data.comment_reply,
    commentLike: data.comment_like,
    reviewLike: data.review_like,
  };
}

export async function updateNotificationPreference(field: keyof NotificationPreferences, value: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, [COLUMN_BY_FIELD[field]]: value, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
