import { supabase, getCurrentAuthUser } from "@/lib/supabase";

export type PostType = "text" | "image" | "review" | "poll";

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  type: PostType;
  body: string;
  imageUrl: string | null;
  mediaType: "movie" | "series" | null;
  mediaId: number | null;
  mediaTitle: string | null;
  mediaPosterPath: string | null;
  rating: number | null;
  createdAt: string;
}

const POSTS_LIMIT = 30;
const POST_TYPES = ["text", "image", "review", "poll"] as const;
const POST_COLUMNS = "id, user_id, type, body, image_url, media_type, media_id, media_title, media_poster_path, rating, created_at";

interface PostRow {
  id: string;
  user_id: string;
  type: PostType;
  body: string | null;
  image_url: string | null;
  media_type: "movie" | "series" | null;
  media_id: number | null;
  media_title: string | null;
  media_poster_path: string | null;
  rating: number | string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

function mapRow(row: PostRow, profile: ProfileRow): Post {
  return {
    id: row.id,
    userId: row.user_id,
    authorName: profile.display_name || profile.username,
    authorUsername: profile.username,
    authorAvatarUrl: profile.avatar_url,
    type: row.type,
    body: row.body ?? "",
    imageUrl: row.image_url,
    mediaType: row.media_type,
    mediaId: row.media_id,
    mediaTitle: row.media_title,
    mediaPosterPath: row.media_poster_path,
    rating: row.rating === null ? null : Number(row.rating),
    createdAt: row.created_at,
  };
}

/** Idêntico a `usePosts` do web (lib/queries/posts.ts), sem react-query — chamada direta, mesmo padrão de lib/library.ts. */
export async function fetchPosts(): Promise<Post[]> {
  const { data: rows, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .in("type", POST_TYPES)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(POSTS_LIMIT);

  if (error) {
    console.error("[posts] Falha ao buscar posts", error);
    throw error;
  }

  const typedRows = (rows ?? []) as PostRow[];
  const userIds = [...new Set(typedRows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds)
    : { data: [] as ProfileRow[] };
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.user_id, p]));

  return typedRows
    .map((row) => {
      const profile = profileById.get(row.user_id);
      if (!profile) return null; // perfil privado ou removido — não mostra post órfão sem autor
      return mapRow(row, profile);
    })
    .filter((post): post is Post => post !== null);
}

/** Idêntico a usePost do web — busca um post só, pra tela de detalhe (comentários). */
export async function fetchPost(postId: string): Promise<Post | null> {
  const { data: row, error } = await supabase.from("posts").select(POST_COLUMNS).eq("id", postId).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const typedRow = row as PostRow;
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .eq("user_id", typedRow.user_id)
    .maybeSingle();
  if (!profile) return null;

  return mapRow(typedRow, profile as ProfileRow);
}

/** Idêntico a useEditPost do web. */
export async function editPost(postId: string, body: string): Promise<void> {
  const { error } = await supabase.from("posts").update({ body }).eq("id", postId);
  if (error) throw error;
}

/** Idêntico a useDeletePost do web — soft-delete (`deleted_at`), mesmo padrão de comments/reviews. */
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", postId);
  if (error) throw error;
}

/**
 * TASK-101 (Avaliações) — a parte que faltava do comentário acima:
 * post de review, publicado pela tela de Avaliações quando a pessoa
 * marca "Publicar também no Feed". Post de imagem/GIF continua de
 * fora (ainda precisa de seletor de imagem + upload).
 */
export async function createReviewPost(
  body: string,
  review: { mediaType: "movie" | "series"; mediaId: number; mediaTitle: string; mediaPosterPath: string | null; rating: number }
): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    type: "review",
    body: body.trim() || null,
    image_url: null,
    media_type: review.mediaType,
    media_id: review.mediaId,
    media_title: review.mediaTitle,
    media_poster_path: review.mediaPosterPath,
    rating: review.rating,
  });
  if (error) throw error;
}

export async function createTextPost(body: string, imageUrl: string | null = null): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed && !imageUrl) throw new Error("Post vazio.");

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    type: imageUrl ? "image" : "text",
    body: trimmed || null,
    image_url: imageUrl,
    media_type: null,
    media_id: null,
    media_title: null,
    media_poster_path: null,
    rating: null,
  });
  if (error) throw error;
}
