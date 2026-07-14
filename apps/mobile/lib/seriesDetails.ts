import type { SeriesDetails, LibraryStatus } from "@seenlist/types";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";

const SITE_URL = "https://seenlist.app";

/** Idêntico a lib/queries/series.ts do web. */
export async function fetchSeriesDetails(seriesId: string): Promise<SeriesDetails> {
  const response = await fetch(`${SITE_URL}/api/tmdb/series/${seriesId}`);
  if (!response.ok) throw new Error("series details fetch failed");
  return response.json() as Promise<SeriesDetails>;
}

export type WatchedEpisodeKey = `${number}-${number}`;

export function episodeKey(seasonNumber: number, episodeNumber: number): WatchedEpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

/** Idêntico a watched-episodes-state.ts do web — mesmo filtro por user_id (RLS sozinha não bastava, história documentada no handoff). */
export async function fetchWatchedEpisodes(seriesId: number): Promise<Set<WatchedEpisodeKey>> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id);
  if (error) throw error;

  return new Set((data ?? []).map((row) => episodeKey(row.season_number, row.episode_number)));
}

/**
 * TASK-096 (detalhes de série) — porta fiel de
 * `seriesCategoryRecalc.ts` do web. Chamado depois de marcar/
 * desmarcar um episódio: decide se a série deve ser promovida pra
 * "Em dia" ou "Concluída" (ou rebaixada de volta), com base em
 * quantos episódios JÁ NO AR foram assistidos. Só entra em ação
 * quando o status atual é "watching"/"up_to_date"/"want_to_watch" —
 * nunca mexe numa série "paused" (decisão explícita do usuário).
 */
/**
 * TASK-121 (correção — categoria presa em "Assistindo") — porta de
 * `airDateCategory.ts`. A versão anterior comparava contra o TOTAL
 * de episódios anunciados pelo TMDB (incluindo episódios FUTUROS,
 * ainda sem ir ao ar) — uma série com temporada em andamento (ex.:
 * A Casa do Dragão T3, com episódios de agosto/2026 já anunciados)
 * nunca conseguia sair de "Assistindo", mesmo assistindo tudo que já
 * tinha sido exibido. A comparação certa é só contra o que JÁ FOI AO
 * AR até hoje (`airDate <= hoje`).
 */
function decideWatchingVsUpToDate(mainEpisodesWatched: number, liveEpisodes: { airDate: string | null }[]): LibraryStatus {
  const today = new Date().toISOString().slice(0, 10);
  const airedByNow = liveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today);
  return mainEpisodesWatched < airedByNow.length ? "watching" : "up_to_date";
}

/**
 * TASK-143 (a pedido — série "Em dia" não volta sozinha pra
 * "Assistindo" quando sai episódio novo) — antes, a categoria só era
 * recalculada em resposta a marcar/desmarcar um episódio; passar o
 * tempo e um episódio novo ir ao ar não disparava nada sozinho (nem
 * no web isso existe hoje — decisão nova, só pro nativo, confirmada
 * com o usuário).
 *
 * Chamada toda vez que a aba Séries ganha foco (ver
 * `app/(tabs)/series/index.tsx`). Em LOTE — nunca uma chamada de TMDB
 * por série: busca todas as séries "Em dia" de uma vez, os episódios
 * de todas elas numa chamada só (a rota já aceita lista), e grava as
 * mudanças num único upsert. Só series "Em dia" entram aqui —
 * "Assistindo" já aparece na home de qualquer jeito, "Pausada"/
 * "Assistir depois" continuam de fora de propósito (mesma regra do
 * recálculo individual, decisão explícita do usuário).
 */
const TMDB_EPISODES_CHUNK_SIZE = 20; // a rota /api/tmdb/series-episodes-at-export trunca silenciosamente acima de 20 ids por chamada — precisa dividir.
const WATCHED_EPISODES_PAGE_SIZE = 1000; // limite padrão de linhas por consulta do Supabase/PostgREST — sem paginação, contagens em lote de usuários com muito histórico vinham incompletas.

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * TASK-143 (correção — várias séries "Em dia" viraram "Assistindo" à
 * toa) — causa real encontrada: a busca de episódios no TMDB
 * (`series-episodes-at-export`) trunca silenciosamente acima de 20
 * séries por chamada (limite da própria rota, `MAX_IDS_PER_REQUEST`);
 * E a contagem de episódios assistidos, buscando TODAS as séries "Em
 * dia" de uma vez sem paginação, podia esbarrar no limite padrão de
 * 1000 linhas por consulta do Supabase — series que apareciam DEPOIS
 * desse limite na resposta ficavam com contagem ZERADA, parecendo
 * "nunca comecei a assistir" e virando "Assistindo" à toa, mesmo
 * 100% em dia de verdade.
 */
