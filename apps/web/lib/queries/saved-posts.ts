import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

function queryKey(postId: string) {
  return ["saved-post", postId] as const;
}

/**
 * TASK-059 (fase 4) — salvar post. Tabela dedicada (`saved_posts`,
 * já na migration aprovada) porque é uma relação usuário↔post
 * privada (só o dono vê o que salvou) — diferente de `likes`, que é
 * pública, então não dava pra reaproveitar a mesma tabela genérica.
 */
export function useIsSaved(postId: string, initial?: boolean) {
  return useQuery({
    queryKey: queryKey(postId),
    initialData: initial,
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return false;

      const { data, error } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[saved-posts] Falha ao checar salvo", describeSupabaseError(error));
        throw error;
      }
      return Boolean(data);
    },
  });
}

/** AUDITORIA — mesma ideia de `useLikeInfoBatch`/`useCommentCountsBatch`: 1 consulta pra todos os posts visíveis, não uma por post. */
export function useSavedStatusesBatch(postIds: string[]) {
  return useQuery({
    queryKey: ["saved-posts-batch", postIds.slice().sort().join(",")] as const,
    queryFn: async (): Promise<Set<string>> => {
      const result = new Set<string>();
      if (postIds.length === 0) return result;

      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return result;

      const { data, error } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds);
      if (error) {
        console.error("[saved-posts] Falha ao buscar salvos em lote", describeSupabaseError(error));
        throw error;
      }
      for (const row of data ?? []) result.add(row.post_id);
      return result;
    },
    enabled: postIds.length > 0,
  });
}

export function useToggleSavePost(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currentlySaved: boolean) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      if (currentlySaved) {
        const { error } = await supabase.from("saved_posts").delete().match({ user_id: user.id, post_id: postId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("saved_posts")
          .upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id", ignoreDuplicates: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey(postId) });
    },
    onError: (error) => {
      console.error("[saved-posts] Falha ao salvar/remover", describeSupabaseError(error));
    },
  });
}
