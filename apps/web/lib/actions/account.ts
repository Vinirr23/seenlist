"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AccountActionState {
  error: string | null;
}

/**
 * "Alterar nome" — escreve nos DOIS lugares agora. `user_metadata`
 * continua sendo atualizado (compatibilidade com qualquer coisa que
 * ainda leia de lá, incluindo o próprio `useCurrentUser` hoje).
 * `profiles.display_name` é o novo destino real — é o único dos dois
 * que outro usuário consegue ler (user_metadata nunca foi exposto via
 * RLS pra ninguém além do dono). Se a escrita em profiles falhar por
 * algum motivo, não derruba a ação inteira — o nome ainda muda pro
 * próprio usuário, só não fica visível pra outros até uma nova
 * tentativa.
 */
export async function updateName(name: string): Promise<AccountActionState> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { error: "O nome não pode ficar vazio." };

  const supabase = await createClient();
  const { data: userData, error: getUserError } = await supabase.auth.getUser();
  if (getUserError || !userData.user) return { error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
  if (error) {
    console.error("[account] Falha ao alterar nome", error);
    return { error: "Não foi possível salvar o nome agora. Tente de novo." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: trimmed, updated_at: new Date().toISOString() })
    .eq("user_id", userData.user.id);
  if (profileError) {
    console.error("[account] Nome salvo em user_metadata, mas falhou ao sincronizar em profiles", profileError);
  }

  return { error: null };
}

/** "Alterar senha" — Supabase Auth cuida da troca em si; só validamos o básico antes de mandar. */
export async function updatePasswordAction(newPassword: string, confirmPassword: string): Promise<AccountActionState> {
  if (newPassword.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (newPassword !== confirmPassword) return { error: "As senhas não coincidem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error("[account] Falha ao alterar senha", error);
    return { error: "Não foi possível alterar a senha agora. Tente de novo." };
  }
  return { error: null };
}

/**
 * "Excluir conta" — precisa da service role key (só existe no
 * servidor, nunca chega no navegador). Apagar o usuário em
 * `auth.users` já limpa `movie_status`/`series_status`/
 * `watched_episodes` sozinho, via `on delete cascade` (definido nas
 * migrations originais) — não precisa apagar cada tabela na mão.
 *
 * Requer a variável de ambiente `SUPABASE_SERVICE_ROLE_KEY`
 * (Supabase → Project Settings → API → service_role) — não existia
 * antes desta tarefa, precisa ser adicionada ao `.env.local`.
 */
export async function deleteAccount(): Promise<AccountActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("[account] SUPABASE_SERVICE_ROLE_KEY (ou a URL) não está configurada no servidor.");
    return { error: "Exclusão de conta não está configurada neste ambiente ainda." };
  }

  const admin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] Falha ao excluir conta", error);
    return { error: "Não foi possível excluir a conta agora. Tente de novo." };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