async function fetchWatchedEpisodeCountsBySeriesId(userId: string, seriesIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("watched_episodes")
      .select("series_id")
      .eq("user_id", userId)
      .eq("is_special", false)
      .in("series_id", seriesIds)
      .range(from, from + WATCHED_EPISODES_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
    }
    if (!data || data.length < WATCHED_EPISODES_PAGE_SIZE) break;
    from += WATCHED_EPISODES_PAGE_SIZE;
  }
  return counts;
}

export async function fetchLiveEpisodesBySeriesId(seriesIds: number[]): Promise<Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>> {
  const result = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>();
  for (const idsChunk of chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE)) {
    const response = await fetch(`${SITE_URL}/api/tmdb/series-episodes-at-export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesIds: idsChunk }),
    });
    if (!response.ok) continue;
    const data = (await response.json()) as {
      series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] }[];
    };
    for (const s of data.series) result.set(s.id, s.episodes);
  }
  return result;
}

async function fetchEndedBySeriesId(seriesIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  for (const idsChunk of chunkArray(seriesIds, TMDB_EPISODES_CHUNK_SIZE)) {
    const response = await fetch(`${SITE_URL}/api/tmdb/library-summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds: [], seriesIds: idsChunk }),
    });
    if (!response.ok) continue;
    const data = (await response.json()) as { series: { id: number; ended: boolean }[] };
    for (const s of data.series) result.set(s.id, s.ended);
  }
  return result;
}

export async function recalculateUpToDateSeriesCategories(): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  const { data: statusRows, error: statusError } = await supabase
    .from("series_status")
    .select("series_id")
    .eq("user_id", user.id)
    .eq("status", "up_to_date");
  if (statusError || !statusRows || statusRows.length === 0) return;

  const seriesIds = statusRows.map((row) => row.series_id);

  let watchedCountBySeriesId: Map<number, number>;
  let episodesBySeriesId: Map<number, { airDate: string | null }[]>;
  let endedBySeriesId: Map<number, boolean>;
  try {
    [watchedCountBySeriesId, episodesBySeriesId, endedBySeriesId] = await Promise.all([
      fetchWatchedEpisodeCountsBySeriesId(user.id, seriesIds),
      fetchLiveEpisodesBySeriesId(seriesIds),
      fetchEndedBySeriesId(seriesIds),
    ]);
  } catch (error) {
    console.error("[recalculateUpToDateSeriesCategories] Falha ao buscar dados em lote — categorias não recalculadas desta vez.", error);
    return;
  }

  const updates: { user_id: string; series_id: number; status: LibraryStatus; updated_at: string }[] = [];
  for (const seriesId of seriesIds) {
    const liveEpisodes = episodesBySeriesId.get(seriesId) ?? [];
    if (liveEpisodes.length === 0) continue; // TMDB não devolveu nada pra essa série desta vez — não mexe, mais seguro do que arriscar errado.

    const watched = watchedCountBySeriesId.get(seriesId) ?? 0;
    const ended = endedBySeriesId.get(seriesId) ?? false;
    const allEpisodesWatched = watched >= liveEpisodes.length;
    const newCategory: LibraryStatus = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes);

    if (newCategory !== "up_to_date") {
      updates.push({ user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() });
    }
  }

  if (updates.length === 0) return;

  const { error: upsertError } = await supabase.from("series_status").upsert(updates, { onConflict: "user_id,series_id" });
  if (upsertError) {
    console.error("[recalculateUpToDateSeriesCategories] Falha ao gravar categorias recalculadas", upsertError);
  }
}

