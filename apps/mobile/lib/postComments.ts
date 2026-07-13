import { supabase } from "@/lib/supabase";

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  parentCommentId: string | null;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * TASK-102 (comentários) — porta de `lib/queries/post-comments.ts`.
 * Mesma estrutura em árvore (`parent_comment_id`) do web, SEM
 * oclusão de spoiler (não se aplica a post, só a comentário de
 * episódio). Perfis buscados à parte, mesmo padrão de posts.ts.
 */
export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data: rows, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, parent_comment_id, body, created_at")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const typedRows = (rows ?? []) as CommentRow[];
  const userIds = [...new Set(typedRows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds)
    : { data: [] as ProfileRow[] };
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.user_id, p]));

  return typedRows
    .map((row) => {
      const profile = profileById.get(row.user_id);
      if (!profile) return null;
      return {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        parentCommentId: row.parent_comment_id,
        authorName: profile.display_name || profile.username,
        authorUsername: profile.username,
        authorAvatarUrl: profile.avatar_url,
        body: row.body,
        createdAt: row.created_at,
      };
    })
    .filter((c): c is PostComment => c !== null);
}

export async function createPostComment(postId: string, body: string, parentCommentId: string | null): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: user.id, body: trimmed, parent_comment_id: parentCommentId });
  if (error) throw error;
}

/**
 * TASK-126 (correção — apagar comentário do Feed) — nunca tinha sido
 * construído (só existia pra comentário de episódio). `.select()`
 * depois do update detecta bloqueio silencioso de RLS (mesmo padrão
 * já usado em `mediaComments.ts`).
 */
export async function deletePostComment(commentId: string): Promise<void> {
  const { data, error } = await supabase.from("post_comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Não foi possível apagar — talvez este comentário não seja seu.");
}

export interface CommentNode extends PostComment {
  children: CommentNode[];
}

/** Idêntico a buildPostCommentTree do web. */
export function buildPostCommentTree(comments: PostComment[]): CommentNode[] {
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
