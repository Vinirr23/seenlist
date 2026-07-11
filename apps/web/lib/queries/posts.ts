import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  /** TASK-066 — vazio quando o post é só imagem/GIF, sem legenda. */
  body: string;
  /** TASK-066 — imagem ou GIF anexado ao post (mesma coluna serve pros dois). Nulo pra post de texto puro. */
  imageUrl: string | null;
  createdAt: string;
}

const POSTS_LIMIT = 30;
const POST_TYPES = ["text", "image"] as const;

/**
 * TASK-059 (fase 2) / TASK-066 (fase seguinte — post com imagem) —
 * "text" e "image" são os dois tipos que já existem; os outros do
 * pedido original (review/enquete/lista/...) continuam fase futura.
 * Ordem cronológica simples (created_at desc) — o algoritmo de
 * mistura de sinais é fase futura, não inventado aqui. Perfis
 * buscados à parte e unidos no cliente, mesmo padrão já usado em
 * activity-feed.ts e my-comments.ts (posts.user_id referencia
 * auth.users, não profiles diretamente — não dá pra fazer join
 * aninhado do Supabase sem uma FK declarada entre as duas tabelas).
 */
export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async (): Promise<Post[]> => {
      const supabase = createClient();

      const { data: rows, error } = await supabase
        .from("posts")
        .select("id, user_id, body, image_url, created_at")
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
          return {
            id: row.id,
            userId: row.user_id,
            authorName: profile.display_name || profile.username,
            authorUsername: profile.username,
            authorAvatarUrl: profile.avatar_url,
            body: row.body ?? "",
            imageUrl: row.image_url,
            createdAt: row.created_at,
          };
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
        .select("id, user_id, body, image_url, created_at")
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

      return {
        id: row.id,
        userId: row.user_id,
        authorName: profile.display_name || profile.username,
        authorUsername: profile.username,
        authorAvatarUrl: profile.avatar_url,
        body: row.body ?? "",
        imageUrl: row.image_url,
        createdAt: row.created_at,
      };
    },
    enabled: Boolean(postId),
  });
}

/**
 * TASK-066 — substitui `useCreateTextPost`: agora cria post de texto
 * OU de imagem, dependendo do que foi passado (`imageUrl` presente =
 * `type: "image"`). Um post de imagem pode ter legenda (`body`) ou
 * não — os dois são válidos, a constraint no banco já garante que
 * pelo menos um dos dois exista.
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ body, imageUrl }: { body: string; imageUrl?: string | null }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        type: imageUrl ? "image" : "text",
        body: body.trim() ? body : null,
        image_url: imageUrl ?? null,
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
