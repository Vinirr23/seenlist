// supabase/functions/send-push-notifications/index.ts
//
// TASK-052 — responsabilidade única: pegar notificações com
// `pushed_at is null`, montar a mensagem + deep link, mandar pra API
// de push do Expo, e marcar como enviada. NUNCA decide "se" notificar
// (isso já foi decidido por quem inseriu a linha em `notifications` —
// os triggers de comentário/curtida, ou o check-new-releases) — só
// entrega o que já está pendente.
//
// Roda com frequência curta (ex.: a cada 2 minutos, ver
// README-cron.md) — não precisa ser diário como o check-new-releases,
// já que comment_reply/comment_like/review_like acontecem a qualquer
// hora.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // limite da API do Expo por requisição

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  target_type: string | null;
  target_id: string | null;
  target_media_type: string | null;
  target_media_id: number | null;
  target_season_number: number | null;
  target_episode_number: number | null;
  group_count: number;
  payload: Record<string, string | number> | null;
}

/**
 * TASK-052 — um lugar só decide o texto e o link de cada tipo. Se um
 * tipo novo for adicionado no futuro, é só acrescentar um case aqui —
 * evita a mesma lógica duplicada em dois lugares (app mobile pra
 * quando o usuário toca, e aqui pro corpo do push).
 */
function buildMessage(
  n: NotificationRow,
  actorName: string | null,
  commentContext: { mediaType: string; mediaId: number; seasonNumber: number | null; episodeNumber: number | null } | null
): { title: string; body: string; deepLink: string } | null {
  switch (n.type) {
    case "episode_new": {
      const seriesTitle = n.payload?.seriesTitle ?? "";
      const episodeCode = n.payload?.episodeCode ?? "";
      const episodeName = n.payload?.episodeName ?? "";
      return {
        title: "📺 Novo episódio disponível",
        body: `${seriesTitle}: ${episodeCode} — ${episodeName}`,
        deepLink: `/series/${n.target_media_id}/season/${n.target_season_number}/episode/${n.target_episode_number}`,
      };
    }
    case "season_premiere": {
      const seriesTitle = n.payload?.seriesTitle ?? "";
      return {
        title: "🎬 Nova temporada disponível",
        body: `${seriesTitle} Temporada ${n.target_season_number} estreou hoje.`,
        deepLink: `/series/${n.target_media_id}`,
      };
    }
    case "comment_reply": {
      if (!commentContext) return null;
      const link = commentDeepLink(commentContext, n.target_id);
      return { title: "💬 Nova resposta", body: `${actorName ?? "Alguém"} respondeu seu comentário.`, deepLink: link };
    }
    case "comment_like": {
      if (!commentContext) return null;
      const link = commentDeepLink(commentContext, n.target_id);
      const body =
        n.group_count > 1
          ? `${n.group_count} pessoas curtiram seu comentário.`
          : `${actorName ?? "Alguém"} curtiu seu comentário.`;
      return { title: "❤️ Curtida", body, deepLink: link };
    }
    case "review_like": {
      if (!commentContext) return null;
      const link = `/${commentContext.mediaType === "movie" ? "movies" : "series"}/${commentContext.mediaId}#review-${n.target_id}`;
      const body =
        n.group_count > 1 ? `${n.group_count} pessoas curtiram sua review.` : `${actorName ?? "Alguém"} curtiu sua review.`;
      return { title: "⭐ Curtida", body, deepLink: link };
    }
    default:
      return null;
  }
}

