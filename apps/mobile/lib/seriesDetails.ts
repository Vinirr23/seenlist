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

  if (liveEpisodes.length === 0) return;

  const watched = watchedCount ?? 0;
  const allEpisodesWatched = watched >= liveEpisodes.length;
  const newCategory: LibraryStatus = ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes);

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
