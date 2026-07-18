import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { fetchDisplaySummaries } from "./library-state";

const RECOMMENDATIONS_KEY = ["recommendations"] as const;
const UNREAD_COUNT_KEY = ["recommendations", "unread-count"] as const;
const BLOCKED_USERS_KEY = ["blocked-users"] as const;

export interface ReceivedRecommendation {
  id: string;
  mediaType: "movie" | "series";
  mediaId: number;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  sender: { userId: string; username: string; displayName: string | null; avatarUrl: string | null };
  title: string;
  posterPath: string | null;
  year: number | null;
}

/**
 * TASK-169 — envia recomendação pra quem o usuário segue. A policy
 * de INSERT (`20260819000000_recommendations.sql`) já garante no
 * banco que só dá pra recomendar pra quem se segue e que não fica
 * pra quem bloqueou — aqui não repete essa checagem, só trata o erro
 * genérico se a policy rejeitar (RLS 42501).
 */
export function useSendRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipientId,
      mediaType,
      mediaId,
      message,
    }: {
      recipientId: string;
      mediaType: "movie" | "series";
      mediaId: number;
      message: string;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const trimmed = message.trim();
      const { error } = await supabase.from("recommendations").insert({
        sender_id: user.id,
        recipient_id: recipientId,
        media_type: mediaType,
        media_id: mediaId,
        message: trimmed.length > 0 ? trimmed.slice(0, 200) : null,
      });
      if (error) {
        console.error("[recommendations] Falha ao enviar recomendação", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
    },
  });
}

/**
 * Recomendações recebidas, mais recentes primeiro, já com o perfil
 * de quem mandou e o resumo do TMDB (título/pôster/ano) — mesma
 * função de resumo que a Biblioteca usa (`fetchDisplaySummaries`),
 * reaproveitada em vez de duplicada.
 */
export function useReceivedRecommendations() {
  return useQuery({
    queryKey: RECOMMENDATIONS_KEY,
    queryFn: async (): Promise<ReceivedRecommendation[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return [];

      const { data: rows, error } = await supabase
        .from("recommendations")
        .select("id, sender_id, media_type, media_id, message, created_at, read_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[recommendations] Falha ao buscar recomendações recebidas", describeSupabaseError(error));
        throw error;
      }
      if (!rows || rows.length === 0) return [];

      const senderIds = [...new Set(rows.map((r) => r.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", senderIds);
      const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      const movieIds = rows.filter((r) => r.media_type === "movie").map((r) => r.media_id);
      const seriesIds = rows.filter((r) => r.media_type === "series").map((r) => r.media_id);
      const summaries = await fetchDisplaySummaries(movieIds, seriesIds);

      return rows.map((row) => {
        const sender = profileById.get(row.sender_id);
        const summary = row.media_type === "movie" ? summaries.movies[row.media_id] : summaries.series[row.media_id];
        return {
          id: row.id,
          mediaType: row.media_type as "movie" | "series",
          mediaId: row.media_id,
          message: row.message,
          createdAt: row.created_at,
          readAt: row.read_at,
          sender: {
            userId: row.sender_id,
            username: sender?.username ?? "usuário",
            displayName: sender?.display_name ?? null,
            avatarUrl: sender?.avatar_url ?? null,
          },
          title: summary?.title ?? (row.media_type === "movie" ? `Filme #${row.media_id}` : `Série #${row.media_id}`),
          posterPath: summary?.posterPath ?? null,
          year: summary?.year ?? null,
        };
      });
    },
  });
}

/** Só a contagem, pra bolinha no ícone do Perfil — não busca perfil nem TMDB, mais leve que a lista inteira. */
export function useUnreadRecommendationsCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return 0;

      const { count, error } = await supabase
        .from("recommendations")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (error) {
        console.error("[recommendations] Falha ao contar não lidas", describeSupabaseError(error));
        return 0;
      }
      return count ?? 0;
    },
  });
}

export function useMarkRecommendationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("recommendations")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) {
        console.error("[recommendations] Falha ao marcar como lida", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

/** Destinatário dispensa (apaga) uma recomendação da lista. */
export function useDismissRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("recommendations").delete().eq("id", id);
      if (error) {
        console.error("[recommendations] Falha ao dispensar recomendação", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export interface BlockedUser {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: BLOCKED_USERS_KEY,
    queryFn: async (): Promise<BlockedUser[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return [];

      const { data: blocks, error } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      if (error) {
        console.error("[recommendations] Falha ao buscar bloqueados", describeSupabaseError(error));
        throw error;
      }
      const blockedIds = (blocks ?? []).map((b) => b.blocked_id);
      if (blockedIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", blockedIds);

      return (profiles ?? []).map((p) => ({
        userId: p.user_id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
      }));
    },
  });
}

/** Bloquear já apaga as recomendações pendentes dessa pessoa — não faz sentido continuar vendo quem acabou de bloquear. */
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: userId });
      if (error) {
        console.error("[recommendations] Falha ao bloquear usuário", describeSupabaseError(error));
        throw error;
      }
      await supabase.from("recommendations").delete().eq("recipient_id", user.id).eq("sender_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOMMENDATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_KEY });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId);
      if (error) {
        console.error("[recommendations] Falha ao desbloquear usuário", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_KEY });
    },
  });
}
