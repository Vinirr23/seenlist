import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

function followStatusKey(targetUserId: string) {
  return ["follow-status", targetUserId] as const;
}

export function useFollowStatus(targetUserId: string | null) {
  return useQuery({
    queryKey: followStatusKey(targetUserId ?? ""),
    queryFn: async (): Promise<boolean> => {
      if (!targetUserId) return false;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
      } = await supabase.auth.getUser();
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
