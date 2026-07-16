import { useQuery } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface FollowListUser {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Esse usuário segue quem está vendo a lista (pedido explícito — "Segue você"). */
  followsViewer: boolean;
}

/**
 * TASK-056 — reaproveita `follows` (já existia, TASK-028) — nenhuma
 * tabela nova. `direction: "following"` = quem o `userId` segue;
 * `"followers"` = quem segue o `userId`. Mesma consulta serve pras
 * duas telas, só troca a direção do join.
 */
export function useFollowList(userId: string | null, direction: "following" | "followers", search: string) {
  return useQuery({
    queryKey: ["follow-list", userId, direction, search],
    queryFn: async (): Promise<FollowListUser[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const {
        data: { user: viewer },
      } = await getCurrentAuthUser(supabase);

      const relationColumn = direction === "following" ? "follower_id" : "following_id";
      const otherColumn = direction === "following" ? "following_id" : "follower_id";

      const { data: relations, error: relationsError } = await supabase
        .from("follows")
        .select(otherColumn)
        .eq(relationColumn, userId);

      if (relationsError) {
        console.error("[follow-list] Falha ao buscar relações", describeSupabaseError(relationsError));
        throw relationsError;
      }

      const otherIds = [...new Set((relations ?? []).map((r) => r[otherColumn as keyof typeof r] as string))];
      if (otherIds.length === 0) return [];

      let query = supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherIds);

      if (search.trim()) {
        query = query.or(`username.ilike.%${search.trim()}%,display_name.ilike.%${search.trim()}%`);
      }

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) {
        console.error("[follow-list] Falha ao buscar perfis", describeSupabaseError(profilesError));
        throw profilesError;
      }

      // "Segue você" — quem, dentre esses, segue o VIEWER (não o dono da lista sendo vista).
      let followsViewerIds = new Set<string>();
      if (viewer) {
        const { data: reverseRelations } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", viewer.id)
          .in("follower_id", otherIds);
        followsViewerIds = new Set((reverseRelations ?? []).map((r) => r.follower_id));
      }

      return (profiles ?? []).map((p) => ({
        userId: p.user_id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        followsViewer: followsViewerIds.has(p.user_id),
      }));
    },
    enabled: Boolean(userId),
  });
}
