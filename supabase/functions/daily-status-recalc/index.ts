// supabase/functions/daily-status-recalc/index.ts
//
// "Rede de segurança de 3 partes", parte (a) — job diário de
// autocorreção. Decisão do usuário (AskUserQuestion, 2026-08-26,
// opção recomendada): roda 1x por dia, passa por TODOS os usuários, e
// reaplica a MESMA lógica de recálculo de status já usada no botão
// "Corrigir status das séries" (repairAllSeriesCategories.ts /
// app/api/admin/repair-series-categories/route.ts) — corrige sozinho,
// sem precisar de ação de ninguém.
//
// Mesmo padrão arquitetural de `check-new-releases` (Edge Function já
// existente): uma chamada ao TMDB por SÉRIE ÚNICA, não por usuário —
// se 500 pessoas acompanham a mesma série, é 1 chamada TMDB, não 500.
// `EdgeRuntime.waitUntil` responde na hora e deixa o processamento de
// verdade rodar por trás, sem prazo imposto por quem chamou o cron.
//
// IMPORTANTE — este arquivo é uma TERCEIRA cópia da lógica de decisão
// de categoria (`decideWatchingVsUpToDate`/`resolveSeriesCategory`/
// `shouldWriteSeriesCategory`), depois de `apps/web/lib/queries/
// airDateCategory.ts` e `apps/mobile/lib/seriesDetails.ts` — Edge
// Functions rodam em Deno, não conseguem importar direto do código do
// Next.js/Expo. Qualquer mudança futura nessa lógica (ex.: uma nova
// correção de bug) precisa ser replicada NOS TRÊS lugares — mesma
// situação que já existe hoje entre web e mobile, documentada em
// vários pontos do handoff do projeto.
//
// Escrita: usa a RPC `set_series_status_with_history` (migration
// `20260908000000_series_status_safety_net.sql`) em vez de um
// `.upsert()` direto — grava o status E o histórico
// (`series_status_history`) na mesma transação, já com
// `source = 'daily_job'`, pra qualquer investigação futura conseguir
// distinguir "o job diário corrigiu isso sozinho" de "o usuário mudou
// na mão" ou "o botão manual corrigiu".

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Mesmo teto padrão do Supabase (1000 linhas por consulta) — todas as
// paginações desta função pagam a mesma correção já aplicada em vários
// lugares do projeto: contagem primeiro, todas as páginas em paralelo,
// SEMPRE com `.order()` explícito (sem isso, o Postgres não garante
// que a página 2 comece onde a página 1 parou — mesmo bug de raiz já
// documentado em `seriesCategoryRecalc.ts`).
const PAGE_SIZE = 1000;

// Mesmo valor já usado em `check-new-releases` — equilíbrio entre
// velocidade e não estourar limite de requisição do TMDB.
const TMDB_CONCURRENCY = 15;
const SEASON_FETCH_BATCH_SIZE = 5;

// Escreve no banco em lotes pequenos e paralelos, não tudo de uma vez
// nem um por um sequencial — mesmo raciocínio do `CONCURRENCY` já
// usado na rota admin/repair-series-categories.
const WRITE_CONCURRENCY = 10;

interface StatusRow {
  user_id: string;
  series_id: number;
  status: string;
}

interface WatchedEpisodeRow {
  user_id: string;
  series_id: number;
  season_number: number;
  episode_number: number;
  tmdb_episode_id: number | null;
}

interface LiveEpisode {
  seasonNumber: number;
  episodeNumber: number;
  airDate: string | null;
  episodeId: number;
}

interface TmdbTvDetailsResponse {
  status: string;
  in_production: boolean;
  seasons: { season_number: number; episode_count: number }[];
}

interface TmdbSeasonResponse {
  episodes: {
    id: number;
    season_number: number;
    episode_number: number;
    air_date: string | null;
  }[];
}

