import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import type { UserProfile, ProfileVisibility } from "./social-types";

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  country: string | null;
  language: string;
  profile_visibility: ProfileVisibility;
  favorites_visibility: ProfileVisibility;
  library_visibility: ProfileVisibility;
  created_at: string;
}

function fromRow(row: ProfileRow): UserProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    bannerUrl: row.banner_url,
    country: row.country,
    language: row.language,
    profileVisibility: row.profile_visibility,
    favoritesVisibility: row.favorites_visibility,
    libraryVisibility: row.library_visibility,
    createdAt: row.created_at,
  };
}

/**
 * TASK-028, item 11: "informações básicas imediatamente" — só isso
 * é buscado aqui. Biblioteca/favoritos são hooks separados,
 * carregados só quando a seção correspondente realmente renderiza
 * (lazy).
 *
 * A RLS de `profiles` (ver migration) já filtra por visibilidade —
 * se vier `null` aqui pode ser "não existe esse username" OU "existe
 * mas é privado e você não pode ver"; a tela trata os dois casos com
 * a mesma mensagem, de propósito (não revela QUE existe um perfil
 * privado com aquele nome).
 */
export function usePublicProfile(username: string | null) {
  return useQuery({
    queryKey: ["public-profile", username],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!username) return null;
      const supabase = createClient();
      const { data, error } = await supabase.from("profiles").select("*").ilike("username", username).maybeSingle();
      if (error) {
        console.error("[profile] Falha ao buscar perfil público", describeSupabaseError(error));
        throw error;
      }
      return data ? fromRow(data as ProfileRow) : null;
    },
    enabled: Boolean(username),
  });
}

export function useFollowCounts(userId: string | null) {
  return useQuery({
    queryKey: ["follow-counts", userId],
    queryFn: async () => {
      if (!userId) return { followers: 0, following: 0 };
      const supabase = createClient();
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      if (followers.error) console.error("[follow] Falha ao contar seguidores", followers.error);
      if (following.error) console.error("[follow] Falha ao contar seguindo", following.error);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
    enabled: Boolean(userId),
  });
}
