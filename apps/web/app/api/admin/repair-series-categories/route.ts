import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getAllEpisodesWithAirDates, getSeriesSummary } from "@/lib/tmdb/client";
import { decideWatchingVsUpToDate } from "@/lib/queries/airDateCategory";

export const dynamic = "force-dynamic";

const CONCURRENCY = 10;

/**
 * TASK-175 (ferramenta administrativa) — a versão de
 * `repairSeriesCategories.ts` só funciona pra quem está logado
 * (RLS, sessão do próprio navegador) — não dá pra rodar "por"
 * outra pessoa. Esta rota faz a mesma coisa com a chave de
 * serviço (ignora RLS), recebendo o `user_id` de qualquer conta —
 * só o dono do projeto consegue chamar (checagem dupla: sessão
 * logada E e-mail batendo com `ADMIN_EMAIL`, mesmo padrão de
 * `/api/admin/send-beta-invite`).
 */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user && user.email === env.adminEmail());
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: episodeRows, error: episodeError } = await admin
    .from("watched_episodes")
    .select("series_id")
    .eq("user_id", userId)
    .eq("is_special", false);
  if (episodeError) {
    console.error("[admin/repair-series-categories] Falha ao buscar watched_episodes", episodeError);
    return NextResponse.json({ error: "Falha ao buscar episódios assistidos." }, { status: 500 });
  }

  const seriesIds = [...new Set((episodeRows ?? []).map((r) => r.series_id as number))];

  const { data: statusRows, error: statusError } = await admin
    .from("series_status")
    .select("series_id, status")
    .eq("user_id", userId)
    .in("series_id", seriesIds.length > 0 ? seriesIds : [-1]);
  if (statusError) {
    console.error("[admin/repair-series-categories] Falha ao buscar series_status", statusError);
    return NextResponse.json({ error: "Falha ao buscar status atual." }, { status: 500 });
  }
  const statusBySeriesId = new Map((statusRows ?? []).map((r) => [r.series_id as number, r.status as string]));

  let updated = 0;
  let skipped = 0;
  const errors: number[] = [];

  for (let start = 0; start < seriesIds.length; start += CONCURRENCY) {
    const batch = seriesIds.slice(start, start + CONCURRENCY);
    await Promise.all(
      batch.map(async (seriesId) => {
        // Mesma regra de sempre: "paused" é decisão explícita do
        // usuário, nunca mexido aqui — só watching/up_to_date/
        // want_to_watch/sem status (derivado) são elegíveis.
        const currentStatus = statusBySeriesId.get(seriesId) ?? "watching";
        if (currentStatus === "paused" || currentStatus === "removed") {
          skipped++;
          return;
        }

        try {
          const [liveEpisodes, summary, { count: watchedCount }] = await Promise.all([
            getAllEpisodesWithAirDates(String(seriesId)),
            getSeriesSummary(seriesId),
            admin
              .from("watched_episodes")
              .select("*", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("series_id", seriesId)
              .eq("is_special", false),
          ]);

          if (liveEpisodes.length === 0) {
            skipped++;
            return;
          }

          const watched = watchedCount ?? 0;
          const allEpisodesWatched = watched >= liveEpisodes.length;
          const newCategory =
            summary.ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes).category;

          if (newCategory === currentStatus) {
            skipped++;
            return;
          }

          const { error: upsertError } = await admin
            .from("series_status")
            .upsert(
              { user_id: userId, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() },
              { onConflict: "user_id,series_id" }
            );
          if (upsertError) throw upsertError;
          updated++;
        } catch (error) {
          console.error(`[admin/repair-series-categories] Falha na série ${seriesId}`, error);
          errors.push(seriesId);
        }
      })
    );
  }

  return NextResponse.json({ total: seriesIds.length, updated, skipped, errors });
}
