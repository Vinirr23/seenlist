import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
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

export const MY_PROFILE_QUERY_KEY = ["my-profile"] as const;

/**
 * TASK-028 — todo usuário ganha uma linha em `profiles`
 * automaticamente (trigger no cadastro + backfill pra quem já
 * existia, ver a migration). Se por algum motivo não existir ainda,
 * `data` vem `null` — a tela trata isso mostrando estado de
 * carregamento/erro, nunca quebra.
 */
async function fetchMyProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return null;

  const response = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  const { data, error, status, statusText } = response;

  if (error) {
    console.error("[profile] Falha ao buscar o próprio perfil", describeSupabaseError(error, { status, statusText }));
    throw error;
  }
  return data ? fromRow(data as ProfileRow) : null;
}

export function useMyProfile() {
  return useQuery({ queryKey: MY_PROFILE_QUERY_KEY, queryFn: fetchMyProfile });
}

export interface UpdateProfileInput {
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  bannerUrl?: string | null;
  country?: string | null;
  language?: string;
  profileVisibility?: ProfileVisibility;
  favoritesVisibility?: ProfileVisibility;
  libraryVisibility?: ProfileVisibility;
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return {
    async mutate(input: UpdateProfileInput): Promise<{ error: string | null }> {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return { error: "Sessão expirada. Entre novamente." };

      const payload: Record<string, unknown> = {};
      if (input.username !== undefined) payload.username = input.username;
      if (input.displayName !== undefined) payload.display_name = input.displayName;
      if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
      if (input.bio !== undefined) payload.bio = input.bio;
      if (input.bannerUrl !== undefined) payload.banner_url = input.bannerUrl;
      if (input.country !== undefined) payload.country = input.country;
      if (input.language !== undefined) payload.language = input.language;
      if (input.profileVisibility !== undefined) payload.profile_visibility = input.profileVisibility;
      if (input.favoritesVisibility !== undefined) payload.favorites_visibility = input.favoritesVisibility;
      if (input.libraryVisibility !== undefined) payload.library_visibility = input.libraryVisibility;
      payload.updated_at = new Date().toISOString();

      const { error } = await supabase.from("profiles").update(payload).eq("user_id", user.id);
      if (error) {
        console.error("[profile] Falha ao atualizar perfil", describeSupabaseError(error));
        if (error.code === "23505") return { error: "Esse username já está em uso." };
        return { error: "Não foi possível salvar agora. Tente de novo." };
      }

      queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
      return { error: null };
    },
  };
}
