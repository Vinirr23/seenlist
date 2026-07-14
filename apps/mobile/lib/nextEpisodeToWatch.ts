import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchLiveEpisodesBySeriesId } from "@/lib/seriesDetails";
import { computeBadge, type UpcomingBadge } from "@/lib/upcomingEpisodes";

const SITE_URL = "https://seenlist.app";
const WATCHED_KEYS_PAGE_SIZE = 1000;

export interface NextEpisodeToWatch {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  /** Quantos episódios A MAIS (além deste) já foram ao ar e também estão pendentes — o "+N" do card. */
  additionalPendingCount: number;
  badge: UpcomingBadge;
}

/** Mesma paginação já usada em fetchLibraryItems/recalculateUpToDateSeriesCategories — evita o limite padrão de 1000 linhas cortar o resultado. */
async function fetchWatchedEpisodeKeysBySeriesId(userId: string, seriesIds: number[]): Promise<Map<number, Set<string>>> {
  const bySeriesId = new Map<number, Set<string>>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("watched_episodes")
      .select("series_id, season_number, episode_number")
      .eq("user_id", userId)
      .eq("is_special", false)
      .in("series_id", seriesIds)
      .range(from, from + WATCHED_KEYS_PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      const key = `${row.season_number}-${row.episode_number}`;
      const set = bySeriesId.get(row.series_id);
      if (set) set.add(key);
      else bySeriesId.set(row.series_id, new Set([key]));
    }
    if (!data || data.length < WATCHED_KEYS_PAGE_SIZE) break;
    from += WATCHED_KEYS_PAGE_SIZE;
  }
  return bySeriesId;
}

async function fetchEpisodeName(seriesId: number, seasonNumber: number, episodeNumber: number): Promise<string> {
  try {
    const response = await fetch(`${SITE_URL}/api/tmdb/episode/${seriesId}/${seasonNumber}/${episodeNumber}`);
    if (!response.ok) return `Episódio ${episodeNumber}`;
    const data = (await response.json()) as { episode: { name: string } };
    return data.episode?.name ?? `Episódio ${episodeNumber}`;
  } catch {
    return `Episódio ${episodeNumber}`;
  }
}

/**
 * TASK-145 (a pedido — card de "Continue assistindo" em modo lista)
 * — pra cada série "Assistindo", acha o episódio pendente mais
 * antigo (já foi ao ar, ainda não foi marcado) e conta quantos
 * outros também estão pendentes (`additionalPendingCount`, o "+N"
 * do card). Só busca nome do episódio pras séries realmente
 * visíveis na tela (a lista já vem limitada por quem chama) — não é
 * uma função pra rodar com a biblioteca inteira de uma vez.
 */
export async function fetchNextEpisodesToWatch(seriesIds: number[]): Promise<Map<number, NextEpisodeToWatch>> {
  const result = new Map<number, NextEpisodeToWatch>();
  if (seriesIds.length === 0) return result;

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return result;

  const [liveEpisodesBySeriesId, watchedKeysBySeriesId] = await Promise.all([
    fetchLiveEpisodesBySeriesId(seriesIds),
    fetchWatchedEpisodeKeysBySeriesId(user.id, seriesIds),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const pendingBySeriesId = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string }[]>();

  for (const seriesId of seriesIds) {
    const liveEpisodes = liveEpisodesBySeriesId.get(seriesId) ?? [];
    const watchedKeys = watchedKeysBySeriesId.get(seriesId) ?? new Set<string>();

    const pending = liveEpisodes
      .filter((e) => e.airDate !== null && e.airDate <= today)
      .filter((e) => !watchedKeys.has(`${e.seasonNumber}-${e.episodeNumber}`))
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)
      .map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, airDate: e.airDate as string }));

    if (pending.length > 0) pendingBySeriesId.set(seriesId, pending);
  }

  await Promise.all(
    [...pendingBySeriesId.entries()].map(async ([seriesId, pending]) => {
      const next = pending[0];
      if (!next) return;
      const watchedKeys = watchedKeysBySeriesId.get(seriesId) ?? new Set<string>();
      const badgeWatchedSet = new Set([...watchedKeys].map((key) => `${seriesId}-${key}`));
      const name = await fetchEpisodeName(seriesId, next.seasonNumber, next.episodeNumber);

      result.set(seriesId, {
        seriesId,
        seasonNumber: next.seasonNumber,
        episodeNumber: next.episodeNumber,
        name,
        additionalPendingCount: pending.length - 1,
        badge: computeBadge({ seriesId, seasonNumber: next.seasonNumber, episodeNumber: next.episodeNumber, airDate: next.airDate }, badgeWatchedSet),
      });
    })
  );

  return result;
}