async function tmdbGet<T>(path: string): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "pt-BR");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB respondeu ${response.status} em ${path}`);
  return (await response.json()) as T;
}

async function fetchLiveEpisodes(seriesId: number): Promise<{ episodes: LiveEpisode[]; ended: boolean } | null> {
  try {
    const details = await tmdbGet<TmdbTvDetailsResponse>(`/tv/${seriesId}`);
    const seasonNumbers = details.seasons.filter((s) => s.season_number >= 1).map((s) => s.season_number);

    const episodes: LiveEpisode[] = [];
    for (let i = 0; i < seasonNumbers.length; i += SEASON_FETCH_BATCH_SIZE) {
      const batch = seasonNumbers.slice(i, i + SEASON_FETCH_BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((seasonNumber) => tmdbGet<TmdbSeasonResponse>(`/tv/${seriesId}/season/${seasonNumber}`))
      );
      settled.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          for (const ep of outcome.value.episodes) {
            episodes.push({
              seasonNumber: ep.season_number,
              episodeNumber: ep.episode_number,
              airDate: ep.air_date,
              episodeId: ep.id,
            });
          }
        } else {
          console.error(`[daily-status-recalc] Falha ao buscar temporada ${batch[index]} da série ${seriesId}`, outcome.reason);
        }
      });
    }

    // Mesma fórmula já usada em `getSeriesSummary`/`getSeriesSeasonSummary`
    // (lib/tmdb/client.ts) desde a correção do Solo Leveling — `status`
    // sozinho não basta, uma renovação anunciada pode não ter atualizado
    // `status` ainda, mas `in_production` já reflete isso.
    const ended = (details.status === "Ended" || details.status === "Canceled") && !details.in_production;
    return { episodes, ended };
  } catch (error) {
    console.error(`[daily-status-recalc] Falha ao buscar dados da série ${seriesId} no TMDB`, error);
    return null;
  }
}

// ============================================================
// Lógica de decisão — cópia fiel de apps/web/lib/queries/
// airDateCategory.ts (ver aviso grande no topo do arquivo).
// ============================================================

function episodeIsWatched(episode: LiveEpisode, watchedKeys: Set<string>, watchedIds: Set<number>): boolean {
  if (watchedIds.has(episode.episodeId)) return true;
  return watchedKeys.has(`${episode.seasonNumber}-${episode.episodeNumber}`);
}

function decideWatchingVsUpToDate(
  watchedEpisodeKeys: Set<string>,
  watchedEpisodeIds: Set<number>,
  liveEpisodes: LiveEpisode[],
  specialEpisodeKeys: Set<string>
): { category: "watching" | "up_to_date"; allNonSpecialEpisodesWatched: boolean; nonSpecialEpisodeCount: number } {
  const nonSpecialLiveEpisodes = liveEpisodes.filter((e) => !specialEpisodeKeys.has(`${e.seasonNumber}-${e.episodeNumber}`));

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const seasonsWithConfirmedAiring = new Set(
    nonSpecialLiveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today).map((e) => e.seasonNumber)
  );
  const airedByNow = nonSpecialLiveEpisodes.filter(
    (e) => (e.airDate !== null && e.airDate <= today) || (e.airDate === null && seasonsWithConfirmedAiring.has(e.seasonNumber))
  );

  const hasUnwatchedAiredEpisode = airedByNow.some((e) => !episodeIsWatched(e, watchedEpisodeKeys, watchedEpisodeIds));
  const allNonSpecialEpisodesWatched = nonSpecialLiveEpisodes.every((e) => episodeIsWatched(e, watchedEpisodeKeys, watchedEpisodeIds));

  return {
    category: hasUnwatchedAiredEpisode ? "watching" : "up_to_date",
    allNonSpecialEpisodesWatched,
    nonSpecialEpisodeCount: nonSpecialLiveEpisodes.length,
  };
}

function resolveSeriesCategory(input: {
  watchedEpisodeKeys: Set<string>;
  watchedEpisodeIds: Set<number>;
  liveEpisodes: LiveEpisode[];
  ended: boolean;
  specialEpisodeKeys: Set<string>;
}): "watching" | "up_to_date" | "completed" {
  const decision = decideWatchingVsUpToDate(input.watchedEpisodeKeys, input.watchedEpisodeIds, input.liveEpisodes, input.specialEpisodeKeys);
  if (input.ended && decision.allNonSpecialEpisodesWatched) return "completed";
  return decision.category;
}

function shouldWriteSeriesCategory(currentStatus: string, newCategory: string): boolean {
  if ((currentStatus === "paused" || currentStatus === "want_to_watch") && newCategory === "watching") return false;
  return newCategory !== currentStatus || newCategory === "watching";
}

// ============================================================
// Job principal
// ============================================================

async function dailyStatusRecalc(): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY) as any;

  // 1. TODAS as linhas de series_status, exceto 'removed' — mesmo
  // escopo do botão manual (repair-series-categories/route.ts): quem
  // decide se uma série entra no recálculo é `shouldWriteSeriesCategory`,
  // não um filtro de status aqui.
  const { count: statusCount, error: statusCountError } = await supabase
    .from("series_status")
    .select("series_id", { count: "exact", head: true })
    .neq("status", "removed");
  if (statusCountError) {
    console.error("[daily-status-recalc] Falha ao contar series_status", statusCountError);
    return;
  }

  const statusPageCount = Math.ceil((statusCount ?? 0) / PAGE_SIZE);
  const statusPages = await Promise.all(
    Array.from({ length: statusPageCount }, async (_, i) => {
      const from = i * PAGE_SIZE;
      const { data, error } = await supabase
        .from("series_status")
        .select("user_id, series_id, status")
        .neq("status", "removed")
        .order("user_id", { ascending: true })
        .order("series_id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(`[daily-status-recalc] Falha ao paginar series_status (linhas ${from}+)`, error);
        return [];
      }
      return (data ?? []) as StatusRow[];
    })
  );
  const statusRows = statusPages.flat();
  const uniqueSeriesIds = [...new Set(statusRows.map((r) => r.series_id))];

  if (uniqueSeriesIds.length === 0) {
    console.log("[daily-status-recalc] Nenhuma série ativa em nenhuma conta — nada a fazer.");
    return;
  }

  // 2. TODOS os episódios assistidos (não especiais) de TODOS os
  // usuários, de uma vez — evita uma consulta separada por usuário
  // (poderia ser milhares). Mesma correção de paginação/ordenação já
  // aplicada em `repair-series-categories/route.ts`.
  const { count: watchedCount, error: watchedCountError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("is_special", false);
  if (watchedCountError) {
    console.error("[daily-status-recalc] Falha ao contar watched_episodes", watchedCountError);
    return;
  }
  const watchedPageCount = Math.ceil((watchedCount ?? 0) / PAGE_SIZE);
  const watchedPages = await Promise.all(
    Array.from({ length: watchedPageCount }, async (_, i) => {
      const from = i * PAGE_SIZE;
      const { data, error } = await supabase
        .from("watched_episodes")
        .select("user_id, series_id, season_number, episode_number, tmdb_episode_id")
        .eq("is_special", false)
        .order("user_id", { ascending: true })
        .order("series_id", { ascending: true })
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(`[daily-status-recalc] Falha ao paginar watched_episodes (linhas ${from}+)`, error);
        return [];
      }
      return (data ?? []) as WatchedEpisodeRow[];
    })
  );

  const watchedKeysByUserSeries = new Map<string, Set<string>>();
  const watchedIdsByUserSeries = new Map<string, Set<number>>();
  for (const row of watchedPages.flat()) {
    const mapKey = `${row.user_id}:${row.series_id}`;
    const key = `${row.season_number}-${row.episode_number}`;
    const keySet = watchedKeysByUserSeries.get(mapKey) ?? new Set<string>();
    keySet.add(key);
    watchedKeysByUserSeries.set(mapKey, keySet);
    if (row.tmdb_episode_id !== null) {
      const idSet = watchedIdsByUserSeries.get(mapKey) ?? new Set<number>();
      idSet.add(row.tmdb_episode_id);
      watchedIdsByUserSeries.set(mapKey, idSet);
    }
  }

  // 3. Episódios especiais (mesmo raciocínio — exclui do lado TMDB pra
  // não deixar série com especial preso em "watching" pra sempre).
  const { count: specialCount, error: specialCountError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("is_special", true);
  if (specialCountError) {
    console.error("[daily-status-recalc] Falha ao contar episódios especiais", specialCountError);
    return;
  }
  const specialPageCount = Math.ceil((specialCount ?? 0) / PAGE_SIZE);
  const specialPages = await Promise.all(
    Array.from({ length: specialPageCount }, async (_, i) => {
      const from = i * PAGE_SIZE;
      const { data, error } = await supabase
        .from("watched_episodes")
        .select("user_id, series_id, season_number, episode_number")
        .eq("is_special", true)
        .order("user_id", { ascending: true })
        .order("series_id", { ascending: true })
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error(`[daily-status-recalc] Falha ao paginar episódios especiais (linhas ${from}+)`, error);
        return [];
      }
      return (data ?? []) as Omit<WatchedEpisodeRow, "tmdb_episode_id">[];
    })
  );
  const specialKeysByUserSeries = new Map<string, Set<string>>();
  for (const row of specialPages.flat()) {
    const mapKey = `${row.user_id}:${row.series_id}`;
    const set = specialKeysByUserSeries.get(mapKey) ?? new Set<string>();
    set.add(`${row.season_number}-${row.episode_number}`);
    specialKeysByUserSeries.set(mapKey, set);
  }

  // 4. TMDB — uma vez por série ÚNICA, em lotes paralelos.
  const liveDataBySeriesId = new Map<number, { episodes: LiveEpisode[]; ended: boolean }>();
  for (let i = 0; i < uniqueSeriesIds.length; i += TMDB_CONCURRENCY) {
    const batch = uniqueSeriesIds.slice(i, i + TMDB_CONCURRENCY);
    const results = await Promise.all(batch.map((seriesId) => fetchLiveEpisodes(seriesId)));
    batch.forEach((seriesId, idx) => {
      const data = results[idx];
      if (data) liveDataBySeriesId.set(seriesId, data);
    });
  }

  // 5. Decide e grava — só as linhas que `shouldWriteSeriesCategory`
  // aprova, via RPC (grava status + histórico com origem 'daily_job'
  // na mesma transação).
  const toWrite: { user_id: string; series_id: number; status: string }[] = [];
  let skippedNoTmdbData = 0;

  for (const row of statusRows) {
    const liveData = liveDataBySeriesId.get(row.series_id);
    if (!liveData || liveData.episodes.length === 0) {
      skippedNoTmdbData++;
      continue;
    }
    const mapKey = `${row.user_id}:${row.series_id}`;
    const newCategory = resolveSeriesCategory({
      watchedEpisodeKeys: watchedKeysByUserSeries.get(mapKey) ?? new Set<string>(),
      watchedEpisodeIds: watchedIdsByUserSeries.get(mapKey) ?? new Set<number>(),
      liveEpisodes: liveData.episodes,
      ended: liveData.ended,
      specialEpisodeKeys: specialKeysByUserSeries.get(mapKey) ?? new Set<string>(),
    });
    if (shouldWriteSeriesCategory(row.status, newCategory)) {
      toWrite.push({ user_id: row.user_id, series_id: row.series_id, status: newCategory });
    }
  }

  let written = 0;
  let writeErrors = 0;
  for (let i = 0; i < toWrite.length; i += WRITE_CONCURRENCY) {
    const batch = toWrite.slice(i, i + WRITE_CONCURRENCY);
    const results = await Promise.all(
      batch.map((row) =>
        supabase.rpc("set_series_status_with_history", {
          p_user_id: row.user_id,
          p_series_id: row.series_id,
          p_status: row.status,
          p_source: "daily_job",
        })
      )
    );
    for (const result of results) {
      // deno-lint-ignore no-explicit-any
      if ((result as any).error) {
        writeErrors++;
        // deno-lint-ignore no-explicit-any
        console.error("[daily-status-recalc] Falha ao gravar status via RPC", (result as any).error);
      } else {
        written++;
      }
    }
  }

  console.log(
    `[daily-status-recalc] concluído — statusRows=${statusRows.length} uniqueSeries=${uniqueSeriesIds.length} ` +
      `seriesWithTmdbData=${liveDataBySeriesId.size} skippedNoTmdbData=${skippedNoTmdbData} ` +
      `candidatesToWrite=${toWrite.length} written=${written} writeErrors=${writeErrors}`
  );
}

Deno.serve(() => {
  // @ts-expect-error — EdgeRuntime é uma global do runtime do Supabase (Deno Deploy), não existe no tipo padrão do Deno.
  EdgeRuntime.waitUntil(dailyStatusRecalc());
  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
