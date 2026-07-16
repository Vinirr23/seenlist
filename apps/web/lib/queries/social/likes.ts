import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import type { LikeTargetType } from "./types";

function likeCountKey(targetType: LikeTargetType, targetId: string) {
  return ["like-count", targetType, targetId] as const;
}
function hasLikedKey(targetType: LikeTargetType, targetId: string) {
  return ["has-liked", targetType, targetId] as const;
}

/**
 * TASK-031 — "contadores públicos" via COUNT direto — não
 * denormalizado. Uma função só serve comentário, review ou lista;
 * muda só `targetType`.
 *
 * AUDITORIA — `initial`, quando informado (Feed passando o valor já
 * buscado em lote via `useLikeInfoBatch`), vira `initialData` do
 * React Query: a consulta nasce com esse valor, sem chamada de rede
 * própria. Sem `initial` (ex.: tela de detalhe do post), continua
 * buscando sozinho, igual sempre foi.
 */
export function useLikeCount(targetType: LikeTargetType, targetId: string, initial?: number) {
  return useQuery({
    queryKey: likeCountKey(targetType, targetId),
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (error) {
        console.error("[social/likes] Falha ao contar curtidas", describeSupabaseError(error));
        throw error;
      }
      return count ?? 0;
    },
    initialData: initial,
  });
}

export function useHasLiked(targetType: LikeTargetType, targetId: string, initial?: boolean) {
  return useQuery({
    queryKey: hasLikedKey(targetType, targetId),
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return false;

      const { data, error } = await supabase
        .from("likes")
        .select("id")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[social/likes] Falha ao checar curtida", describeSupabaseError(error));
        throw error;
      }
      return Boolean(data);
    },
    initialData: initial,
  });
}

/**
 * AUDITORIA — mesma ideia de `fetchLikeInfoFor` do mobile
 * (TASK-153): 1 consulta pra todos os posts visíveis no Feed, não
 * uma por post (antes: `useHasLiked` + `useLikeCount` por
 * `PostCard`, cada um com sua própria chamada de rede — com N posts
 * na tela, N×2 consultas, cada uma com sua própria checagem de
 * usuário). Uma linha de `likes` por curtida — dá pra contar E saber
 * se o usuário atual curtiu, tudo na mesma consulta.
 */
export function useLikeInfoBatch(targetType: LikeTargetType, targetIds: string[]) {
  return useQuery({
    queryKey: ["like-info-batch", targetType, targetIds.slice().sort().join(",")] as const,
    queryFn: async (): Promise<Map<string, { count: number; hasLiked: boolean }>> => {
      const result = new Map<string, { count: number; hasLiked: boolean }>();
      if (targetIds.length === 0) return result;

      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);

      const { data, error } = await supabase
        .from("likes")
        .select("target_id, user_id")
        .eq("target_type", targetType)
        .in("target_id", targetIds);
      if (error) {
        console.error("[social/likes] Falha ao buscar curtidas em lote", describeSupabaseError(error));
        throw error;
      }

      const rows = data ?? [];
      const countByTarget = new Map<string, number>();
      for (const row of rows) {
        countByTarget.set(row.target_id, (countByTarget.get(row.target_id) ?? 0) + 1);
      }
      for (const id of targetIds) {
        const hasLiked = user ? rows.some((r) => r.target_id === id && r.user_id === user.id) : false;
        result.set(id, { count: countByTarget.get(id) ?? 0, hasLiked });
      }
      return result;
    },
    enabled: targetIds.length > 0,
  });
}

export function useToggleLike(targetType: LikeTargetType, targetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      if (currentlyLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .match({ user_id: user.id, target_type: targetType, target_id: targetId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .upsert(
            { user_id: user.id, target_type: targetType, target_id: targetId },
            { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: likeCountKey(targetType, targetId) });
      queryClient.invalidateQueries({ queryKey: hasLikedKey(targetType, targetId) });
    },
    onError: (error) => {
      console.error("[social/likes] Falha ao curtir/descurtir", describeSupabaseError(error));
    },
  });
}
