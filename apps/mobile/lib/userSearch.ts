import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import type { FollowListUser } from "./followList";

const SUGGESTIONS_LIMIT = 20;

/**
 * TASK-110 (Descobrir pessoas) — porta de `user-search.ts`.
 * Reaproveita o mesmo formato de `FollowListUser` pra poder
 * reaproveitar `FollowListRow` sem adaptação nenhuma. "Sugestões"
 * (sem termo de busca) usa o critério mais honesto disponível —
 * perfis públicos mais recentes que o usuário ainda não segue — sem
 * inventar um ranking de popularidade que não existe.
 */
export async function fetchUserSearch(query: string): Promise<FollowListUser[]> {
  const {
    data: { user: viewer },
  } = await getCurrentAuthUser();

  let profilesQuery = supabase.from("profiles").select("user_id, username, display_name, avatar_url").order("created_at", { ascending: false }).limit(SUGGESTIONS_LIMIT);

  const trimmed = query.trim();
  if (trimmed) {
    profilesQuery = profilesQuery.or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`);
  }
  if (viewer) {
    profilesQuery = profilesQuery.neq("user_id", viewer.id);
  }

  const { data: profiles, error } = await profilesQuery;
  if (error) throw error;

  const ids = (profiles ?? []).map((p) => p.user_id);
  let followsViewerIds = new Set<string>();
  if (viewer && ids.length > 0) {
    const { data: reverseRelations } = await supabase.from("follows").select("follower_id").eq("following_id", viewer.id).in("follower_id", ids);
    followsViewerIds = new Set((reverseRelations ?? []).map((r) => r.follower_id));
  }

  return (profiles ?? []).map((p) => ({
    userId: p.user_id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    followsViewer: followsViewerIds.has(p.user_id),
  }));
}
