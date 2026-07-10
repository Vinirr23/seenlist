import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import type { FollowListUser } from "./follow-list";

const SUGGESTIONS_LIMIT = 20;

/**
 * TASK-057 — busca de usuários pra tela de descoberta. Reaproveita o
 * mesmo formato de retorno de useFollowList (FollowListUser) pra
 * poder reaproveitar UserListRow sem adaptação nenhuma.
 *
 * "Sugestões" (sem termo de busca): não existe nenhum sinal de
 * popularidade/relevância calculado hoje (sem contagem de
 * seguidores agregada, sem conexões em comum) — inventar um ranking
 * seria um dado falso. Uso o critério mais honesto disponível:
 * usuários públicos mais recentes que o viewer ainda não segue.
 */
export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["user-search", query],
    queryFn: async (): Promise<FollowListUser[]> => {
      const supabase = createClient();
      const {
        data: { user: viewer },
      } = await supabase.auth.getUser();

      let profilesQuery = supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .order("created_at", { ascending: false })
        .limit(SUGGESTIONS_LIMIT);

      if (query.trim()) {
        profilesQuery = profilesQuery.or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`);
      }
      if (viewer) {
        profilesQuery = profilesQuery.neq("user_id", viewer.id);
      }

      const { data: profiles, error } = await profilesQuery;
      if (error) {
        console.error("[user-search] Falha ao buscar usuários", describeSupabaseError(error));
        throw error;
      }

      const ids = (profiles ?? []).map((p) => p.user_id);
      let followsViewerIds = new Set<string>();
      if (viewer && ids.length > 0) {
        const { data: reverseRelations } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", viewer.id)
          .in("follower_id", ids);
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
  });
}
