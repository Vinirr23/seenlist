import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries } from "@/lib/library";

/**
 * A PEDIDO (2026-09-15 — sino de notificações no Perfil, web + mobile).
 * Porte fiel de `lib/queries/notifications.ts` do web — mesmo padrão
 * de `lib/recommendations.ts` (busca as linhas, depois busca em lote
 * o perfil de cada `actor_id` distinto e o resumo TMDB de cada mídia
 * distinta via `fetchDisplaySummaries`, reaproveitada da Biblioteca).
 * Ver a migration nova (`20260915010000_notification_triggers_missing_types.sql`)
 * pra causa raiz de por que só 3 dos 7 tipos previstos realmente
 * geravam notificação até agora.
 */

export type NotificationType =
  | "comment_reply"
  | "comment_like"
  | "review_like"
  | "episode_new"
  | "season_premiere"
  | "recommendation"
  | "new_follower"
  | "feedback_reply"
  | "post_like"
  | "new_feedback"
  | "verified_badge"
  // A PEDIDO (2026-10-02 — "manda a notificação pro raylissonx", que
  // ganhou o selo DEPOIS do lançamento) — `verified_badge` original
  // (ver comentário em `app/notifications.tsx`) é o envio ÚNICO do
  // lançamento (29/09), texto fixo "chegaram os selos... primeiros
  // 100 cadastrados". Pra alguém que ganha o selo depois disso, esse
  // texto não faz sentido (não houve "chegada" nenhuma pra ele agora).
  // Tipo novo, texto próprio ("você recebeu o selo"), mesmo ícone
  // (selo do próprio `verified_tier` do usuário — resolvido no client,
  // igual ao tipo original).
  | "verified_badge_granted"
  // LISTA COMPARTILHADA (2026-10-06) — ver
  // `claude/SEENLIST-FEATURE-2026-10-06-lista-compartilhada.md`.
  // `list_coowner_invite` tem botões Aceitar/Recusar inline (ver
  // `app/notifications.tsx`); os outros 3 são só avisos.
  | "list_coowner_invite"
  | "list_coowner_accepted"
  | "list_coowner_declined"
  | "list_coowner_removed"
  | "list_coowner_left";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: { userId: string; username: string; displayName: string | null; avatarUrl: string | null; verifiedTier: "gold" | "blue" | null } | null;
  /**
   * A PEDIDO (2026-09-29 — "curti um post mas não recebi
   * notificação") — causa raiz: curtida em POST nunca tinha tipo de
   * notificação nenhum (só comment/review). `targetType`/`targetId`
   * passam a vir do banco pra dar link direto pro post quando o tipo
   * é `post_like` — os outros tipos continuam linkando por
   * mediaType/mediaId como sempre.
   */
  targetType: "comment" | "review" | "post" | "post_comment" | "profile" | "user_feedback" | "list" | null;
  targetId: string | null;
  mediaType: "movie" | "series" | null;
  mediaId: number | null;
  mediaTitle: string | null;
  mediaPosterPath: string | null;
  message: string | null;
  /** Só preenchido quando `targetType === "list"` (`payload.listName`, ver `inviteCoOwner`/etc. em `lib/lists.ts`). */
  listName: string | null;
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-10-07, bug real reportado — usuário
   * aceita um convite, o card continua mostrando Aceitar/Recusar
   * (porque `type` continua `list_coowner_invite` pra sempre, é um
   * registro histórico), parece que não funcionou, usuário toca
   * "Aceitar" de novo — segunda tentativa cai no `lists_restrict_co_owner_update`
   * do banco (`old.co_owner_status` já não é mais `'pending'`), que
   * RAISE EXCEPTION de propósito (proteção correta contra aceitar 2x) —
   * e essa exceção é o que aparecia como "Algo deu errado" na tela,
   * mesmo a primeira resposta tendo funcionado. Causa raiz não era o
   * trigger (ele está certo), era a UI nunca ter um jeito de saber "já
   * respondi este convite" pra trocar os botões por uma confirmação.
   * Só preenchido pra `type === "list_coowner_invite"`, gravado em
   * `payload.responded` pelo próprio client (`markInviteResponded`
   * abaixo) logo depois de aceitar/recusar com sucesso — não existe
   * coluna nova, só mais um campo no mesmo `payload` jsonb que já
   * guardava `listName`.
   */
  responded: "accepted" | "declined" | null;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotifications(language = "pt-BR"): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("notifications")
    .select("id, type, actor_id, target_type, target_id, target_media_type, target_media_id, payload, read_at, created_at")
    .eq("user_id", user.id)
    // CORREÇÃO DE CAUSA RAIZ (2026-10-07, bug real reportado — "tem uma
    // notificação com um sino que tá bugada ali em cima", print real
    // mostrando uma linha sem mensagem nenhuma, só a data). A linha
    // existe de verdade (migration `20261007030000_whats_new.sql`
    // insere uma por usuário) — não é lixo nem erro de inserção. A
    // causa raiz é de DESIGN: `type: "whats_new"` nunca fez parte da
    // union `NotificationType` (abaixo) nem de `getNotificationMessage`
    // (`app/notifications.tsx`) de propósito — essa linha existe só pra
    // disparar o PUSH (lida por `send-push-notifications`, que não
    // passa por este arquivo), nunca foi pra aparecer como item da
    // lista. A UI de verdade pra "novidades" é o card fixo dedicado
    // (também em `app/notifications.tsx`) + a tela `/whats-new`, que já
    // tratam a mensagem/ícone certos sozinhos. Sem este filtro, a linha
    // cai aqui, `row.type as NotificationType` mascara o tipo que não
    // bate com nenhum `case`, e o switch sem `default` devolve
    // `undefined` — daí o card "fantasma" sem texto nenhum.
    .neq("type", "whats_new")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("user_id, username, display_name, avatar_url, verified_tier").in("user_id", actorIds)
      : {
          data: [] as {
            user_id: string;
            username: string;
            display_name: string | null;
            avatar_url: string | null;
            verified_tier: string | null;
          }[],
        };
  const profileById = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  const movieIds = rows.filter((r) => r.target_media_type === "movie" && r.target_media_id != null).map((r) => r.target_media_id!);
  const seriesIds = rows.filter((r) => r.target_media_type === "series" && r.target_media_id != null).map((r) => r.target_media_id!);
  const summaries = await fetchDisplaySummaries(movieIds, seriesIds, language);

  return rows.map((row) => {
    const actor = row.actor_id ? profileById.get(row.actor_id) : null;
    const summary =
      row.target_media_type === "movie"
        ? summaries.movies[row.target_media_id ?? -1]
        : row.target_media_type === "series"
          ? summaries.series[row.target_media_id ?? -1]
          : undefined;
    const payload = row.payload as { message?: string; listName?: string; responded?: "accepted" | "declined" } | null;

    return {
      id: row.id,
      type: row.type as NotificationType,
      actor: actor
        ? {
            userId: actor.user_id,
            username: actor.username,
            displayName: actor.display_name,
            avatarUrl: actor.avatar_url,
            verifiedTier: (actor.verified_tier as "gold" | "blue" | null) ?? null,
          }
        : null,
      targetType: (row.target_type as AppNotification["targetType"]) ?? null,
      targetId: row.target_id ?? null,
      mediaType: (row.target_media_type as "movie" | "series" | null) ?? null,
      mediaId: row.target_media_id ?? null,
      mediaTitle: summary?.title ?? null,
      mediaPosterPath: summary?.posterPath ?? null,
      message: payload?.message ?? null,
      listName: payload?.listName ?? null,
      responded: payload?.responded ?? null,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  });
}

