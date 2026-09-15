import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { fetchDisplaySummaries } from "./library-state";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const NOTIFICATIONS_KEY = ["notifications"] as const;
const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

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

/**
 * A PEDIDO (2026-09-15 — sino de notificações no Perfil) — a tabela
 * `notifications` já existia inteira (RLS de leitura/marcar-como-lida
 * já prontas, `20260731000000_social_layer_comments_reviews_likes.sql`),
 * só faltava consumi-la numa UI. Mesmo padrão de
 * `useReceivedRecommendations` (`recommendations.ts`): busca as
 * linhas, depois busca em lote (não uma consulta por linha) o perfil
 * de cada `actor_id` distinto e o resumo TMDB de cada mídia distinta,
 * reaproveitando `fetchDisplaySummaries` (a mesma função que a
 * Biblioteca/Recomendações já usam).
 */
export function useNotifications() {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, locale],
    queryFn: async (): Promise<AppNotification[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return [];

      const { data: rows, error } = await supabase
        .from("notifications")
        .select("id, type, actor_id, target_media_type, target_media_id, payload, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.error("[notifications] Falha ao buscar notificações", describeSupabaseError(error));
        throw error;
      }
      if (!rows || rows.length === 0) return [];

      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
      const { data: profiles } =
        actorIds.length > 0
          ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", actorIds)
          : { data: [] };
      const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      const movieIds = rows.filter((r) => r.target_media_type === "movie" && r.target_media_id != null).map((r) => r.target_media_id!);
      const seriesIds = rows.filter((r) => r.target_media_type === "series" && r.target_media_id != null).map((r) => r.target_media_id!);
      const summaries = await fetchDisplaySummaries(movieIds, seriesIds, locale);

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
    },
  });
}

/** Só a contagem, pra bolinha no sino — não busca perfil nem TMDB, mais leve que a lista inteira. */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) {
        console.error("[notifications] Falha ao contar não lidas", describeSupabaseError(error));
        return 0;
      }
      return count ?? 0;
    },
    // A bolinha do sino fica visível em toda tela do app (não só na
    // página de notificações) — reconsulta sozinha de tempos em
    // tempos, não só quando a página recarrega.
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
      if (error) {
        console.error("[notifications] Falha ao marcar como lida", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return;

      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
      if (error) {
        console.error("[notifications] Falha ao marcar todas como lidas", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}
