import { supabase } from "@/lib/supabase";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * TASK-116 (correção — Perfil) — porta de `current-user.ts`.
 * `profiles.display_name`/`avatar_url` são a fonte preferida (é a
 * única que outro usuário consegue ler via RLS); `user_metadata` é
 * retaguarda pra nunca mostrar "Usuário" genérico se havia algo
 * salvo só lá.
 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = data.user;
  if (!user) return null;

  const email = user.email ?? "";
  const metadataName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined;
  const metadataAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle();

  const name = profile?.display_name?.trim() || metadataName?.trim() || email.split("@")[0] || "Usuário";
  const avatarUrl = profile?.avatar_url ?? metadataAvatar;

  return { id: user.id, email, name, avatarUrl, createdAt: user.created_at };
}
