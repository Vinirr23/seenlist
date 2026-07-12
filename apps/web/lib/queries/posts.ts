import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export type PostType = "text" | "image" | "review";

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  type: PostType;
  /** TASK-066 — vazio quando o post é só imagem/GIF, sem legenda. */
  body: string;
  /** TASK-066 — imagem ou GIF anexado ao post (mesma coluna serve pros dois). Nulo pra post de texto puro. */
  imageUrl: string | null;
  /**
   * TASK-078 — "review como post": só preenchidos quando
   * `type === "review"`. Snapshot do momento da publicação (não
   * busca no TMDB de novo pra exibir) — ver migration
   * 20260814000000.
   */
  mediaType: "movie" | "series" | null;
  mediaId: number | null;
  mediaTitle: string | null;
  mediaPosterPath: string | null;
  rating: number | null;
  createdAt: string;
}

const POSTS_LIMIT = 30;
const POST_TYPES = ["text", "image", "review"] as const;
const POST_COLUMNS =
  "id, user_id, type, body, image_url, media_type, media_id, media_title, media_poster_path, rating, created_at";

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

function mapRow(
  row: PostRow,
  profile: { display_name: string | null; username: string; avatar_url: string | null }
): Post {
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

/**
 * TASK-059 (fase 2) / TASK-066 (post com imagem) / TASK-078 (post de
 * review) — "text", "image" e "review" são os três tipos que já
 * existem; enquete/lista continuam fase futura. Ordem cronológica
 * simples (created_at desc) — o algoritmo de mistura de sinais é
 * fase futura, não inventado aqui. Perfis buscados à parte e unidos
 * no cliente, mesmo padrão já usado em activity-feed.ts e
 * my-comments.ts (posts.user_id referencia auth.users, não profiles
 * diretamente — não dá pra fazer join aninhado do Supabase sem uma
 * FK declarada entre as duas tabelas).
 */
export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Post[]> => {
      const supabase = createClient();

      const { data: rows, error } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .in("type", POST_TYPES)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(POSTS_LIMIT);

      if (error) {
        console.error("[posts] Falha ao buscar posts", describeSupabaseError(error));
        throw error;
      }

      const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", userIds)
        : { data: [] };
      const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      return (rows ?? [])
        .map((row) => {
          const profile = profileById.get(row.user_id);
          if (!profile) return null; // perfil privado ou removido — não mostra post órfão sem autor
          return mapRow(row, profile);
        })
        .filter((post): post is Post => post !== null);
    },
  });
}

export function usePost(postId: string) {
  return useQuery({
    queryKey: ["post", postId],
    queryFn: async (): Promise<Post | null> => {
      const supabase = createClient();

      const { data: row, error } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .eq("id", postId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[posts] Falha ao buscar post", describeSupabaseError(error));
        throw error;
      }
      if (!row) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .eq("user_id", row.user_id)
        .maybeSingle();
      if (!profile) return null;

      return mapRow(row, profile);
    },
    enabled: Boolean(postId),
  });
}

export interface ReviewPostPayload {
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  mediaPosterPath: string | null;
  rating: number;
}

/**
 * TASK-066 / TASK-078 — cria post de texto, imagem OU review. O tipo
 * sai do que foi passado: `review` presente → `type: "review"`;
 * senão `imageUrl` presente → `type: "image"`; senão `type: "text"`.
 * Um post de review sempre tem nota (obrigatória por definição de
 * review) — `body` (o texto da review) continua opcional, igual nos
 * outros tipos.
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      body,
      imageUrl,
      review,
    }: {
      body: string;
      imageUrl?: string | null;
      review?: ReviewPostPayload;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        type: review ? "review" : imageUrl ? "image" : "text",
        body: body.trim() ? body : null,
        image_url: imageUrl ?? null,
        media_type: review?.mediaType ?? null,
        media_id: review?.mediaId ?? null,
        media_title: review?.mediaTitle ?? null,
        media_poster_path: review?.mediaPosterPath ?? null,
        rating: review?.rating ?? null,
      });
      if (error) {
        console.error("[posts] Falha ao criar post", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

/** TASK-075 — edita só o texto (a imagem/nota/título, se tiver, continuam os mesmos; trocar isso de um post já publicado fica pra outra hora, fora do pedido original). RLS (`auth.uid() = user_id`) garante que só o dono edita, mesmo que o botão nunca devesse aparecer pra outra pessoa. */
export function useEditPost(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("posts").update({ body }).eq("id", postId);
      if (error) {
        console.error("[posts] Falha ao editar post", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}

/** TASK-075 — soft-delete (`deleted_at`), mesmo padrão de comments/reviews — o post some das telas, mas a linha continua no banco. */
export function useDeletePost(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", postId);
      if (error) {
        console.error("[posts] Falha ao apagar post", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
}