/** Só a contagem, pra bolinha no sino — não busca perfil nem TMDB, mais leve que a lista inteira. */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    // Mesmo motivo do filtro em `fetchNotifications` acima — a linha de
    // `whats_new` não aparece na lista, então também não deve contar
    // pra bolinha vermelha do sino (teria um número "fantasma" sem
    // nenhum item visível correspondente). O status de "visto" dessa
    // feature é todo separado, via `whats_new_seen_at` (`lib/whatsNew.ts`).
    .neq("type", "whats_new")
    .is("read_at", null);
  if (error) {
    console.error("[notifications] Falha ao contar não lidas", error);
    return 0;
  }
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) throw error;
}

/**
 * Grava, na própria notificação de convite (`payload.responded`), qual
 * foi a resposta — ver o comentário grande em `responded` no tipo
 * `AppNotification` acima pra causa raiz completa. O payload de
 * `list_coowner_invite` só tem `listName` (gravado pelo trigger
 * `lists_notify_coowner_events`, nunca mais nada) — por isso dá pra
 * sobrescrever com segurança em vez de precisar buscar o valor atual
 * primeiro.
 */
export async function markInviteResponded(notificationId: string, listName: string | null, status: "accepted" | "declined"): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ payload: { listName, responded: status } })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (error) throw error;
}
