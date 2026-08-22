import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getAllEpisodesWithAirDates, getSeriesSummary } from "@/lib/tmdb/client";
import { resolveSeriesCategory, shouldWriteSeriesCategory } from "@/lib/queries/airDateCategory";

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

  // TASK-175 (correção — achado real, comprovado por SQL direto: 127
  // séries de verdade, mas a rota só via 6) — o Supabase limita a
  // 1000 linhas por consulta por padrão. Sem paginação explícita, uma
  // conta com muitos episódios assistidos (aqui, centenas de séries
  // × vários episódios cada) batia nesse teto silenciosamente —
  // mesmo bug de sempre, mesmo padrão de correção já usado em
  // `fetchAllWatchedEpisodeRows` (lib/queries/library-state.ts).
  const PAGE_SIZE = 1000;
  const { count: episodeRowCount, error: countError } = await admin
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_special", false);
  if (countError) {
    console.error("[admin/repair-series-categories] Falha ao contar watched_episodes", countError);
    return NextResponse.json({ error: "Falha ao contar episódios assistidos." }, { status: 500 });
  }

  const total = episodeRowCount ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const episodePages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * PAGE_SIZE;
      return admin
        .from("watched_episodes")
        .select("series_id")
        .eq("user_id", userId)
        .eq("is_special", false)
        .range(from, from + PAGE_SIZE - 1);
    })
  );

  const episodeRows: { series_id: number }[] = [];
  for (const page of episodePages) {
    if (page.error) {
      console.error("[admin/repair-series-categories] Falha ao buscar página de watched_episodes", page.error);
      return NextResponse.json({ error: "Falha ao buscar episódios assistidos." }, { status: 500 });
    }
    episodeRows.push(...((page.data ?? []) as { series_id: number }[]));
  }

  const seriesIds = [...new Set(episodeRows.map((r) => r.series_id))];

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

  /*
   * CORREÇÃO (bug real, reportado — "Corrigir status das séries"
   * jogou várias séries terminadas/em dia de volta pra "Assistindo")
   * — mesma causa raiz documentada em `airDateCategory.ts`: episódio
   * marcado como especial pelo TV Time (`is_special = true`, pode
   * estar DENTRO de uma temporada normal, não só temporada 0) é
   * excluído da contagem de assistidos, mas continuava contando do
   * lado do TMDB — série com qualquer especial nunca "batia" a conta,
   * nunca virava completed/up_to_date. Busca em lote (mesmo padrão de
   * `statusRows` acima) pra não fazer 1 consulta a mais por série
   * dentro do loop de concorrência abaixo.
   */
  const { data: specialRows, error: specialError } = await admin
    .from("watched_episodes")
    .select("series_id, season_number, episode_number")
    .eq("user_id", userId)
    .eq("is_special", true)
    .in("series_id", seriesIds.length > 0 ? seriesIds : [-1]);
  if (specialError) {
    console.error("[admin/repair-series-categories] Falha ao buscar episódios especiais", specialError);
    return NextResponse.json({ error: "Falha ao buscar episódios especiais." }, { status: 500 });
  }
  const specialKeysBySeriesId = new Map<number, Set<string>>();
  for (const row of (specialRows ?? []) as { series_id: number; season_number: number; episode_number: number }[]) {
    const set = specialKeysBySeriesId.get(row.series_id) ?? new Set<string>();
    set.add(`${row.season_number}-${row.episode_number}`);
    specialKeysBySeriesId.set(row.series_id, set);
  }

  let updated = 0;
  let skipped = 0;
  const errors: number[] = [];

  for (let start = 0; start < seriesIds.length; start += CONCURRENCY) {
    const batch = seriesIds.slice(start, start + CONCURRENCY);
    await Promise.all(
      batch.map(async (seriesId) => {
        // "removed" continua de fora, sem exceção — série removida da
        // biblioteca não deveria ganhar status nenhum de volta sozinha.
        // "paused" agora entra no cálculo normalmente — a proteção
        // (nunca deixar paused virar watching sozinho) mora em
        // `shouldWriteSeriesCategory`, chamada mais abaixo, a MESMA
        // função usada pelas outras 2 implementações (unificação, ver
        // airDateCategory.ts).
        const currentStatus = statusBySeriesId.get(seriesId) ?? "watching";
        if (currentStatus === "removed") {
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
          const specialEpisodeKeys = specialKeysBySeriesId.get(seriesId) ?? new Set<string>();
          // UNIFICAÇÃO (ver airDateCategory.ts) — mesmas duas funções
          // usadas por `seriesCategoryRecalc.ts` (recálculo em lote e
          // individual). Esta rota não reimplementa mais a decisão
          // nem as regras de gravação por conta própria.
          //
          // CORREÇÃO (typecheck real reportado pelo usuário — "Type
          // 'boolean | undefined' is not assignable to type
          // 'boolean'") — `MediaSummary.ended` é opcional (o mesmo
          // tipo cobre filme, que não tem esse conceito), mas
          // `resolveSeriesCategory` exige `boolean`. Mesmo padrão já
          // usado em todo o resto do código (`endedBySeriesId.get(...)
          // ?? false` em seriesCategoryRecalc.ts e no mobile): série
          // sem dado confiável de "terminou?" trata como "não
          // terminou" — mais seguro do que assumir o contrário.
          const { category: newCategory } = resolveSeriesCategory({
            watched,
            liveEpisodes,
            ended: summary.ended ?? false,
            specialEpisodeKeys,
          });

          if (!shouldWriteSeriesCategory(currentStatus, newCategory)) {
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
