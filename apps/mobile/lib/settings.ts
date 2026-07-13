import { supabase } from "@/lib/supabase";

export type ProfileVisibility = "public" | "followers" | "private";

export interface MyProfileSettings {
  userId: string;
  username: string;
  email: string | null;
  profileVisibility: ProfileVisibility;
  favoritesVisibility: ProfileVisibility;
  libraryVisibility: ProfileVisibility;
}

interface ProfileRow {
  user_id: string;
  username: string;
  profile_visibility: ProfileVisibility;
  favorites_visibility: ProfileVisibility;
  library_visibility: ProfileVisibility;
}

/** Idêntico a useMyProfile do web, só com os campos que a tela de Configurações nativa usa (não busca bio/avatar/banner — isso é da tela de Editar perfil, que ainda não existe no nativo). */
export async function fetchMyProfileSettings(): Promise<MyProfileSettings | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, profile_visibility, favorites_visibility, library_visibility")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as ProfileRow;
  return {
    userId: row.user_id,
    username: row.username,
    email: user.email ?? null,
    profileVisibility: row.profile_visibility,
    favoritesVisibility: row.favorites_visibility,
    libraryVisibility: row.library_visibility,
  };
}

/** Idêntico a useUpdateMyProfile do web, restrito aos 3 campos de visibilidade (mesmo motivo do fetch acima). */
export async function updateVisibility(
  field: "profileVisibility" | "favoritesVisibility" | "libraryVisibility",
  value: ProfileVisibility
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const columnByField: Record<typeof field, string> = {
    profileVisibility: "profile_visibility",
    favoritesVisibility: "favorites_visibility",
    libraryVisibility: "library_visibility",
  };

  const { error } = await supabase
    .from("profiles")
    .update({ [columnByField[field]]: value, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) {
    console.error("[settings] Falha ao atualizar privacidade", error);
    return { error: "Não foi possível salvar agora. Tente de novo." };
  }
  return { error: null };
}

/**
 * TASK-104 (Configurações) — o web troca senha via server action
 * (`updatePasswordAction`); o nativo chama `supabase.auth.updateUser`
 * direto no cliente, mesmo padrão já usado em login/cadastro (sem
 * servidor Next.js no meio). Resultado idêntico.
 */
export async function updatePassword(password: string, confirmPassword: string): Promise<{ error: string | null }> {
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirmPassword) return { error: "As senhas não coincidem." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[settings] Falha ao trocar senha", error);
    return { error: "Não foi possível trocar a senha agora." };
  }
  return { error: null };
}

export type FeedbackType = "bug" | "suggestion" | "other";

/** Idêntico a useSendFeedback do web — mesma tabela `user_feedback`. */
export async function sendFeedback(type: FeedbackType, message: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("user_feedback").insert({ user_id: user.id, type, message });
  if (error) throw error;
}