/**
 * TASK-143 (reparo, uso único) — desfaz o estrago do bug acima: séries
 * que foram incorretamente movidas de "Em dia" pra "Assistindo" (por
 * causa da contagem zerada) continuam erradas no banco até serem
 * reavaliadas — o recálculo automático só olha séries "Em dia", então
 * nunca mais tocaria nelas sozinho, já que agora estão como
 * "watching". Esta função reavalia TODAS as séries "watching" (com
 * pelo menos 1 episódio assistido) usando a lógica já corrigida
 * (paginada, sem o limite de 20/1000) — quem realmente está em dia
 * volta pra "up_to_date"/"completed"; quem está mesmo atrasada fica
 * como está. Chamar uma vez só (ver instruções de teste).
 */
export async function repairWatchingSeriesCategories(): Promise<{ corrigidas: number; total: number }> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return { corrigidas: 0, total: 0 };

  const { data: statusRows, error: statusError } = await supabase
    .from("series_status")
    .select("series_id")
    .eq("user_id", user.id)
    .eq("status", "watching");
  if (statusError || !statusRows || statusRows.length === 0) return { corrigidas: 0, total: 0 };

  const seriesIds = statusRows.map((row) => row.series_id);

  const [watchedCountBySeriesId, episodesBySeriesId, endedBySeriesId] = await Promise.all([
    fetchWatchedEpisodeCountsBySeriesId(user.id, seriesIds),
    fetchLiveEpisodesBySeriesId(seriesIds),
    fetchEndedBySeriesId(seriesIds),
  ]);

  const updates: { user_id: string; series_id: number; status: LibraryStatus; updated_at: string }[] = [];
  for (const seriesId of seriesIds) {
    const liveEpisodes = episodesBySeriesId.get(seriesId) ?? [];
    if (liveEpisodes.length === 0) continue;

    const watched = watchedCountBySeriesId.get(seriesId) ?? 0;
    const ended = endedBySeriesId.get(seriesId) ?? false;
    const allEpisodesWatched = watched >= liveEpisodes.length;
    const newCategory: LibraryStatus = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes);

    if (newCategory !== "watching") {
      updates.push({ user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() });
    }
  }

  if (updates.length > 0) {
    const { error } = await supabase.from("series_status").upsert(updates, { onConflict: "user_id,series_id" });
    if (error) console.error("[repairWatchingSeriesCategories] Falha ao gravar correções", error);
  }

  return { corrigidas: updates.length, total: seriesIds.length };
}

export async function recalculateSeriesCategoryAfterEpisodeChange(seriesId: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return;

  const { data: statusRow, error: statusError } = await supabase
    .from("series_status")
    .select("status")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (statusError) return;

  const currentStatus = statusRow?.status ?? "watching";
  const eligible = currentStatus === "watching" || currentStatus === "up_to_date" || currentStatus === "want_to_watch";

  // TASK-141 (diagnóstico temporário — série não aparece em Assistindo) — remover depois de descobrir a causa.
  console.log("[recalcularCategoria DIAGNÓSTICO] início", { seriesId, statusRowEncontrada: !!statusRow, currentStatus, eligible });

  if (!eligible) return;

  const { count: watchedCount } = await supabase
    .from("watched_episodes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("is_special", false);

  let liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] = [];
  let ended = false;
  try {
    const [episodesResponse, summaryResponse] = await Promise.all([
      fetch(`${SITE_URL}/api/tmdb/series-episodes-at-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: [seriesId] }),
      }),
      fetch(`${SITE_URL}/api/tmdb/library-summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: [seriesId] }),
      }),
    ]);
    if (episodesResponse.ok) {
      const data = (await episodesResponse.json()) as {
        series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] }[];
      };
      liveEpisodes = data.series.find((s) => s.id === seriesId)?.episodes ?? [];
    }
    if (summaryResponse.ok) {
      const data = (await summaryResponse.json()) as { series: { id: number; ended: boolean }[] };
      ended = data.series.find((s) => s.id === seriesId)?.ended ?? false;
    }
  } catch (error) {
    console.error("[series-category-recalc] Falha ao buscar dados do TMDB — categoria não recalculada desta vez.", error);
    return;
  }

  if (liveEpisodes.length === 0) {
    console.log("[recalcularCategoria DIAGNÓSTICO] SAINDO — TMDB não devolveu episódios pra esta série", { seriesId });
    return;
  }

  const watched = watchedCount ?? 0;
  const allEpisodesWatched = watched >= liveEpisodes.length;
  const newCategory: LibraryStatus = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes);

  console.log("[recalcularCategoria DIAGNÓSTICO] resultado", {
    seriesId,
    watched,
    totalEpisodiosNoTmdb: liveEpisodes.length,
    ended,
    currentStatus,
    newCategory,
    vaiGravar: newCategory !== currentStatus,
  });

  if (newCategory === currentStatus) return;

  const { error: updateError } = await supabase
    .from("series_status")
    .upsert(
      { user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() },
      { onConflict: "user_id,series_id" }
    );
  if (updateError) {
    console.error("[series-category-recalc] Falha ao atualizar categoria depois de marcar episódio.", updateError);
  }
}

