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
  parentCommentId: string | null;
  createdAt: string;
  author: { userId: string; username: string; displayName: string | null; avatarUrl: string | null };
}

export interface CommentNode extends MediaComment {
  children: CommentNode[];
}

/** Idêntico a findCommentNode do web (só que aqui é usado por decisão explícita sua, não porque o web faz isso pra comentário de mídia — o web só usa essa tela dedicada pro Feed). */
export function findCommentNode(roots: CommentNode[], commentId: string): CommentNode | null {
  for (const node of roots) {
    if (node.id === commentId) return node;
    const found = findCommentNode(node.children, commentId);
    if (found) return found;
  }
  return null;
}

interface CommentRow {
  id: string;
  body: string | null;
  contains_spoiler: boolean;
  parent_comment_id: string | null;
  created_at: string;
  user_id: string;
}

function applyTargetFilter<T extends { is: (c: string, v: null) => T; eq: (c: string, v: number) => T }>(query: T, target: MediaTarget): T {
  let q = target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
  q = target.episodeNumber == null ? q.is("episode_number", null) : q.eq("episode_number", target.episodeNumber);
  return q;
}

/**
 * TASK-122 (episódio, correção) — agora com árvore de respostas de
 * verdade (`parent_comment_id`), porta completa de `social/comments.ts`
 * (antes era lista plana, de propósito simplificado — TASK-115).
 */
export async function fetchMediaComments(target: MediaTarget): Promise<MediaComment[]> {
  let query = supabase
    .from("comments")
    .select("id, body, contains_spoiler, parent_comment_id, created_at, user_id")
    .eq("media_type", target.mediaType)
    .eq("media_id", target.mediaId)
    .is("deleted_at", null);
  query = applyTargetFilter(query, target);

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
      parentCommentId: row.parent_comment_id,
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

/** Idêntico a buildTree do web (CommentsSection.tsx). */
export function buildCommentTree(comments: MediaComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const comment of comments) byId.set(comment.id, { ...comment, children: [] });

  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = byId.get(comment.id) as CommentNode;
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function fetchMediaCommentCount(target: MediaTarget): Promise<number> {
  let query = supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("media_type", target.mediaType)
    .eq("media_id", target.mediaId)
    .is("deleted_at", null);
  query = applyTargetFilter(query, target);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function postMediaComment(
  target: MediaTarget,
  body: string,
  containsSpoiler = false,
  parentCommentId: string | null = null
): Promise<void> {
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
    parent_comment_id: parentCommentId,
  });
  if (error) throw error;
}

export async function editMediaComment(commentId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { data, error } = await supabase.from("comments").update({ body: trimmed }).eq("id", commentId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Não foi possível editar — talvez este comentário não seja seu.");
}

/**
 * TASK-123 (correção — apagar comentário) — `.select()` depois do
 * update é o que permite saber se a política de segurança bloqueou
 * silenciosamente (mesmo padrão já documentado em
 * `seriesCategoryRecalc.ts`: um UPDATE que a RLS barra não dá erro
 * nenhum, só "0 linhas afetadas" — sem pedir os dados de volta,
 * esse "0 linhas" fica invisível, PARECE que funcionou mas não
 * mudou nada).
 */
export async function deleteMediaComment(commentId: string): Promise<void> {
  const { data, error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Não foi possível apagar — talvez este comentário não seja seu.");
}
