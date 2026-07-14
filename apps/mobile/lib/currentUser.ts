import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * TASK-116/135 (correção — Perfil) — porta de `current-user.ts`.
 * `profiles.display_name`/`avatar_url` são a fonte preferida (é a
 * única que outro usuário consegue ler via RLS); `user_metadata` é
 * retaguarda pra nunca mostrar "Usuário" genérico se havia algo
 * salvo só lá.
 *
 * Correção (TASK-135 — sessão "sumindo"): antes chamava
 * `supabase.auth.getUser()` aqui dentro — essa chamada faz uma
 * validação de rede contra o servidor e pode falhar com
 * "AuthSessionMissingError" se rodar antes do cliente Supabase
 * terminar de carregar a sessão salva na memória (confirmado por
 * log: `getSession()` achava a sessão, `getUser()` não achava a
 * MESMA sessão, milissegundos depois). Agora recebe o `User` já
 * confirmado pelo `AuthProvider` (via `useAuth()`), que usa
 * `getSession()` — sem chamada de rede redundante, sem essa corrida.
 */
export async function fetchCurrentUser(user: User): Promise<CurrentUser> {
  const email = user.email ?? "";
  const metadataName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined;
  const metadataAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  const { data: profile } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle();

  const name = profile?.display_name?.trim() || metadataName?.trim() || email.split("@")[0] || "Usuário";
  const avatarUrl = profile?.avatar_url ?? metadataAvatar;

  return { id: user.id, email, name, avatarUrl, createdAt: user.created_at };
}
