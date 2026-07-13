import { supabase } from "@/lib/supabase";
import type { ReviewMediaType } from "./reviews";

export interface MediaTarget {
  mediaType: ReviewMediaType;
  mediaId: number;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface MediaComment {
  id: string;
  body: string | null;
  containsSpoiler: boolean;
  createdAt: string;
  author: { userId: string; username: string; displayName: string | null; avatarUrl: string | null };
}

interface CommentRow {
  id: string;
  body: string | null;
  contains_spoiler: boolean;
  created_at: string;
  user_id: string;
}

/**
 * TASK-115 (episódio) — porta SIMPLIFICADA de `social/comments.ts`:
 * lista plana, sem árvore de respostas (`parent_comment_id` sempre
 * nulo aqui) — o web suporta respostas aninhadas nesta tabela
 * também, mas isso é uma extensão pontual pra depois, não parte do
 * essencial de "comentar um episódio".
 */
export async function fetchMediaComments(target: MediaTarget): Promise<MediaComment[]> {
  let query = supabase
    .from("comments")
    .select("id, body, contains_spoiler, created_at, user_id")
    .eq("media_type", target.mediaType)
    .eq("media_id", target.mediaId)
    .is("deleted_at", null);
  query = target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
  query = target.episodeNumber == null ? query.is("episode_number", null) : query.eq("episode_number", target.episodeNumber);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as CommentRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profilesById = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds);
    for (const p of profiles ?? []) profilesById.set(p.user_id, p);
  }

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      id: row.id,
      body: row.body,
      containsSpoiler: row.contains_spoiler,
      createdAt: row.created_at,
      author: {
        userId: row.user_id,
        username: profile?.username ?? "usuário",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      },
    };
  });
}

export async function postMediaComment(target: MediaTarget, body: string, containsSpoiler = false): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("comments").insert({
    user_id: user.id,
    media_type: target.mediaType,
    media_id: target.mediaId,
    season_number: target.seasonNumber ?? null,
    episode_number: target.episodeNumber ?? null,
    body: trimmed,
    contains_spoiler: containsSpoiler,
  });
  if (error) throw error;
}
