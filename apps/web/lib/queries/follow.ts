import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

function followStatusKey(targetUserId: string) {
  return ["follow-status", targetUserId] as const;
}

export function useFollowStatus(targetUserId: string | null, initial?: boolean) {
  return useQuery({
    queryKey: followStatusKey(targetUserId ?? ""),
    initialData: initial,
    queryFn: async (): Promise<boolean> => {
      if (!targetUserId) return false;
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return false;

      const { data, error } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();
      if (error) {
        console.error("[follow] Falha ao checar status de seguir", describeSupabaseError(error));
        throw error;
      }
      return Boolean(data);
    },
    enabled: Boolean(targetUserId),
  });
}

/**
 * AUDITORIA (perf) — mesma ideia de `useLikeInfoBatch`: 1 consulta
 * pra todos os usuários visíveis numa lista (Seguindo/Seguidores/
 * Descobrir pessoas), não uma por linha. Sem isso, uma lista de
 * seguidores grande disparava N consultas individuais ao montar.
 */
export function useFollowStatusBatch(targetUserIds: string[]) {
  return useQuery({
    queryKey: ["follow-status-batch", targetUserIds.slice().sort().join(",")] as const,
    queryFn: async (): Promise<Set<string>> => {
      const result = new Set<string>();
      if (targetUserIds.length === 0) return result;

      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return result;

      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", targetUserIds);
      if (error) {
        console.error("[follow] Falha ao buscar status de seguir em lote", describeSupabaseError(error));
        throw error;
      }
      for (const row of data ?? []) result.add(row.following_id);
      return result;
    },
    enabled: targetUserIds.length > 0,
  });
}

/**
 * "Não implementar notificações... apenas relacionamento entre
 * usuários" (item 3) — é literalmente isso: insere/remove uma linha
 * em `follows`, nada mais acontece.
 */
export function useToggleFollow(targetUserId: string) {
  const queryClient = useQueryClient();

  return {
    async mutate(currentlyFollowing: boolean): Promise<{ error: string | null }> {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return { error: "Entre para seguir outros usuários." };

      if (currentlyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) {
          console.error("[follow] Falha ao deixar de seguir", describeSupabaseError(error));
          return { error: "Não foi possível salvar agora. Tente de novo." };
        }
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
        if (error) {
          console.error("[follow] Falha ao seguir", describeSupabaseError(error));
          return { error: "Não foi possível salvar agora. Tente de novo." };
        }
      }

      queryClient.invalidateQueries({ queryKey: followStatusKey(targetUserId) });
      queryClient.invalidateQueries({ queryKey: ["follow-counts", targetUserId] });
      return { error: null };
    },
  };
}
