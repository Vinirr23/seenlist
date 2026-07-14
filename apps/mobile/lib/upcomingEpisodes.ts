import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchLibraryItems } from "@/lib/library";

const SITE_URL = "https://seenlist.app";
const RECENTLY_AIRED_DAYS = 7;

export interface NextEpisodeToAir {
  seriesId: number;
  seriesTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
  networks: string[];
}

export type UpcomingBadge = "premiere" | "novo" | "mais-recente" | null;

export interface UpcomingEpisodeWithBadge extends NextEpisodeToAir {
  badge: UpcomingBadge;
}

export interface UpcomingGroup {
  dateKey: string;
  label: string;
  episodes: UpcomingEpisodeWithBadge[];
}

async function fetchUpcoming(seriesIds: number[]): Promise<NextEpisodeToAir[]> {
  if (seriesIds.length === 0) return [];
  const response = await fetch(`${SITE_URL}/api/tmdb/upcoming`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesIds }),
  });
  if (!response.ok) throw new Error("upcoming fetch failed");
  const data = (await response.json()) as { episodes: NextEpisodeToAir[] };
  return data.episodes;
}

async function fetchWatchedStatus(episodes: NextEpisodeToAir[]): Promise<Set<string>> {
  if (episodes.length === 0) return new Set();
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return new Set();

  const orFilter = episodes
    .map((e) => `and(series_id.eq.${e.seriesId},season_number.eq.${e.seasonNumber},episode_number.eq.${e.episodeNumber})`)
    .join(",");

  const { data, error } = await supabase.from("watched_episodes").select("series_id, season_number, episode_number").eq("user_id", user.id).or(orFilter);
  if (error) {
    console.error("[upcomingEpisodes] Falha ao buscar status assistido — badge NOVO fica sem efeito desta vez.", error);
    return new Set();
  }
  return new Set((data ?? []).map((row) => `${row.series_id}-${row.season_number}-${row.episode_number}`));
}

interface BadgeableEpisode {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
}

/** Idêntico a computeBadge do web. */
export function computeBadge(episode: BadgeableEpisode, watchedKeys: Set<string>): UpcomingBadge {
  if (episode.episodeNumber === 1 && episode.seasonNumber > 1) return "premiere";

  const airDate = new Date(`${episode.airDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alreadyAired = airDate.getTime() <= today.getTime();
  if (!alreadyAired) return null;

  const daysSinceAired = Math.floor((today.getTime() - airDate.getTime()) / (24 * 60 * 60 * 1000));
  const isWatched = watchedKeys.has(`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`);
  if (daysSinceAired <= RECENTLY_AIRED_DAYS && !isWatched) return "novo";
  return "mais-recente";
}

const WEEKDAY_SHORT = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDayLabel(dateKey: string): string {
  const target = startOfDay(new Date(`${dateKey}T00:00:00`));
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(new Date(today.getTime() + 24 * 60 * 60 * 1000));
  if (target.getTime() === today.getTime()) return "HOJE";
  if (target.getTime() === tomorrow.getTime()) return "AMANHÃ";
  return WEEKDAY_SHORT[target.getDay()] ?? "";
}

/**
 * TASK-117/119 — porta de `useUpcomingEpisodes` do web. Reaproveitada
 * tanto pela tela de Estatísticas ("Próximos episódios anunciados")
 * quanto pela futura aba "Em breve" de Séries — mesma função, sem
 * duplicar a regra em dois lugares (mesmo espírito do web).
 */
export async function fetchUpcomingGroups(): Promise<UpcomingGroup[]> {
  const items = await fetchLibraryItems();
  const seriesIds = items.filter((item) => item.mediaType === "series" && (item.status === "watching" || item.status === "up_to_date")).map((item) => item.id);

  const episodes = await fetchUpcoming(seriesIds);
  const watchedKeys = await fetchWatchedStatus(episodes);

  const byDate = new Map<string, UpcomingEpisodeWithBadge[]>();
  for (const episode of episodes) {
    const withBadge: UpcomingEpisodeWithBadge = { ...episode, badge: computeBadge(episode, watchedKeys) };
    const list = byDate.get(episode.airDate);
    if (list) list.push(withBadge);
    else byDate.set(episode.airDate, [withBadge]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, eps]) => ({ dateKey, label: formatDayLabel(dateKey), episodes: eps }));
}
