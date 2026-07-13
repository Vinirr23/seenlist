import { supabase } from "@/lib/supabase";

export interface EditableProfile {
  name: string;
  username: string;
  bio: string;
  country: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

/**
 * TASK-105/111 (Editar perfil) — combina `user_metadata` (nome/foto)
 * com `profiles` (username/bio/país/banner), mesma fonte dupla de
 * `useCurrentUser` do web: `profiles.display_name`/`avatar_url` são
 * a fonte preferida (é a única que outro usuário consegue ler via
 * RLS); `user_metadata` é retaguarda pra nunca mostrar campo vazio
 * se havia algo salvo só lá.
 */
export async function fetchEditableProfile(): Promise<EditableProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const metadataName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined;
  const metadataAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, country, avatar_url, banner_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    name: profile?.display_name || metadataName || "",
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
    country: profile?.country ?? "",
    avatarUrl: profile?.avatar_url ?? metadataAvatar,
    bannerUrl: profile?.banner_url ?? null,
  };
}

/**
 * Duas escritas independentes (nome via `user_metadata` + sincronizado
 * em `profiles.display_name`; username/bio/país direto em `profiles`),
 * salvas juntas quando a pessoa toca "Salvar" — mesma decisão do web:
 * uma ação só do ponto de vista de quem usa, mesmo sendo dois destinos
 * por trás.
 */
export async function saveEditableProfile(input: {
  name: string;
  username: string;
  bio: string;
  country: string;
}): Promise<{ error: string | null }> {
  const trimmedName = input.name.trim();
  const trimmedUsername = input.username.trim();
  if (!trimmedName) return { error: "O nome não pode ficar vazio." };
  if (!trimmedUsername) return { error: "O username não pode ficar vazio." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const { error: authError } = await supabase.auth.updateUser({ data: { full_name: trimmedName } });
  if (authError) {
    console.error("[editProfile] Falha ao alterar nome", authError);
    return { error: "Não foi possível salvar o nome agora. Tente de novo." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      display_name: trimmedName,
      username: trimmedUsername,
      bio: input.bio.trim() || null,
      country: input.country.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (profileError) {
    console.error("[editProfile] Falha ao salvar perfil", profileError);
    if ((profileError as { code?: string }).code === "23505") return { error: "Esse username já está em uso." };
    return { error: "Não foi possível salvar agora. Tente de novo." };
  }

  return { error: null };
}
