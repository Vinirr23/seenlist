import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

/**
 * A PEDIDO (2026-09-15 — sino de notificações no Perfil, web + mobile).
 * Porte fiel de `lib/queries/notifications.ts` do web — mesmo padrão
 * de `lib/recommendations.ts` (busca as linhas, depois busca em lote
 * o perfil de cada `actor_id` distinto e o resumo TMDB de cada mídia
 * distinta via `fetchDisplaySummaries`, reaproveitada da Biblioteca).
 * Ver a migration nova (`20260915010000_notification_triggers_missing_types.sql`)
 * pra causa raiz de por que só 3 dos 7 tipos previstos realmente
 * geravam notificação até agora.
 */

export type NotificationType =
  | "comment_reply"
  | "comment_like"
  | "review_like"
  | "episode_new"
  | "season_premiere"
  | "recommendation"
  | "new_follower"
  | "feedback_reply";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: { userId: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
  mediaType: "movie" | "series" | null;
  mediaId: number | null;
  mediaTitle: string | null;
  mediaPosterPath: string | null;
  message: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotifications(language = "pt-BR"): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, type, actor_id, target_media_type, target_media_id, payload, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", actorIds)
      : { data: [] as { user_id: string; username: string; display_name: string | null; avatar_url: string | null }[] };
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const movieIds = rows.filter((r) => r.target_media_type === "movie" && r.target_media_id != null).map((r) => r.target_media_id!);
  const seriesIds = rows.filter((r) => r.target_media_type === "series" && r.target_media_id != null).map((r) => r.target_media_id!);
  const summaries = await fetchDisplaySummaries(movieIds, seriesIds, language);

  return rows.map((row) => {
    const actor = row.actor_id ? profileById.get(row.actor_id) : null;
    const summary =
      row.target_media_type === "movie"
        ? summaries.movies[row.target_media_id ?? -1]
        : row.target_media_type === "series"
          ? summaries.series[row.target_media_id ?? -1]
          : undefined;
    const payload = row.payload as { message?: string } | null;

    return {
      id: row.id,
      type: row.type as NotificationType,
      actor: actor
        ? { userId: actor.user_id, username: actor.username, displayName: actor.display_name, avatarUrl: actor.avatar_url }
        : null,
      mediaType: (row.target_media_type as "movie" | "series" | null) ?? null,
      mediaId: row.target_media_id ?? null,
      mediaTitle: summary?.title ?? null,
      mediaPosterPath: summary?.posterPath ?? null,
      message: payload?.message ?? null,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  });
}

/** Só a contagem, pra bolinha no sino — não busca perfil nem TMDB, mais leve que a lista inteira. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) {
    console.error("[notifications] Falha ao contar não lidas", error);
    return 0;
  }
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (error) throw error;
}
