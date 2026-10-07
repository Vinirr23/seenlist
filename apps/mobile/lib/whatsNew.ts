import { supabase, getCurrentAuthUser } from "@/lib/supabase";

/**
 * NOVO (2026-10-07) — "Novidades": notificação + modal comemorativo
 * (A) + tela permanente (B), ver migration `20261007030000_whats_new.sql`
 * pro raciocínio completo das 3 decisões arquiteturais travadas com o
 * usuário (conteúdo em tabela, acesso pelo sino, só mobile por agora).
 *
 * Padrão deliberadamente IGUAL ao de `fetchUnreadNotificationCount` em
 * `lib/notifications.ts`: uma busca leve e INDEPENDENTE do cache
 * versionado de `useCurrentUser.ts` — não faz sentido bumpar
 * `CURRENT_USER_CACHE_VERSION` só pra um dado que muda toda vez que sai
 * uma novidade nova, e que nenhuma outra tela do app precisa saber.
 */

export interface WhatsNewEntry {
  id: string;
  title: string;
  description: string;
  iconKey: string;
  createdAt: string;
}

export async function fetchWhatsNewEntries(): Promise<WhatsNewEntry[]> {
  const { data, error } = await supabase
    .from("whats_new_entries")
    .select("id, title, description, icon_key, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    iconKey: row.icon_key,
    createdAt: row.created_at,
  }));
}

/**
 * Pra bolinha de "não visto" no card do sino e pro modal comemorativo —
 * compara `profiles.whats_new_seen_at` contra a entrada mais recente.
 * Sem sessão, ou sem nenhuma entrada ainda cadastrada, não há nada pra
 * marcar como não visto.
 */
export async function fetchWhatsNewUnseen(): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const [{ data: latest }, { data: profile }] = await Promise.all([
    supabase.from("whats_new_entries").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("whats_new_seen_at").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!latest) return false;
  if (!profile?.whats_new_seen_at) return true;
  return new Date(latest.created_at).getTime() > new Date(profile.whats_new_seen_at).getTime();
}

export async function markWhatsNewSeen(): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  const { error } = await supabase.from("profiles").update({ whats_new_seen_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) console.error("[whatsNew] Falha ao marcar como visto", error);
}