function commentDeepLink(
  ctx: { mediaType: string; mediaId: number; seasonNumber: number | null; episodeNumber: number | null },
  commentId: string | null
): string {
  const base = ctx.mediaType === "movie" ? `/movies/${ctx.mediaId}/comments` : `/series/${ctx.mediaId}/comments`;
  const withEpisode =
    ctx.seasonNumber != null && ctx.episodeNumber != null
      ? `/series/${ctx.mediaId}/season/${ctx.seasonNumber}/episode/${ctx.episodeNumber}/comments`
      : base;
  return `${withEpisode}?highlight=${commentId}`;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: pending, error } = await supabase
    .from("notifications")
    .select("*")
    .is("pushed_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[send-push-notifications] Falha ao buscar pendentes", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  // Actor names (só pro que precisa: comment_reply/comment_like/review_like)
  const actorIds = [...new Set(pending.map((n) => n.actor_id).filter((id): id is string => !!id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("user_id, display_name, username").in("user_id", actorIds)
    : { data: [] as { user_id: string; display_name: string | null; username: string }[] };
  const actorNameById = new Map((actors ?? []).map((a) => [a.user_id, a.display_name || a.username]));

  // Contexto de comentário/review (media_type/id/season/episode) — só lookup interno, não é TMDB.
  const commentIds = pending.filter((n) => n.type.startsWith("comment_")).map((n) => n.target_id).filter(Boolean) as string[];
  const reviewIds = pending.filter((n) => n.type === "review_like").map((n) => n.target_id).filter(Boolean) as string[];

  const { data: commentRows } = commentIds.length
    ? await supabase.from("comments").select("id, media_type, media_id, season_number, episode_number").in("id", commentIds)
    : { data: [] };
  const { data: reviewRows } = reviewIds.length
    ? await supabase.from("reviews").select("id, media_type, media_id, season_number, episode_number").in("id", reviewIds)
    : { data: [] };

  const contextById = new Map(
    [...(commentRows ?? []), ...(reviewRows ?? [])].map((r) => [
      r.id,
      { mediaType: r.media_type, mediaId: r.media_id, seasonNumber: r.season_number, episodeNumber: r.episode_number },
    ])
  );

  // Tokens de todos os destinatários de uma vez.
  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: tokenRows } = await supabase.from("push_tokens").select("id, user_id, token").in("user_id", userIds);
  const tokensByUser = new Map<string, { id: string; token: string }[]>();
  for (const t of tokenRows ?? []) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push({ id: t.id, token: t.token });
    tokensByUser.set(t.user_id, list);
  }

  const expoMessages: { to: string; title: string; body: string; data: { deepLink: string; notificationId: string } }[] = [];
  const processedNotificationIds: string[] = [];
  const tokenIdByExpoToken = new Map<string, string>();

  for (const n of pending as NotificationRow[]) {
    const context = n.target_id ? contextById.get(n.target_id) ?? null : null;
    const message = buildMessage(n, n.actor_id ? actorNameById.get(n.actor_id) ?? null : null, context ?? null);

    processedNotificationIds.push(n.id); // marcada como processada de qualquer forma — sem tokens não significa "tentar de novo depois"

    if (!message) continue;

    const tokens = tokensByUser.get(n.user_id) ?? [];
    for (const t of tokens) {
      tokenIdByExpoToken.set(t.token, t.id);
      expoMessages.push({ to: t.token, title: message.title, body: message.body, data: { deepLink: message.deepLink, notificationId: n.id } });
    }
  }

  let sentCount = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < expoMessages.length; i += BATCH_SIZE) {
    const batch = expoMessages.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const result = await response.json();
      const tickets: { status: string; details?: { error?: string } }[] = result.data ?? [];

      tickets.forEach((ticket, index) => {
        const originalMessage = batch[index];
        if (ticket.status === "ok") {
          sentCount += 1;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(originalMessage.to);
        } else {
          console.error("[send-push-notifications] Ticket com erro", ticket);
        }
      });
    } catch (error) {
      console.error("[send-push-notifications] Falha ao chamar API do Expo", error);
    }
  }

  // Remove tokens inválidos automaticamente (item explícito da tarefa).
  if (invalidTokens.length > 0) {
    const idsToRemove = invalidTokens.map((t) => tokenIdByExpoToken.get(t)).filter((id): id is string => !!id);
    if (idsToRemove.length > 0) {
      await supabase.from("push_tokens").delete().in("id", idsToRemove);
    }
  }

  // Marca todas as notificações processadas nesta rodada — mesmo as
  // que não tinham token (usuário sem dispositivo registrado): não
  // ficam pendentes pra sempre, só não geraram push nenhum.
  if (processedNotificationIds.length > 0) {
    await supabase.from("notifications").update({ pushed_at: new Date().toISOString() }).in("id", processedNotificationIds);
  }

  return new Response(
    JSON.stringify({ processed: processedNotificationIds.length, sent: sentCount, invalidTokensRemoved: invalidTokens.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
