// supabase/functions/week-review-notify/index.ts
//
// Notificação push "Sua semana no SeenList" (rodada 29, 2026-09-23) —
// segundo passo da pendência "notificação push de domingo à noite" (na
// verdade domingo à TARDE, 15h Brasília — decisão confirmada com o
// usuário via AskUserQuestion nesta rodada, mudando o plano original
// de "à noite").
//
// RESPONSABILIDADE ÚNICA — igual ao padrão já estabelecido em
// `send-push-notifications` (ver comentário no topo daquele arquivo):
// esta function só DECIDE quem deve ser notificado e INSERE a linha em
// `notifications`; quem entrega de verdade (Expo push + Web Push,
// dedução de token, etc.) continua sendo o `send-push-notifications`
// já existente, que roda a cada 2 minutos e vai pegar essas linhas
// novas na primeira passada depois desta function rodar. Nenhuma
// duplicação de lógica de envio.
//
// POR QUE UM JOB SEPARADO DO `week-review-pregenerate` (14h) — os dois
// jobs têm responsabilidades diferentes: pré-geração é sobre CALCULAR
// o destaque + gerar a frase (trabalho pesado: TMDB + Gemini, por
// usuário); notificação é sobre DECIDIR QUANDO avisar. Rodando às 14h,
// a pré-geração dá margem de sobra antes do horário de notificar (15h)
// pra qualquer reprocessamento manual, se precisar — e se este job de
// notificação falhar ou precisar ser reagendado no futuro, não arrisca
// nada do cálculo pesado já feito.
//
// SÓ QUEM TEVE DESTAQUE (decisão confirmada com o usuário via
// AskUserQuestion) — só usuários com uma linha em
// `week_review_pregenerated` pra ESTA semana são notificados. Quem não
// teve atividade nenhuma não recebe nada — evitar "sua semana" vazia,
// que pareceria spam ou erro.
//
// IDEMPOTÊNCIA — se esta function for rodada duas vezes na mesma
// semana (manualmente, por exemplo, do jeito que
// `week-review-pregenerate` foi testado na rodada 28), não deve
// duplicar a notificação. Em vez de depender do índice único global
// `notifications_dedup_idx` (que é (user_id, target_media_id,
// target_season_number, target_episode_number) SEM filtro por tipo —
// ver `20260903000000_notifications_indexes_backfill.sql`), que não
// serve aqui: esse índice assume que cada (mídia, temporada, episódio)
// só gera UMA notificação pra sempre (certo pra episode_new/
// season_premiere, errado pra week_review — é normal a MESMA série/
// temporada ser destaque em semanas diferentes, e cada semana deveria
// notificar de novo). Por isso o `target_episode_number` desta
// notificação é sempre `null` (Postgres nunca trata NULL como
// duplicata de outro NULL num índice único comum — nunca colide com
// esse índice global) e a deduplicação real é feita aqui na mão: uma
// consulta antes do insert, filtrando por `created_at >= weekStartIso`
// — como esta function só roda 1x por semana (e o teste manual da
// rodada 28 mostrou que é seguro rodar fora de hora), isso é
// suficiente pra nunca notificar o mesmo usuário duas vezes pela mesma
// semana.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getBrasiliaCalendarWeekBounds } from "../_shared/weekBounds.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAGE_SIZE = 1000;

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

/** Mesmo padrão de paginação de `week-review-pregenerate`/`daily-status-recalc`. */
async function fetchAllPages<T>(
  supabase: SupabaseClientAny,
  table: string,
  applyFilter: (query: SupabaseClientAny) => SupabaseClientAny,
): Promise<T[]> {
  const { count, error: countError } = await applyFilter(supabase.from(table).select("*", { count: "exact", head: true }));
  if (countError) {
    console.error(`[week-review-notify] Falha ao contar ${table}`, countError);
    return [];
  }
  const pageCount = Math.ceil((count ?? 0) / PAGE_SIZE);
  if (pageCount === 0) return [];

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      const from = i * PAGE_SIZE;
      return applyFilter(supabase.from(table).select("*")).range(from, from + PAGE_SIZE - 1);
    }),
  );

  const rows: T[] = [];
  for (const page of pages) {
    if (page.error) {
      console.error(`[week-review-notify] Falha ao paginar ${table}`, page.error);
      continue;
    }
    rows.push(...((page.data ?? []) as T[]));
  }
  return rows;
}

type PregeneratedRow = {
  user_id: string;
  media_type: "series" | "movie";
  media_id: number;
  season_number: number | null;
  title: string | null;
};

type ExistingNotificationRow = { user_id: string };

async function weekReviewNotify(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY) as SupabaseClientAny;

  const { start } = getBrasiliaCalendarWeekBounds();
  const weekStartIso = start.toISOString();

  const pregenerated = await fetchAllPages<PregeneratedRow>(supabase, "week_review_pregenerated", (q) =>
    q.select("user_id, media_type, media_id, season_number, title").eq("week_start", weekStartIso),
  );

  if (pregenerated.length === 0) {
    console.log(`[week-review-notify] semana ${weekStartIso} — nenhuma linha pré-gerada, nada a notificar`);
    return;
  }

  const userIds = pregenerated.map((row) => row.user_id);

  // Quem já foi notificado nesta semana (reexecução manual, por
  // exemplo) — ver comentário grande no topo do arquivo sobre por que
  // isso substitui o índice único global.
  const alreadyNotified = await fetchAllPages<ExistingNotificationRow>(supabase, "notifications", (q) =>
    q.select("user_id").eq("type", "week_review").in("user_id", userIds).gte("created_at", weekStartIso),
  );
  const alreadyNotifiedIds = new Set(alreadyNotified.map((r) => r.user_id));

  const rowsToInsert = pregenerated
    .filter((row) => !alreadyNotifiedIds.has(row.user_id))
    .map((row) => ({
      user_id: row.user_id,
      type: "week_review" as const,
      target_type: row.media_type,
      target_id: null,
      target_media_type: row.media_type,
      target_media_id: row.media_id,
      target_season_number: row.season_number,
      // Sempre null de propósito — ver comentário grande no topo do
      // arquivo (índice único global `notifications_dedup_idx`).
      target_episode_number: null,
      payload: { title: row.title, weekStart: weekStartIso },
    }));

  if (rowsToInsert.length === 0) {
    console.log(`[week-review-notify] semana ${weekStartIso} — ${pregenerated.length} elegíveis, todos já notificados`);
    return;
  }

  const { error: insertError } = await supabase.from("notifications").insert(rowsToInsert);
  if (insertError) {
    console.error("[week-review-notify] Falha ao inserir notificações", insertError);
    return;
  }

  console.log(
    `[week-review-notify] semana ${weekStartIso} — ${rowsToInsert.length} notificações inseridas (${pregenerated.length - rowsToInsert.length} já notificados antes)`,
  );
}

Deno.serve(() => {
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(weekReviewNotify());
  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
