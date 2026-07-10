import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

const POSTS_LIMIT = 30;

/**
 * TASK-059 (fase 2) — só posts type='text' por enquanto. Ordem
 * cronológica simples (created_at desc) — o algoritmo de mistura de
 * sinais é fase futura, não inventado aqui. Perfis buscados à parte
 * e unidos no cliente, mesmo padrão já usado em activity-feed.ts e
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
        .select("id, user_id, body, created_at")
        .eq("type", "text")
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
        .select("id, user_id, body, created_at")
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
        createdAt: row.created_at,
      };
    },
    enabled: Boolean(postId),
  });
}

export function useCreateTextPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("posts").insert({ user_id: user.id, type: "text", body });
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
