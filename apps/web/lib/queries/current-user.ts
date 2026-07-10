import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface CurrentUser {
  id: string;
  email: string;
  /** Nome salvo (se algum provider tiver enviado), senão a parte antes do @ do e-mail. */
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

/**
 * TASK-021 — originalmente só `auth.users` (`user_metadata`), sem
 * tabela. Ajuste (correção de investigação, pós-TASK-028): `profiles`
 * passa a ser a fonte PREFERIDA pra nome/avatar — é a única das duas
 * que outro usuário consegue ler via RLS (user_metadata nunca foi
 * exposto publicamente, é exclusivo do próprio dono). `user_metadata`
 * continua como retaguarda: se por qualquer motivo a linha em
 * `profiles` ainda não existir (ex.: trigger não rodou a tempo) ou o
 * campo estiver vazio, cai de volta pro que já funcionava antes —
 * nunca mostra "Usuário" genérico se havia algo salvo.
 */
async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = data.user;
  if (!user) return null;

  const email = user.email ?? "";
  const metadataName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined;
  const metadataAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = profile?.display_name?.trim() || metadataName?.trim() || email.split("@")[0] || "Usuário";
  const avatarUrl = profile?.avatar_url ?? metadataAvatar;

  return {
    id: user.id,
    email,
    name,
    avatarUrl,
    createdAt: user.created_at,
  };
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
  });
}
