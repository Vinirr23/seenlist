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
  // CORREÇÃO (2026-08-26, achado real ao investigar "Corrigir status
  // das séries desmarcou meus episódios") — esta consulta já tinha
  // sido paginada (comentário acima, TASK-175), mas continuava SEM
  // `.order()` antes do `.range()`, o mesmo defeito raiz já corrigido
  // em `seriesCategoryRecalc.ts`/`check-new-releases`/
  // `send-push-notifications`: sem ordenação explícita, o Postgres
  // não garante que a página 2 comece exatamente onde a página 1
  // parou — numa conta com muitas linhas (a paginação abaixo busca
  // TODAS em paralelo), séries inteiras podiam ser puladas
  // silenciosamente aqui, e como esta lista (`seriesIds`, logo
  // abaixo) é a que decide QUAIS séries a ferramenta vai recalcular,
  // uma série pulada aqui simplesmente nunca tinha o status
  // recalculado nessa passada — sem erro nenhum. Ordenado pelas
  // mesmas colunas da paginação irmã (`watchedPages`, mais abaixo:
  // series_id, season_number, episode_number) mesmo sem elas estarem
  // no `.select()` — o PostgREST aceita ordenar por coluna que existe
  // na tabela mesmo sem estar selecionada.
  const episodePages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * PAGE_SIZE;
      return admin
        .from("watched_episodes")
        .select("series_id")
        .eq("user_id", userId)
        .eq("is_special", false)
        .order("series_id", { ascending: true })
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true })
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

  /*
   * CORREÇÃO (investigação do Bleach, 2026-08-25 — ver comentário
   * grande em `airDateCategory.ts`) — antes, esta rota buscava só um
   * TOTAL de episódios assistidos por série (`count`, um round-trip
   * por série dentro do loop de concorrência abaixo) e comparava
   * contra o total do TMDB. Uma importação bagunçada podia inflar
   * esse total sem que os episódios certos estivessem, de fato,
   * marcados (achado real: Bleach tinha 769 linhas de episódio
   * assistido gravadas pra uma série de 366 episódios) — o total
   * "batia e sobrava" mesmo com episódio pendente de verdade. Busca
   * em lote, paginada (mesmo padrão de `episodeRows` acima), a lista
   * real de (temporada, episódio) assistidos por série — decisão por
   * IDENTIDADE, não por total. Também elimina 1 round-trip de banco
   * por série dentro do loop de concorrência, já que agora vem tudo
   * pré-buscado.
   */
  const watchedEpisodeKeysBySeriesId = new Map<number, Set<string>>();
  {
    const { count: watchedRowCount, error: watchedCountError } = await admin
      .from("watched_episodes")
      .select("series_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_special", false)
      .in("series_id", seriesIds.length > 0 ? seriesIds : [-1]);
    if (watchedCountError) {
      console.error("[admin/repair-series-categories] Falha ao contar episódios assistidos (identidade)", watchedCountError);
      return NextResponse.json({ error: "Falha ao contar episódios assistidos." }, { status: 500 });
    }

    /*
     * CORREÇÃO (bug real, reportado — várias séries sem relação
     * nenhuma entre si mudando de categoria ao mesmo tempo, incluindo
     * terminadas voltando pra "Assistindo"/"Em dia") — as páginas
     * abaixo eram buscadas em PARALELO sem nenhuma ordenação
     * (`.order()`) explícita. Sem isso, o Postgres/PostgREST não
     * garante que a página 2 comece exatamente onde a página 1 parou —
     * numa conta com muitas linhas (achado real: 16.020 no total, 17
     * páginas de uma vez), isso podia deixar buracos: linhas de uma
     * série específica que não apareciam em NENHUMA página, gerando um
     * Set incompleto pra ela (episódio de verdade assistido, mas fora
     * do Set) — decisão errada de "tem pendência". Mesma correção
     * aplicada em `seriesCategoryRecalc.ts` (ver comentário grande lá,
     * com a evidência real que confirmou a causa). Ordenar por
     * `(series_id, season_number, episode_number)` — mesma ordem das
     * colunas que sobram da chave primária depois de `user_id` (fixo
     * pelo filtro) — torna a paginação determinística.
     */
    const watchedTotal = watchedRowCount ?? 0;
    const watchedPageCount = Math.ceil(watchedTotal / PAGE_SIZE);
    const watchedPages = await Promise.all(
      Array.from({ length: watchedPageCount }, (_, index) => {
        const from = index * PAGE_SIZE;
        return admin
          .from("watched_episodes")
          .select("series_id, season_number, episode_number")
          .eq("user_id", userId)
          .eq("is_special", false)
          .in("series_id", seriesIds.length > 0 ? seriesIds : [-1])
          .order("series_id", { ascending: true })
          .order("season_number", { ascending: true })
          .order("episode_number", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
      })
    );
    for (const page of watchedPages) {
      if (page.error) {
        console.error("[admin/repair-series-categories] Falha ao buscar página de episódios assistidos", page.error);
        return NextResponse.json({ error: "Falha ao buscar episódios assistidos." }, { status: 500 });
      }
      for (const row of (page.data ?? []) as { series_id: number; season_number: number; episode_number: number }[]) {
        const set = watchedEpisodeKeysBySeriesId.get(row.series_id) ?? new Set<string>();
        set.add(`${row.season_number}-${row.episode_number}`);
        watchedEpisodeKeysBySeriesId.set(row.series_id, set);
      }
    }
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
          const [liveEpisodes, summary] = await Promise.all([
            getAllEpisodesWithAirDates(String(seriesId)),
            getSeriesSummary(seriesId),
          ]);

          if (liveEpisodes.length === 0) {
            skipped++;
            return;
          }

          const watchedEpisodeKeys = watchedEpisodeKeysBySeriesId.get(seriesId) ?? new Set<string>();
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
            watchedEpisodeKeys,
            liveEpisodes,
            ended: summary.ended ?? false,
            specialEpisodeKeys,
          });

          if (!shouldWriteSeriesCategory(currentStatus, newCategory)) {
            skipped++;
            return;
          }

          // CORREÇÃO (2026-08-26 — "rede de segurança de 3 partes",
          // parte B) — trocado o `.upsert()` direto pela RPC
          // `set_series_status_with_history` (migration
          // `20260908000000_series_status_safety_net.sql`): grava o
          // status E uma linha em `series_status_history` na MESMA
          // transação, já com `source = 'admin_repair'` — distingue
          // esta ferramenta administrativa de um recálculo automático
          // ou do job diário, pra qualquer investigação futura.
          const { error: upsertError } = await admin.rpc("set_series_status_with_history", {
            p_user_id: userId,
            p_series_id: seriesId,
            p_status: newCategory,
            p_source: "admin_repair",
          });
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
