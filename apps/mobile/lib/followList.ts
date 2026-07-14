import { supabase, getCurrentAuthUser } from "@/lib/supabase";

export interface FollowListUser {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Esse usuário segue quem está vendo a lista (mesma regra do web — "Segue você"). */
  followsViewer: boolean;
}

export type FollowDirection = "following" | "followers";

/**
 * TASK-107 (Seguidores/Seguindo) — porta de `follow-list.ts`.
 * Reaproveita a tabela `follows` que já existia — nenhuma tabela
 * nova. `direction: "following"` = quem `userId` segue;
 * `"followers"` = quem segue `userId`. Mesma consulta serve pras
 * duas direções, só troca qual coluna é o filtro e qual é o "outro".
 */
export async function fetchFollowList(userId: string, direction: FollowDirection, search: string): Promise<FollowListUser[]> {
  const {
    data: { user: viewer },
  } = await getCurrentAuthUser();

  const relationColumn = direction === "following" ? "follower_id" : "following_id";
  const otherColumn = direction === "following" ? "following_id" : "follower_id";

  const { data: relations, error: relationsError } = await supabase.from("follows").select(otherColumn).eq(relationColumn, userId);
  if (relationsError) throw relationsError;

  const otherIds = [...new Set((relations ?? []).map((r) => (r as Record<string, string>)[otherColumn]))];
  if (otherIds.length === 0) return [];

  let query = supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", otherIds);
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.or(`username.ilike.%${trimmedSearch}%,display_name.ilike.%${trimmedSearch}%`);
  }

  const { data: profiles, error: profilesError } = await query;
  if (profilesError) throw profilesError;

  // "Segue você" — quem, dentre esses, segue o VIEWER (não o dono da lista sendo vista).
  let followsViewerIds = new Set<string>();
  if (viewer) {
    const { data: reverseRelations } = await supabase.from("follows").select("follower_id").eq("following_id", viewer.id).in("follower_id", otherIds);
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
