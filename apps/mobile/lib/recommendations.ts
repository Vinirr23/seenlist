import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

/**
 * TASK-169 — porta de `lib/queries/recommendations.ts` do web. Mesma
 * regra de negócio (RLS já garante no banco, isto só reflete): só
 * dá pra recomendar pra quem você segue, quem te bloqueou não
 * recebe nada.
 */

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
}

export async function sendRecommendation(
  recipientId: string,
  mediaType: "movie" | "series",
  mediaId: number,
  message: string
): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const trimmed = message.trim();
  const { error } = await supabase.from("recommendations").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    media_type: mediaType,
    media_id: mediaId,
    message: trimmed.length > 0 ? trimmed.slice(0, 200) : null,
  });
  if (error) throw error;
}

export async function fetchReceivedRecommendations(): Promise<ReceivedRecommendation[]> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("recommendations")
    .select("id, sender_id, media_type, media_id, message, created_at, read_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
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
    };
  });
}

export async function fetchUnreadRecommendationsCount(): Promise<number> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("recommendations")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) {
    console.error("[recommendations] Falha ao contar não lidas", error);
    return 0;
  }
  return count ?? 0;
}

export async function markRecommendationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function dismissRecommendation(id: string): Promise<void> {
  const { error } = await supabase.from("recommendations").delete().eq("id", id);
  if (error) throw error;
}

export interface BlockedUser {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return [];

  const { data: blocks, error } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id);
  if (error) throw error;
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
}

/** Bloquear já apaga as recomendações pendentes dessa pessoa (mesmo comportamento do web). */
export async function blockUser(userId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: userId });
  if (error) throw error;
  await supabase.from("recommendations").delete().eq("recipient_id", user.id).eq("sender_id", userId);
}

export async function unblockUser(userId: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
  if (error) throw error;
}