/** Idêntico a useToggleEpisodeWatched do web, sem otimismo de cache (o hook em useWatchedEpisodes.ts cuida disso). */
export async function toggleEpisodeWatched(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number,
  currentlyWatched: boolean
): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyWatched) {
    const { error } = await supabase
      .from("watched_episodes")
      .delete()
      .match({ series_id: seriesId, season_number: seasonNumber, episode_number: episodeNumber, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("watched_episodes").insert({
      user_id: user.id,
      series_id: seriesId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    });
    if (error) throw error;
  }

  await recalculateSeriesCategoryAfterEpisodeChange(seriesId);
}

/**
 * TASK-113 (retoques de Séries) — porta de useMarkEpisodesWatched:
 * marca vários episódios de uma vez (um UPSERT só, não um insert por
 * episódio) — usado tanto por "marcar episódios anteriores?" quanto
 * por "marcar temporada inteira".
 */
export async function markEpisodesWatched(seriesId: number, episodes: { seasonNumber: number; episodeNumber: number }[]): Promise<void> {
  if (episodes.length === 0) return;
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const rows = episodes.map((e) => ({
    user_id: user.id,
    series_id: seriesId,
    season_number: e.seasonNumber,
    episode_number: e.episodeNumber,
  }));

  const { error } = await supabase
    .from("watched_episodes")
    .upsert(rows, { onConflict: "user_id,series_id,season_number,episode_number", ignoreDuplicates: true });
  if (error) throw error;

  await recalculateSeriesCategoryAfterEpisodeChange(seriesId);
}

/** Idêntico a useUnmarkSeasonWatched do web — um DELETE só (por series_id + season_number), não um por episódio. */
export async function unmarkSeasonWatched(seriesId: number, seasonNumber: number): Promise<void> {
  const { error } = await supabase.from("watched_episodes").delete().match({ series_id: seriesId, season_number: seasonNumber });
  if (error) throw error;

  await recalculateSeriesCategoryAfterEpisodeChange(seriesId);
}

/**
 * Idêntico a useIncrementEpisodeRewatch do web — incrementa
 * `rewatch_count` na MESMA linha (nunca cria outra) e
 * `total_watch_events` em `series_status`. Não mexe no conjunto de
 * episódios assistidos nem recalcula categoria — reassistir não muda
 * progresso nem status, só estatística de consumo.
 */
export async function incrementEpisodeRewatch(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { data: episodeRow, error: readError } = await supabase
    .from("watched_episodes")
    .select("rewatch_count")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber)
    .maybeSingle();
  if (readError) throw readError;
  if (!episodeRow) throw new Error("Episódio não está marcado como assistido — não dá pra reassistir.");

  const { error: updateError } = await supabase
    .from("watched_episodes")
    .update({ rewatch_count: (episodeRow.rewatch_count ?? 0) + 1 })
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber);
  if (updateError) throw updateError;

  const { data: statusRow, error: statusReadError } = await supabase
    .from("series_status")
    .select("total_watch_events")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (statusReadError) throw statusReadError;
  if (statusRow) {
    const { error: statusUpdateError } = await supabase
      .from("series_status")
      .update({ total_watch_events: (statusRow.total_watch_events ?? 0) + 1 })
      .eq("user_id", user.id)
      .eq("series_id", seriesId);
    if (statusUpdateError) throw statusUpdateError;
  }
}

/** TASK-115 (episódio) — checagem leve, um episódio só (a tela de detalhes do episódio não precisa da lista inteira de watched_episodes da série). */
export async function isEpisodeWatched(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("series_id")
    .eq("series_id", seriesId)
    .eq("season_number", seasonNumber)
    .eq("episode_number", episodeNumber)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function fetchIsFavorite(seriesId: number): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("media_type", "series")
    .eq("media_id", seriesId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Idêntico a useToggleFavorite do web. */
export async function toggleFavorite(seriesId: number, currentlyFavorite: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyFavorite) {
    const { error } = await supabase.from("favorites").delete().match({ user_id: user.id, media_type: "series", media_id: seriesId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("favorites").insert({ user_id: user.id, media_type: "series", media_id: seriesId });
    if (error) throw error;
  }
}

/** Idêntico a useRemoveLibraryItem do web (ramo série): apaga episódios assistidos E o status — reset completo, não soft-delete. */
export async function removeSeriesFromLibrary(seriesId: number): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error: episodesError } = await supabase.from("watched_episodes").delete().match({ series_id: seriesId, user_id: user.id });
  if (episodesError) throw episodesError;

  const { error: statusError } = await supabase.from("series_status").delete().match({ series_id: seriesId, user_id: user.id });
  if (statusError) throw statusError;
}

// ---------------------------------------------------------------
// Carrossel de "próximos episódios" (topo da aba Episódios)
// ---------------------------------------------------------------

export interface EpisodeRef {
  seasonNumber: number;
  episode: SeriesDetails["seasons"][number]["episodes"][number];
}

function isAired(episode: EpisodeRef["episode"], today: Date): boolean {
  if (!episode.airDate) return false;
  return new Date(`${episode.airDate}T00:00:00`) <= today;
}

/**
 * Pedido explícito do usuário (diferente do web neste ponto
 * específico): o carrossel deve mostrar episódios já lançados EM
 * ORDEM, estejam assistidos ou não — não só os pendentes. O web
 * escondia os já assistidos (`getPendingEpisodes`); aqui não.
 */
function getPendingEpisodes(seasons: SeriesDetails["seasons"], _watched: Set<WatchedEpisodeKey>): EpisodeRef[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: EpisodeRef[] = [];

  for (const season of [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
    for (const episode of [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      if (!isAired(episode, today)) continue;
      result.push({ seasonNumber: season.seasonNumber, episode });
    }
  }
  return result;
}

/** Idêntico a getNextUpcomingEpisode do web. */
function getNextUpcomingEpisode(seasons: SeriesDetails["seasons"]): EpisodeRef | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let best: EpisodeRef | null = null;

  for (const season of seasons) {
    for (const episode of season.episodes) {
      if (!episode.airDate) continue;
      const airDate = new Date(`${episode.airDate}T00:00:00`);
      if (airDate <= today) continue;
      if (!best || !best.episode.airDate || airDate < new Date(`${best.episode.airDate}T00:00:00`)) {
        best = { seasonNumber: season.seasonNumber, episode };
      }
    }
  }
  return best;
}

/**
 * Idêntico a resolveCarouselEpisodes do web — decide o conteúdo do
 * carrossel pela categoria da série. "completed"/"want_to_watch"/
 * status desconhecido: sem carrossel (não inventa fila fake).
 */
export function resolveCarouselEpisodes(
  category: LibraryStatus | null | undefined,
  seasons: SeriesDetails["seasons"],
  watched: Set<WatchedEpisodeKey>
): EpisodeRef[] {
  if (category === "watching") return getPendingEpisodes(seasons, watched);
  if (category === "paused") {
    const pending = getPendingEpisodes(seasons, watched);
    const first = pending[0];
    return first ? [first] : [];
  }
  if (category === "up_to_date") {
    const next = getNextUpcomingEpisode(seasons);
    return next ? [next] : [];
  }
  return [];
}
export async function fetchSeriesStatus(seriesId: number): Promise<LibraryStatus | null> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("series_status")
    .select("status")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const status = data?.status as LibraryStatus | "removed" | undefined;
  return status && status !== "removed" ? status : null;
}

/** Idêntico a useSetSeriesStatus do web: tocar no status já ativo remove (volta pro derivado); tocar em outro substitui. */
export async function setSeriesStatus(seriesId: number, status: LibraryStatus, currentStatus: LibraryStatus | null): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentStatus === status) {
    const { error } = await supabase.from("series_status").delete().match({ series_id: seriesId, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("series_status").upsert({
      user_id: user.id,
      series_id: seriesId,
      status,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}
